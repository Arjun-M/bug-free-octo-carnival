/**
 * @file src/utils/AsyncQueue.ts
 * @description Async queue for managing concurrent operations with configurable concurrency
 * @since 1.0.0
 * @copyright Copyright (c) 2025 Arjun-M. This source code is licensed under the MIT license.
 */

/**
 * Queue item internal structure
 */
interface QueueItem<T> {
  fn: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
}

/**
 * @class AsyncQueue
 * Concurrent async operation queue with configurable concurrency limit.
 * Automatically manages execution of queued operations.
 *
 * @example
 * ```typescript
 * // Create queue with max 3 concurrent operations
 * const queue = new AsyncQueue(3);
 *
 * // Add operations
 * const results = await Promise.all([
 *   queue.add(() => fetchData(1)),
 *   queue.add(() => fetchData(2)),
 *   queue.add(() => fetchData(3)),
 *   queue.add(() => fetchData(4)),
 *   queue.add(() => fetchData(5))
 * ]);
 *
 * // Only 3 will run at a time
 * console.log('Queue size:', queue.size());
 * console.log('Active:', queue.getActive());
 * console.log('Pending:', queue.pending());
 * ```
 */
export class AsyncQueue {
  private queue: QueueItem<any>[] = [];
  private active: number = 0;
  private readonly concurrency: number;

  /**
   * Create async queue
   * @param concurrency - Maximum concurrent operations (default: 5)
   * @throws {Error} If concurrency is less than 1
   */
  constructor(concurrency: number = 5) {
    if (concurrency < 1) {
      throw new Error('Concurrency must be at least 1');
    }
    this.concurrency = concurrency;
  }

  /**
   * Add operation to queue
   * @param fn - Async function to execute
   * @returns Promise resolving to function result
   *
   * @example
   * ```typescript
   * const result = await queue.add(async () => {
   *   const data = await fetch('/api/data');
   *   return data.json();
   * });
   * ```
   */
  async add<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push({ fn, resolve, reject });
      this.tryProcess();
    });
  }

  /**
   * Try processing next queue item
   */
  private async tryProcess(): Promise<void> {
    if (this.active >= this.concurrency || this.queue.length === 0) {
      return;
    }

    this.active++;
    const item = this.queue.shift();

    if (!item) {
      this.active--;
      return;
    }

    try {
      const result = await item.fn();
      item.resolve(result);
    } catch (error) {
      item.reject(error instanceof Error ? error : new Error(String(error)));
    } finally {
      this.active--;
      this.tryProcess();
    }
  }

  /**
   * Get queue size
   * @returns Number of items in queue
   */
  size(): number {
    return this.queue.length;
  }

  /**
   * Get number of pending operations (in queue + active)
   * @returns Total pending operations
   */
  pending(): number {
    return this.queue.length + this.active;
  }

  /**
   * Clear the queue
   * Rejects all pending operations with 'Queue cleared' error
   */
  clear(): void {
    for (const item of this.queue) {
      item.reject(new Error('Queue cleared'));
    }
    this.queue = [];
  }

  /**
   * Get concurrency limit
   * @returns Concurrency limit
   */
  getConcurrency(): number {
    return this.concurrency;
  }

  /**
   * Get active operation count
   * @returns Number of currently active operations
   */
  getActive(): number {
    return this.active;
  }
}
