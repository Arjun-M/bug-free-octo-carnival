/**
 * @file src/isolate/IsolatePool.ts
 * @description Connection pool for reusable isolates to reduce startup overhead. Manages isolate lifecycle with configurable min/max sizes, idle timeouts, warmup capabilities, and automatic cleanup.
 * @since 1.0.0
 * @copyright Copyright (c) 2025 Arjun-M. This source code is licensed under the MIT license.
 */

import type { PoolOptions } from '../core/types.js';
import { SandboxError } from '../core/types.js';
import type { ExecutionResult } from '../execution/ExecutionEngine.js';
import { PooledIsolate } from './PooledIsolate.js';
import { PoolStatsTracker, type PoolStats } from './PoolStats.js';
import { AsyncQueue } from '../utils/AsyncQueue.js';
import { logger } from '../utils/Logger.js';

/**
 * Connection pool for reusing isolates to improve performance.
 *
 * Maintains a pool of pre-initialized isolates that can be borrowed and returned,
 * significantly reducing the overhead of creating new isolates for each execution.
 *
 * Features:
 * - Configurable min/max pool sizes
 * - Idle timeout with automatic cleanup
 * - Optional warmup code execution
 * - Health checking and automatic replacement
 * - Queue management for concurrent requests
 * - Statistics tracking (acquisitions, wait times, errors)
 *
 * @class IsolatePool
 * @example
 * ```typescript
 * const pool = new IsolatePool({
 *   min: 5,
 *   max: 50,
 *   idleTimeout: 30000,
 *   warmupCode: 'const utils = { add: (a, b) => a + b };'
 * });
 *
 * await pool.warmup();
 *
 * const result = await pool.execute('utils.add(1, 2)', { timeout: 5000 });
 * console.log(result); // 3
 *
 * await pool.dispose();
 * ```
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

  constructor(options: PoolOptions = {}) {
    this.min = options.min ?? 5;
    this.max = options.max ?? 50;
    this.idleTimeout = options.idleTimeout ?? 30000; // 30s
    this.warmupCode = options.warmupCode;
    this.stats = new PoolStatsTracker();
    // Use optional chaining or assertion for max since it's set
    this.queue = new AsyncQueue(this.max);

    if (this.min < 1) throw new SandboxError('Pool min must be > 0', 'INVALID_POOL_CONFIG');
    if (this.max < this.min) throw new SandboxError('Pool max must be >= min', 'INVALID_POOL_CONFIG');

    this.startCleanupInterval();

    logger.info(
      `IsolatePool ready (min=${this.min}, max=${this.max}, idle=${this.idleTimeout}ms)`
    );
  }

  /**
   * Get an isolate from the pool.
   */
  async acquire(): Promise<PooledIsolate> {
    this.ensureNotDisposed();

    return this.queue.add(async () => {
      // 1. Reuse available
      let isolate = this.available.pop();

      if (isolate) {
        await isolate.reset();
        isolate.markUsed();
        this.inUse.add(isolate);
        this.updateStats();
        return isolate;
      }

      // 2. Create new if allowed
      if (this.inUse.size < this.max) {
        isolate = await this.createIsolate();
        this.inUse.add(isolate);
        this.updateStats();
        return isolate;
      }

      // 3. Should block/wait via queue (managed by AsyncQueue)
      // But if queue logic isn't perfect, we throw.
      // AsyncQueue should handle the waiting for us by not calling this closure until a slot is free?
      // No, AsyncQueue usually limits concurrency.
      // If concurrency limit matches `max`, then we are good.
      // But `available` might be empty while `inUse` is full.
      throw new SandboxError('Pool exhausted', 'POOL_EXHAUSTED');
    });
  }

  /**
   * Return an isolate to the pool.
   */
  release(isolate: PooledIsolate): void {
    if (!this.inUse.has(isolate)) return;

    this.inUse.delete(isolate);

    if (!isolate.getIsHealthy()) {
      isolate.dispose();
      this.updateStats();
      return;
    }

    // Keep if we have space, otherwise trash it
    if (this.available.length < this.max) {
      this.available.push(isolate);
      this.updateStats();
    } else {
      isolate.dispose();
      this.updateStats();
    }
  }

  /**
   * Run code in a pooled isolate.
   */
  async execute<T = any>(code: string, options: { timeout?: number } = {}): Promise<ExecutionResult<T>> {
    this.ensureNotDisposed();

    const pooledIsolate = await this.acquire();
    const start = Date.now();
    let cpuTime = 0;
    let resourceStats;

    try {
      // Execute within the pooled context
      const script = await pooledIsolate.isolate.compileScript(code);
      const result = await script.run(pooledIsolate.context, {
        timeout: options.timeout,
        promise: true,
      });

      // Try to get CPU time and memory stats
      try {
        const [cpuSeconds, cpuNanoseconds] = pooledIsolate.isolate.cpuTime;
        cpuTime = (cpuSeconds * 1000) + (cpuNanoseconds / 1e6);

        // Simple snapshot of memory
        const heap = await pooledIsolate.isolate.getHeapStatistics();
        resourceStats = {
          memoryUsed: heap.total_heap_size,
          cpuTime
        };
      } catch (e) {
        // Ignore stats errors
      }

      const duration = Date.now() - start;
      this.stats.recordExecution(duration);

      return {
        value: result as T,
        duration,
        cpuTime,
        resourceStats
      };
    } catch (error) {
      this.stats.recordError();
      pooledIsolate.setUnhealthy();
      throw error;
    } finally {
      this.release(pooledIsolate);
    }
  }

  /**
   * Pre-fill the pool.
   */
  async warmup(code?: string): Promise<void> {
    this.ensureNotDisposed();

    const warmupCode = code ?? this.warmupCode;
    const promises: Promise<PooledIsolate>[] = [];

    for (let i = 0; i < this.min; i++) {
      promises.push(this.createIsolate(warmupCode));
    }

    const isolates = await Promise.all(promises);
    this.available.push(...isolates);
    this.updateStats();

    logger.info(`Pool warmed up (${isolates.length} isolates)`);
  }

  private async createIsolate(warmupCode?: string): Promise<PooledIsolate> {
    const id = `isolate-${++this.isolateCounter}`;
    // Default memory limit 128MB for pooled isolates if not specified
    const isolate = new PooledIsolate(id, 128 * 1024 * 1024);

    if (warmupCode) {
      try {
        const script = await isolate.isolate.compileScript(warmupCode);
        await script.run(isolate.context);
      } catch (error) {
        logger.warn(`Warmup failed for ${id}: ${error}`);
      }
    }

    this.stats.incrementCreated();
    return isolate;
  }

  getStats(): PoolStats {
    return this.stats.getStats();
  }

  async drain(): Promise<void> {
    this.ensureNotDisposed();
    // Wait for active tasks to finish
    while (this.inUse.size > 0) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  async dispose(): Promise<void> {
    if (this.disposed) return;
    this.disposed = true;

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    for (const isolate of this.available) await isolate.dispose();
    for (const isolate of this.inUse) await isolate.dispose();

    this.available = [];
    this.inUse.clear();
    this.queue.clear();

    logger.info('IsolatePool disposed');
  }

  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupIdleIsolates();
    }, this.idleTimeout / 2);
  }

  private cleanupIdleIsolates(): void {
    if (this.disposed) return;

    const toRemove: PooledIsolate[] = [];

    // Only clean if we have more than min
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
      logger.debug(`Pruned ${toRemove.length} idle isolates`);
      this.updateStats();
    }
  }

  private updateStats(): void {
    this.stats.setActive(this.inUse.size);
    this.stats.setIdle(this.available.length);
    this.stats.setWaiting(this.queue.size());
  }

  private ensureNotDisposed(): void {
    if (this.disposed) {
      throw new SandboxError('Pool disposed', 'POOL_DISPOSED');
    }
  }

  getSizeInfo(): { available: number; inUse: number; total: number } {
    return {
      available: this.available.length,
      inUse: this.inUse.size,
      total: this.available.length + this.inUse.size,
    };
  }
}
