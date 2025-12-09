/**
 * @fileoverview Event emitter for IsoBox events
 */

type EventHandler = (...args: any[]) => void;

/**
 * Simple event emitter
 */
export class EventEmitter {
  private listeners: Map<string, Set<EventHandler>> = new Map();

  /**
   * Register event listener
   * @param event Event name
   * @param handler Handler function
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
   * @param event Event name
   * @param args Arguments to pass to handlers
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
   * @param event Event name
   * @param handler Handler function
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
   * @param event Event name (optional, removes all if not specified)
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
