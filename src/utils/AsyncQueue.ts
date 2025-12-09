/**
 * @fileoverview Async queue for managing concurrent operations
 */

/**
 * Queue item
 */
interface QueueItem<T> {
  fn: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
}

/**
 * Concurrent async operation queue
 */
export class AsyncQueue {
  private queue: QueueItem<any>[] = [];
  private active: number = 0;
  private readonly concurrency: number;

  /**
   * Create async queue
   * @param concurrency Maximum concurrent operations
   */
  constructor(concurrency: number = 5) {
    if (concurrency < 1) {
      throw new Error('Concurrency must be at least 1');
    }
    this.concurrency = concurrency;
  }

  /**
   * Add operation to queue
   * @param fn Async function to execute
   * @returns Promise resolving to function result
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
