/**
 * @file src/isolate/IsolateManager.ts
 * @description Manages the lifecycle of isolated-vm instances including creation, tracking, and disposal. Provides centralized isolate management with automatic ID generation and cleanup.
 * @since 1.0.0
 * @copyright Copyright (c) 2025 Arjun-M. This source code is licensed under the MIT license.
 */

import ivm from 'isolated-vm';

/**
 * Manages the lifecycle of isolated-vm instances.
 *
 * Provides centralized management for creating, tracking, and disposing isolates.
 * Automatically generates unique IDs for each isolate and maintains a registry
 * for lookup and cleanup operations.
 *
 * @class IsolateManager
 * @example
 * ```typescript
 * const manager = new IsolateManager();
 * const { id, isolate } = manager.create({ memoryLimit: 128 * 1024 * 1024 });
 *
 * // Use isolate...
 *
 * manager.dispose(id); // Clean up when done
 * ```
 */
export class IsolateManager {
  private isolates: Map<string, ivm.Isolate> = new Map();
  private idCounter: number = 0;

  /**
   * Create and track a new isolate.
   * @returns The created isolate and its tracking ID.
   */
  create(options?: { memoryLimit?: number }): { id: string; isolate: ivm.Isolate } {
    const isolateOptions: ivm.IsolateOptions = {};
    if (options?.memoryLimit) {
      // isolated-vm expects memoryLimit in MB
      // MAJOR FIX: Ensure memoryLimit is converted from bytes to MB and is at least 8MB
      isolateOptions.memoryLimit = Math.max(
        8,
        Math.ceil(options.memoryLimit / (1024 * 1024))
      );
    }

    const isolate = new ivm.Isolate(isolateOptions);
    const id = this.generateId();

    this.track(id, isolate);
    return { id, isolate };
  }

  /**
   * Track an existing isolate.
   */
  track(id: string, isolate: ivm.Isolate): void {
    if (this.isolates.has(id)) {
      throw new Error(`Isolate ${id} already tracked`);
    }
    this.isolates.set(id, isolate);
  }

  /**
   * Get a tracked isolate.
   */
  get(id: string): ivm.Isolate | undefined {
    return this.isolates.get(id);
  }

  /**
   * Stop tracking an isolate (does not dispose it).
   */
  untrack(id: string): void {
    this.isolates.delete(id);
  }

  /**
   * Dispose a specific isolate by ID.
   */
  dispose(id: string): void {
    const isolate = this.isolates.get(id);
    if (isolate) {
      try {
        isolate.dispose();
      } catch (err) {
        // Ignore if already disposed
      }
      this.isolates.delete(id);
    }
  }

  /**
   * Dispose a specific isolate object and untrack it.
   * MAJOR FIX: Added this method to allow IsoBox.run() to dispose the isolate it created.
   */
  disposeIsolate(isolate: ivm.Isolate): void {
    // Find the ID of the isolate
    let foundId: string | undefined;
    for (const [id, trackedIsolate] of this.isolates.entries()) {
      if (trackedIsolate === isolate) {
        foundId = id;
        break;
      }
    }

    if (foundId) {
      this.dispose(foundId);
    } else {
      // If not tracked, dispose it anyway
      try {
        isolate.dispose();
      } catch (err) {
        // Ignore if already disposed
      }
    }
  }

  /**
   * Dispose all tracked isolates.
   */
  async disposeAll(): Promise<void> {
    for (const id of this.isolates.keys()) {
      this.dispose(id);
    }
    this.isolates.clear();
  }

  private generateId(): string {
    return `iso-${++this.idCounter}-${Date.now().toString(36)}`;
  }

  getStats(): { active: number; total: number } {
    return {
      active: this.isolates.size,
      total: this.idCounter,
    };
  }
}
