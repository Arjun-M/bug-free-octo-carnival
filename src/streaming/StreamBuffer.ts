/**
 * @fileoverview Stream buffering and backpressure handling
 */

import { logger } from '../utils/Logger.js';

/**
 * Buffer configuration
 */
export interface BufferConfig {
  maxSize: number;
  highWaterMark: number;
  lowWaterMark: number;
}

/**
 * Stream buffer with backpressure support
 */
export class StreamBuffer<T> {
  private buffer: T[] = [];
  private config: Required<BufferConfig>;
  private isPaused: boolean = false;
  private drainCallbacks: Array<() => void> = [];
  // eslint-disable-next-line @typescript-eslint/ban-types
  private listeners: Map<string, Set<Function>> = new Map();

  constructor(config: Partial<BufferConfig> = {}) {
    this.config = {
      maxSize: config.maxSize ?? 1000,
      highWaterMark: config.highWaterMark ?? 800,
      lowWaterMark: config.lowWaterMark ?? 200,
    };

    logger.debug(
      `StreamBuffer initialized: max=${this.config.maxSize}, high=${this.config.highWaterMark}, low=${this.config.lowWaterMark}`
    );
  }

  /**
   * Push item to buffer
   * @param item Item to push
   * @returns True if should continue, false if should pause
   */
  push(item: T): boolean {
    this.buffer.push(item);

    if (this.buffer.length >= this.config.highWaterMark) {
      this.isPaused = true;
      this.emit('pause');
      logger.debug(`Buffer paused at size ${this.buffer.length}`);
      return false;
    }

    return true;
  }

  /**
   * Get next item from buffer
   * @returns Item or undefined
   */
  shift(): T | undefined {
    const item = this.buffer.shift();

    if (item !== undefined && this.buffer.length <= this.config.lowWaterMark) {
      if (this.isPaused) {
        this.isPaused = false;
        this.emit('resume');
        logger.debug(`Buffer resumed at size ${this.buffer.length}`);

        // Call drain callbacks
        while (this.drainCallbacks.length > 0) {
          const callback = this.drainCallbacks.shift();
          if (callback) {
            callback();
          }
        }
      }
    }

    return item;
  }

  /**
   * Get item at index
   * @param index Index
   * @returns Item or undefined
   */
  at(index: number): T | undefined {
    return this.buffer[index];
  }

  /**
   * Get buffer size
   * @returns Current size
   */
  size(): number {
    return this.buffer.length;
  }

  /**
   * Check if buffer is paused
   * @returns True if paused
   */
  isPausedState(): boolean {
    return this.isPaused;
  }

  /**
   * Check if buffer is empty
   * @returns True if empty
   */
  isEmpty(): boolean {
    return this.buffer.length === 0;
  }

  /**
   * Check if buffer is full
   * @returns True if at max capacity
   */
  isFull(): boolean {
    return this.buffer.length >= this.config.maxSize;
  }

  /**
   * Get buffer usage percentage
   * @returns Percentage (0-100)
   */
  getUsagePercent(): number {
    return (this.buffer.length / this.config.maxSize) * 100;
  }

  /**
   * Clear buffer
   */
  clear(): void {
    this.buffer = [];
    this.isPaused = false;
    this.drainCallbacks = [];

    logger.debug('Buffer cleared');
  }

  /**
   * Drain callback when buffer resumes
   * @param callback Callback function
   */
  drain(callback: () => void): void {
    if (!this.isPaused) {
      callback();
    } else {
      this.drainCallbacks.push(callback);
    }
  }

  /**
   * Iterate over buffer
   * @returns Iterator
   */
  [Symbol.iterator](): Iterator<T> {
    return this.buffer[Symbol.iterator]();
  }

  /**
   * Convert buffer to array
   * @returns Array copy
   */
  toArray(): T[] {
    return [...this.buffer];
  }

  /**
   * Get buffer statistics
   * @returns Statistics object
   */
  getStats(): {
    size: number;
    maxSize: number;
    usagePercent: number;
    isPaused: boolean;
    highWaterMark: number;
    lowWaterMark: number;
  } {
    return {
      size: this.buffer.length,
      maxSize: this.config.maxSize,
      usagePercent: this.getUsagePercent(),
      isPaused: this.isPaused,
      highWaterMark: this.config.highWaterMark,
      lowWaterMark: this.config.lowWaterMark,
    };
  }

  // Event emitter methods
  private emit(event: string, ...args: any[]): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(...args);
        } catch (error) {
          logger.error(`Error in event handler for ${event}:`, error);
        }
      }
    }
  }

  /**
   * Register event listener
   * @param event Event name
   * @param handler Handler function
   */
  // eslint-disable-next-line @typescript-eslint/ban-types
  on(event: string, handler: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);
  }

  /**
   * Remove event listener
   * @param event Event name
   * @param handler Handler function
   */
  // eslint-disable-next-line @typescript-eslint/ban-types
  off(event: string, handler: Function): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  /**
   * Get human-readable info
   * @returns Formatted string
   */
  toString(): string {
    const stats = this.getStats();
    return (
      `StreamBuffer: ${stats.size}/${stats.maxSize} items ` +
      `(${stats.usagePercent.toFixed(1)}%) - ` +
      `${stats.isPaused ? 'PAUSED' : 'ACTIVE'}`
    );
  }
}
