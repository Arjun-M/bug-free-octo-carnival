/**
 * @file src/utils/EventEmitter.ts
 * @description Simple event emitter for IsoBox internal events
 * @since 1.0.0
 * @copyright Copyright (c) 2025 Arjun-M. This source code is licensed under the MIT license.
 */

type EventHandler = (...args: any[]) => void;

/**
 * @class EventEmitter
 * Simple event emitter for publish-subscribe pattern.
 * Provides safe error handling for event listeners.
 *
 * @example
 * ```typescript
 * // Create emitter
 * const emitter = new EventEmitter();
 *
 * // Register listener
 * emitter.on('data', (value) => {
 *   console.log('Received:', value);
 * });
 *
 * // One-time listener
 * emitter.once('ready', () => {
 *   console.log('Ready!');
 * });
 *
 * // Emit events
 * emitter.emit('data', 42);
 * emitter.emit('ready');
 *
 * // Remove listener
 * const handler = () => console.log('test');
 * emitter.on('test', handler);
 * emitter.off('test', handler);
 *
 * // Check listeners
 * console.log('Event names:', emitter.eventNames());
 * console.log('Listener count:', emitter.listenerCount('data'));
 * ```
 */
export class EventEmitter {
  private listeners: Map<string, Set<EventHandler>> = new Map();

  /**
   * Register event listener
   * @param event - Event name
   * @param handler - Handler function
   *
   * @example
   * ```typescript
   * emitter.on('message', (msg) => console.log(msg));
   * ```
   */
  on(event: string, handler: EventHandler): void {
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
  off(event: string, handler: EventHandler): void {
    if (!this.listeners.has(event)) {
      return;
    }
    this.listeners.get(event)!.delete(handler);
  }

  /**
   * Emit event
   * @param event - Event name
   * @param args - Arguments to pass to handlers
   *
   * @example
   * ```typescript
   * emitter.emit('data', { id: 1, value: 'test' });
   * ```
   */
  emit(event: string, ...args: any[]): void {
    if (!this.listeners.has(event)) {
      return;
    }

    const handlers = this.listeners.get(event)!;
    for (const handler of handlers) {
      try {
        handler(...args);
      } catch (error) {
        // Log error but don't throw
        console.error(`Error in event handler for '${event}':`, error);
      }
    }
  }

  /**
   * Register one-time event listener
   * @param event - Event name
   * @param handler - Handler function (will be called only once)
   *
   * @example
   * ```typescript
   * emitter.once('init', () => {
   *   console.log('Initialized once!');
   * });
   * ```
   */
  once(event: string, handler: EventHandler): void {
    const wrapper = (...args: any[]) => {
      handler(...args);
      this.off(event, wrapper);
    };
    this.on(event, wrapper);
  }

  /**
   * Remove all listeners for event
   * @param event - Event name (optional, removes all if not specified)
   */
  removeAllListeners(event?: string): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }

  /**
   * Get listener count
   * @param event Event name
   */
  listenerCount(event: string): number {
    return this.listeners.get(event)?.size ?? 0;
  }

  /**
   * Get all event names
   */
  eventNames(): string[] {
    return Array.from(this.listeners.keys());
  }
}
