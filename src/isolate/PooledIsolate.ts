/**
 * @file src/isolate/PooledIsolate.ts
 * @description Wrapper class for pooled isolate instances, managing reuse, health tracking, execution counting, and lifecycle operations. Enables efficient isolate recycling with state reset capabilities.
 * @since 1.0.0
 * @copyright Copyright (c) 2025 Arjun-M. This source code is licensed under the MIT license.
 */

import ivm from 'isolated-vm';

/**
 * PooledIsolate - Wrapper for a reusable isolated-vm isolate instance.
 *
 * Manages lifecycle, health status, execution statistics, and context reset
 * for isolates that are recycled in a connection pool to improve performance.
 *
 * @class
 * @example
 * ```typescript
 * const pooled = new PooledIsolate('isolate-1', 128 * 1024 * 1024);
 * pooled.markUsed();
 * await pooled.reset(); // Clean context for reuse
 * pooled.dispose(); // Cleanup when done
 * ```
 */
export class PooledIsolate {
  private id: string;
  public isolate: ivm.Isolate;
  public context: ivm.Context;
  private createdAt: number;
  private lastUsedAt: number;
  private executionCount: number = 0;
  private isHealthy: boolean = true;
  private memoryLimit: number;

  constructor(id: string, memoryLimit: number) {
    this.id = id;
    this.createdAt = Date.now();
    this.lastUsedAt = Date.now();
    this.memoryLimit = memoryLimit;

    // Create fresh isolate & context
    this.isolate = new ivm.Isolate({
      memoryLimit: Math.ceil(this.memoryLimit / 1024 / 1024)
    });
    this.context = this.isolate.createContextSync();
  }

  getId(): string {
    return this.id;
  }

  getIsHealthy(): boolean {
    return this.isHealthy && !this.isolate.isDisposed;
  }

  setUnhealthy(): void {
    this.isHealthy = false;
  }

  getCreatedAt(): number {
    return this.createdAt;
  }

  getLastUsedAt(): number {
    return this.lastUsedAt;
  }

  getExecutionCount(): number {
    return this.executionCount;
  }

  markUsed(): void {
    this.lastUsedAt = Date.now();
    this.executionCount++;
  }

  getIdleTime(): number {
    return Date.now() - this.lastUsedAt;
  }

  getAge(): number {
    return Date.now() - this.createdAt;
  }

  /**
   * Reset context state for reuse.
   */
  async reset(): Promise<void> {
    if (this.isolate.isDisposed) {
      this.isHealthy = false;
      throw new Error('Isolate is disposed');
    }

    try {
      // Re-create context to ensure clean state
      // Reusing context is faster but risky if globals are polluted.
      // Ideally, we should use a fresh context for each run in the SAME isolate to save isolate startup time
      // but ensure clean global scope.
      this.context.release();
      this.context = await this.isolate.createContext();
      this.isHealthy = true;
    } catch (error) {
      this.isHealthy = false;
      throw error;
    }
  }

  dispose(): void {
    try {
      // Check if the context is already released using a try-catch block
      // .release() throws if already released, so we catch that specific error
      try {
        this.context.release();
      } catch (e) {
        // Context might be already released or isolate is disposed
      }

      if (!this.isolate.isDisposed) {
        this.isolate.dispose();
      }
    } catch (e) {
      // Ignore
    }
    this.isHealthy = false;
  }
}
