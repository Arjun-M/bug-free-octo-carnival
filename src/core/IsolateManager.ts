/**
 * @fileoverview IsolateManager manages isolated-vm instances
 */

import type { Isolate } from 'isolated-vm';

/**
 * Manages lifecycle of isolated-vm isolates with tracking and pooling
 */
export class IsolateManager {
  private isolates: Map<string, Isolate> = new Map();
  private idCounter: number = 0;

  /**
   * Create a new isolate with the given options
   * @param options Isolate creation options
   * @returns A new Isolate instance
   */
  createIsolate(options?: { memoryLimit?: number }): Isolate {
    // Type assertion needed since isolated-vm types may not be fully available
    // This will be populated with actual isolated-vm API in session 2
    const IsolateClass = globalThis.Isolate as any;
    if (!IsolateClass) {
      throw new Error('isolated-vm Isolate not available');
    }

    const isolateOptions: Record<string, any> = {};
    if (options?.memoryLimit) {
      isolateOptions.memoryLimit = Math.max(
        10,
        options.memoryLimit / (1024 * 1024)
      );
    }

    return new IsolateClass(isolateOptions);
  }

  /**
   * Track an isolate by ID
   * @param id Unique isolate identifier
   * @param isolate The isolate instance to track
   */
  trackIsolate(id: string, isolate: Isolate): void {
    if (this.isolates.has(id)) {
      throw new Error(`Isolate with id ${id} already tracked`);
    }
    this.isolates.set(id, isolate);
  }

  /**
   * Get a tracked isolate by ID
   * @param id Isolate identifier
   * @returns The isolate if found, undefined otherwise
   */
  getIsolate(id: string): Isolate | undefined {
    return this.isolates.get(id);
  }

  /**
   * Remove an isolate from tracking
   * @param id Isolate identifier
   */
  removeIsolate(id: string): void {
    this.isolates.delete(id);
  }

  /**
   * Dispose a single isolate
   * @param id Isolate identifier
   */
  async disposeIsolate(id: string): Promise<void> {
    const isolate = this.isolates.get(id);
    if (isolate) {
      try {
        await isolate.dispose();
      } catch (err) {
        // Isolate may already be disposed
      }
      this.isolates.delete(id);
    }
  }

  /**
   * Dispose all tracked isolates
   */
  async disposeAll(): Promise<void> {
    const disposePromises = Array.from(this.isolates.keys()).map((id) =>
      this.disposeIsolate(id)
    );
    await Promise.all(disposePromises);
    this.isolates.clear();
  }

  /**
   * Generate a unique isolate ID
   * @returns A new unique ID
   */
  generateId(): string {
    return `isolate-${++this.idCounter}-${Date.now()}`;
  }

  /**
   * Get statistics about tracked isolates
   * @returns Object containing active and total isolate counts
   */
  getStats(): { active: number; total: number } {
    return {
      active: this.isolates.size,
      total: this.idCounter,
    };
  }
}
