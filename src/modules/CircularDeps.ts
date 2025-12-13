/**
 * @file src/modules/CircularDeps.ts
 * @description Circular dependency detection for module loading. Tracks currently loading modules and identifies circular references to prevent infinite loops.
 * @since 1.0.0
 * @copyright Copyright (c) 2025 Arjun-M. This source code is licensed under the MIT license.
 */

/**
 * Tracks circular dependencies during module loading.
 *
 * Maintains a stack of currently loading modules and provides methods to detect
 * circular references before they cause infinite loops.
 *
 * @class CircularDeps
 * @example
 * ```typescript
 * const deps = new CircularDeps();
 * deps.startLoading('moduleA');
 * deps.startLoading('moduleB');
 *
 * if (deps.detectCircular('moduleA', deps.getStack())) {
 *   const path = deps.getCircularPath('moduleA', deps.getStack());
 *   console.log(`Circular: ${path.join(' -> ')}`);
 * }
 * ```
 */
export class CircularDeps {
  private loadingStack: Set<string> = new Set();

  /**
   * Check if loading a module would create a circular dependency
   * @param moduleName Module being loaded
   * @param stack Stack of currently loading modules
   * @returns True if circular dependency detected
   */
  detectCircular(moduleName: string, stack: string[]): boolean {
    return stack.includes(moduleName);
  }

  /**
   * Get the circular dependency path if one exists
   * @param moduleName Module being loaded
   * @param stack Stack of currently loading modules
   * @returns Array representing circular path, or null
   */
  getCircularPath(moduleName: string, stack: string[]): string[] | null {
    const index = stack.indexOf(moduleName);
    if (index === -1) {
      return null;
    }
    return [...stack.slice(index), moduleName];
  }

  /**
   * Start loading a module (push to stack)
   * @param moduleName Module being loaded
   * @returns True if already loading (circular), false if ok
   */
  startLoading(moduleName: string): boolean {
    if (this.loadingStack.has(moduleName)) {
      return true;
    }
    this.loadingStack.add(moduleName);
    return false;
  }

  /**
   * Finish loading a module (pop from stack)
   * @param moduleName Module that finished loading
   */
  finishLoading(moduleName: string): void {
    this.loadingStack.delete(moduleName);
  }

  /**
   * Get current loading stack
   * @returns Array of modules currently being loaded
   */
  getStack(): string[] {
    return Array.from(this.loadingStack);
  }

  /**
   * Clear the loading stack
   */
  clear(): void {
    this.loadingStack.clear();
  }

  /**
   * Check if any modules are currently loading
   * @returns True if loading modules exist
   */
  isLoading(): boolean {
    return this.loadingStack.size > 0;
  }
}
