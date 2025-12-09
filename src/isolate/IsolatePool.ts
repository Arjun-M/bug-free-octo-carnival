/**
 * @fileoverview Isolate connection pool for resource reuse
 *
 * Test Scenarios:
 * ===============
 * Test 1: Pool acquire/release reuses isolates
 *   - Create pool with min=5, max=50
 *   - Acquire isolate, execute code, release
 *   - Acquire again - gets same isolate
 *   - Pool size stays at min level
 *
 * Test 2: Pool scales to max on demand
 *   - Create pool with min=2, max=10
 *   - Acquire 8 isolates concurrently
 *   - Pool creates up to 8 isolates
 *   - Returns all successfully
 *
 * Test 3: Pool warmup pre-initializes isolates
 *   - Call warmup()
 *   - Pool has exactly min isolates available
 *   - getStats().idle === min
 *   - First acquire returns immediately
 *
 * Test 4: Unhealthy isolates removed
 *   - Acquire isolate
 *   - Mark as unhealthy
 *   - Release
 *   - Isolate is disposed, not returned to pool
 *   - Pool creates new isolate on next acquire
 *
 * Test 5: Idle timeout removes unused isolates
 *   - Acquire isolate, release
 *   - Wait longer than idleTimeout
 *   - Isolate removed from pool
 *   - Pool size drops to min
 */

import type { PoolOptions } from '../core/types.js';
import { SandboxError } from '../core/types.js';
import { PooledIsolate } from './PooledIsolate.js';
import { PoolStatsTracker, type PoolStats } from './PoolStats.js';
import { AsyncQueue } from '../utils/AsyncQueue.js';
import { logger } from '../utils/Logger.js';

/**
 * Connection pool for reusing isolates
 */
export class IsolatePool {
  private available: PooledIsolate[] = [];
  private inUse: Set<PooledIsolate> = new Set();
  private min: number;
  private max: number;
  private idleTimeout: number;
  private warmupCode?: string;
  private stats: PoolStatsTracker;
  private queue: AsyncQueue;
  private disposed: boolean = false;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private isolateCounter: number = 0;

  /**
   * Create isolate pool
   * @param options Pool configuration
   */
  constructor(options: PoolOptions = {}) {
    this.min = options.min ?? 5;
    this.max = options.max ?? 50;
    this.idleTimeout = options.idleTimeout ?? 30000; // 30 seconds
    this.warmupCode = options.warmupCode;
    this.stats = new PoolStatsTracker();
    this.queue = new AsyncQueue(this.max);

    // Validate options
    if (this.min < 1) {
      throw new SandboxError('Pool min must be at least 1', 'INVALID_POOL_CONFIG');
    }
    if (this.max < this.min) {
      throw new SandboxError(
        'Pool max must be >= min',
        'INVALID_POOL_CONFIG'
      );
    }

    // Start cleanup interval
    this.startCleanupInterval();

    logger.info(
      `IsolatePool created: min=${this.min}, max=${this.max}, idleTimeout=${this.idleTimeout}ms`
    );
  }

  /**
   * Acquire an isolate from the pool
   * @returns Promise resolving to a PooledIsolate
   */
  async acquire(): Promise<PooledIsolate> {
    this.ensureNotDisposed();

    return this.queue.add(async () => {
      // Try to get available isolate
      let isolate = this.available.pop();

      if (isolate) {
        // Reset state and mark as used
        await isolate.reset();
        isolate.markUsed();
        this.inUse.add(isolate);
        this.updateStats();
        return isolate;
      }

      // Create new isolate if under max
      if (this.inUse.size < this.max) {
        isolate = await this.createIsolate();
        this.inUse.add(isolate);
        this.updateStats();
        return isolate;
      }

      // Should not reach here due to queue concurrency
      throw new SandboxError('Pool at max capacity', 'POOL_EXHAUSTED');
    });
  }

  /**
   * Release an isolate back to the pool
   * @param isolate Isolate to release
   */
  release(isolate: PooledIsolate): void {
    if (!this.inUse.has(isolate)) {
      return;
    }

    this.inUse.delete(isolate);

    // Check if healthy
    if (!isolate.getIsHealthy()) {
      isolate.dispose();
      this.updateStats();
      return;
    }

    // Return to pool if under max
    if (this.available.length < this.max) {
      this.available.push(isolate);
      this.updateStats();
    } else {
      isolate.dispose();
      this.updateStats();
    }
  }

  /**
   * Execute code using a pooled isolate
   * @param code Code to execute
   * @returns Promise resolving to execution result
   */
  async execute<T = any>(code: string): Promise<T> {
    this.ensureNotDisposed();

    const isolate = await this.acquire();
    const start = Date.now();

    try {
      // Simulate execution (real implementation would use isolate)
      const result = eval(code) as T;
      const duration = Date.now() - start;
      this.stats.recordExecution(duration);
      return result;
    } catch (error) {
      this.stats.recordError();
      isolate.setUnhealthy();
      throw error;
    } finally {
      this.release(isolate);
    }
  }

  /**
   * Warm up the pool by pre-creating min isolates
   * @param code Optional warmup code to run
   */
  async warmup(code?: string): Promise<void> {
    this.ensureNotDisposed();

    const warmupCode = code ?? this.warmupCode;
    const promises: Promise<PooledIsolate>[] = [];

    // Create min isolates
    for (let i = 0; i < this.min; i++) {
      promises.push(this.createIsolate(warmupCode));
    }

    const isolates = await Promise.all(promises);
    this.available.push(...isolates);
    this.updateStats();

    logger.info(`Pool warmed up with ${isolates.length} isolates`);
  }

  /**
   * Create a new isolate
   * @param warmupCode Optional code to run during initialization
   */
  private async createIsolate(warmupCode?: string): Promise<PooledIsolate> {
    const id = `isolate-${++this.isolateCounter}`;
    const isolate = new PooledIsolate(id, warmupCode);

    // Run warmup code if provided
    if (warmupCode) {
      try {
        eval(warmupCode);
      } catch (error) {
        logger.warn(`Warmup code failed for ${id}: ${error}`);
      }
    }

    this.stats.incrementCreated();
    return isolate;
  }

  /**
   * Get pool statistics
   * @returns Pool statistics
   */
  getStats(): PoolStats {
    return this.stats.getStats();
  }

  /**
   * Drain the pool (stop accepting new work)
   * @returns Promise resolving when pool is drained
   */
  async drain(): Promise<void> {
    this.ensureNotDisposed();

    // Wait for all in-use isolates to be released
    while (this.inUse.size > 0) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  /**
   * Dispose of the pool and all isolates
   * @returns Promise resolving when disposed
   */
  async dispose(): Promise<void> {
    if (this.disposed) {
      return;
    }

    this.disposed = true;

    // Stop cleanup interval
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    // Dispose all isolates
    for (const isolate of this.available) {
      await isolate.dispose();
    }

    for (const isolate of this.inUse) {
      await isolate.dispose();
    }

    this.available = [];
    this.inUse.clear();
    this.queue.clear();

    logger.info('IsolatePool disposed');
  }

  /**
   * Start periodic cleanup of idle isolates
   */
  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupIdleIsolates();
    }, this.idleTimeout / 2); // Clean every half the idle timeout
  }

  /**
   * Clean up idle isolates
   */
  private cleanupIdleIsolates(): void {
    if (this.disposed) {
      return;
    }

    const toRemove: PooledIsolate[] = [];

    // Only remove if above min
    for (const isolate of this.available) {
      if (
        this.available.length > this.min &&
        isolate.getIdleTime() > this.idleTimeout
      ) {
        toRemove.push(isolate);
      }
    }

    for (const isolate of toRemove) {
      const index = this.available.indexOf(isolate);
      if (index !== -1) {
        this.available.splice(index, 1);
        isolate.dispose();
      }
    }

    if (toRemove.length > 0) {
      logger.debug(`Cleaned up ${toRemove.length} idle isolates`);
      this.updateStats();
    }
  }

  /**
   * Update statistics
   */
  private updateStats(): void {
    this.stats.setActive(this.inUse.size);
    this.stats.setIdle(this.available.length);
    this.stats.setWaiting(this.queue.size());
  }

  /**
   * Check if disposed
   */
  private ensureNotDisposed(): void {
    if (this.disposed) {
      throw new SandboxError('Pool has been disposed', 'POOL_DISPOSED');
    }
  }

  /**
   * Get pool size info
   */
  getSizeInfo(): { available: number; inUse: number; total: number } {
    return {
      available: this.available.length,
      inUse: this.inUse.size,
      total: this.available.length + this.inUse.size,
    };
  }
}
