/**
 * Manages the lifecycle of isolated-vm instances.
 */

import ivm from 'isolated-vm';

/**
 * Handles creation, tracking, and disposal of isolates.
 */
export class IsolateManager {
  private isolates: Map<string, ivm.Isolate> = new Map();
  private idCounter: number = 0;

  /**
   * Create and track a new isolate.
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
   * Dispose a specific isolate.
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
