/**
 * @fileoverview IsolateManager - Manages the lifecycle of isolated-vm instances.
 *
 * Provides centralized management for creating, tracking, and disposing of isolates
 * to prevent resource leaks and enable proper cleanup.
 */

import ivm from 'isolated-vm';

/**
 * Handles creation, tracking, and disposal of isolates.
 *
 * The IsolateManager maintains a registry of all created isolates and ensures
 * proper cleanup when they're no longer needed. Each isolate represents a completely
 * isolated JavaScript execution environment.
 *
 * @example
 * ```typescript
 * const manager = new IsolateManager();
 * const isolate = manager.create({ memoryLimit: 128 * 1024 * 1024 });
 * // Use isolate...
 * await manager.disposeAll();
 * ```
 *
 * @see {@link https://github.com/laverdet/isolated-vm isolated-vm documentation}
 */
export class IsolateManager {
  private isolates: Map<string, ivm.Isolate> = new Map();
  private idCounter: number = 0;

  /**
   * Create and track a new isolate.
   *
   * Creates a new isolated-vm Isolate with the specified memory limit and
   * automatically tracks it for lifecycle management.
   *
   * @param options - Isolate configuration options
   * @param options.memoryLimit - Memory limit in bytes (converted to MB for isolated-vm)
   *
   * @returns The created isolate instance
   *
   * @example
   * ```typescript
   * const isolate = manager.create({ memoryLimit: 256 * 1024 * 1024 }); // 256MB
   * const context = isolate.createContextSync();
   * ```
   *
   * @see {@link track}
   */
  create(options?: { memoryLimit?: number }): ivm.Isolate {
    const isolateOptions: ivm.IsolateOptions = {};
    if (options?.memoryLimit) {
      // isolated-vm expects memoryLimit in MB
      isolateOptions.memoryLimit = Math.max(
        8,
        Math.ceil(options.memoryLimit / (1024 * 1024))
      );
    }

    const isolate = new ivm.Isolate(isolateOptions);
    const id = this.generateId();

    this.track(id, isolate);
    return isolate;
  }

  /**
   * Track an existing isolate.
   *
   * Registers an isolate with the manager for lifecycle tracking.
   *
   * @param id - Unique identifier for the isolate
   * @param isolate - The isolate instance to track
   *
   * @throws {Error} If an isolate with the same ID is already tracked
   *
   * @example
   * ```typescript
   * const isolate = new ivm.Isolate({ memoryLimit: 128 });
   * manager.track('custom-id', isolate);
   * ```
   */
  track(id: string, isolate: ivm.Isolate): void {
    if (this.isolates.has(id)) {
      throw new Error(`Isolate ${id} already tracked`);
    }
    this.isolates.set(id, isolate);
  }

  /**
   * Get a tracked isolate by ID.
   *
   * @param id - Isolate identifier
   * @returns The isolate instance, or undefined if not found
   *
   * @example
   * ```typescript
   * const isolate = manager.get('iso-1');
   * if (isolate) {
   *   const context = isolate.createContextSync();
   * }
   * ```
   */
  get(id: string): ivm.Isolate | undefined {
    return this.isolates.get(id);
  }

  /**
   * Stop tracking an isolate without disposing it.
   *
   * Removes the isolate from the manager's registry but does not call dispose().
   * Useful when you want to manage the isolate's lifecycle manually.
   *
   * @param id - Isolate identifier
   *
   * @example
   * ```typescript
   * manager.untrack('iso-1');
   * // Isolate still exists but is no longer managed
   * ```
   */
  untrack(id: string): void {
    this.isolates.delete(id);
  }

  /**
   * Dispose a specific isolate and stop tracking it.
   *
   * Calls dispose() on the isolate and removes it from the registry.
   * Safe to call multiple times.
   *
   * @param id - Isolate identifier
   *
   * @example
   * ```typescript
   * manager.dispose('iso-1');
   * ```
   *
   * @see {@link disposeAll}
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
   * Dispose all tracked isolates.
   *
   * Disposes every isolate registered with the manager and clears the registry.
   * Typically called during sandbox shutdown.
   *
   * @returns Promise that resolves when all isolates are disposed
   *
   * @example
   * ```typescript
   * await manager.disposeAll();
   * console.log('All isolates cleaned up');
   * ```
   *
   * @see {@link dispose}
   */
  async disposeAll(): Promise<void> {
    for (const id of this.isolates.keys()) {
      this.dispose(id);
    }
    this.isolates.clear();
  }

  /**
   * Generate a unique isolate identifier.
   *
   * @private
   * @returns Unique ID string in format "iso-{counter}-{timestamp}"
   */
  private generateId(): string {
    return `iso-${++this.idCounter}-${Date.now().toString(36)}`;
  }

  /**
   * Get statistics about managed isolates.
   *
   * @returns Object containing active isolate count and total created
   *
   * @example
   * ```typescript
   * const stats = manager.getStats();
   * console.log(`Active: ${stats.active}, Total created: ${stats.total}`);
   * ```
   */
  getStats(): { active: number; total: number } {
    return {
      active: this.isolates.size,
      total: this.idCounter,
    };
  }
}
