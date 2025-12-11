/**
 * @fileoverview Global safe objects injector
 *
 * Injects only safe built-in globals into sandbox:
 * - Optional: setTimeout, setInterval, clearTimeout, clearInterval
 *
 * Does NOT inject (security):
 * - process, Buffer, require
 * - Function, eval, constructor access
 * - Node.js APIs (fs, path, http, etc.)
 * - Standard built-ins (Object, Array, etc.) as they are intrinsic to the isolate
 */

import ivm from 'isolated-vm';

/**
 * Inject safe global objects into sandbox context
 */
export class GlobalsInjector {
  private allowTimers: boolean;
  private activeTimers: Map<number, NodeJS.Timeout> = new Map();
  private timerIdCounter = 0;

  /**
   * Create globals injector
   * @param allowTimers Whether to inject timer functions
   */
  constructor(allowTimers: boolean = false) {
    this.allowTimers = allowTimers;
  }

  /**
   * Get safe globals to inject
   * @returns Object with safe globals
   */
  getSafeGlobals(): Record<string, any> {
    // isolated-vm provides standard JS globals (Object, Array, etc.) intrinsically.
    // We should NOT inject Host versions of these.
    return {};
  }

  /**
   * Get globals including timers (if enabled)
   */
  getAllGlobals(): Record<string, any> {
    const globals = this.getSafeGlobals();

    if (this.allowTimers) {
      // Wrapper for setTimeout to handle ivm.Callback/Reference
      globals['setTimeout'] = (callback: any, delay: number, ...args: any[]) => {
          if (typeof callback === 'object' && (callback.applySync || callback.apply)) {
              const id = ++this.timerIdCounter;
              const timer = setTimeout(() => {
                  this.activeTimers.delete(id);
                  try {
                      // Call the function in the sandbox
                      callback.applySync ? callback.applySync(undefined, args) : callback.apply(undefined, args);
                  } catch (e) {
                      // Isolate might be disposed
                  }
              }, delay);
              this.activeTimers.set(id, timer);
              return id; // Return primitive ID
          }
      };

      globals['setInterval'] = (callback: any, delay: number, ...args: any[]) => {
         if (typeof callback === 'object' && (callback.applySync || callback.apply)) {
             const id = ++this.timerIdCounter;
             const timer = setInterval(() => {
                  try {
                       callback.applySync ? callback.applySync(undefined, args) : callback.apply(undefined, args);
                  } catch (e) {
                      // Stop interval if execution fails (e.g. isolate disposed)
                      clearInterval(timer);
                      this.activeTimers.delete(id);
                  }
             }, delay);
             this.activeTimers.set(id, timer);
             return id; // Return primitive ID
         }
      };

      globals['clearTimeout'] = (id: any) => {
          if (typeof id === 'number' && this.activeTimers.has(id)) {
              clearTimeout(this.activeTimers.get(id));
              this.activeTimers.delete(id);
          }
      };
      globals['clearInterval'] = (id: any) => {
          if (typeof id === 'number' && this.activeTimers.has(id)) {
              clearInterval(this.activeTimers.get(id));
              this.activeTimers.delete(id);
          }
      };
    }

    return globals;
  }

  /**
   * Clear all active timers
   */
  dispose(): void {
    for (const timer of this.activeTimers.values()) {
      clearTimeout(timer);
      clearInterval(timer);
    }
    this.activeTimers.clear();
  }

  /**
   * Get list of blacklisted globals (should not be injected)
   */
  getBlacklist(): Set<string> {
    return new Set([
      'process',
      'Buffer',
      'require',
      'module',
      'exports',
      'Function',
      'eval',
      'constructor',
      '__proto__',
      'prototype',
      'fs',
      'path',
      'http',
      'https',
      'net',
      'dgram',
      'child_process',
      'cluster',
      'crypto',
      'os',
      'stream',
      'util',
      'v8',
      'vm',
      'worker_threads',
    ]);
  }

  /**
   * Check if identifier is safe to inject
   * @param name Identifier name
   * @returns True if safe
   */
  isSafe(name: string): boolean {
    return !this.getBlacklist().has(name);
  }

  /**
   * Create a safe proxy for global access
   * @param obj Object to wrap
   * @returns Proxied object
   */
  createSafeProxy(obj: any): any {
    const blacklist = this.getBlacklist();

    return new Proxy(obj, {
      get: (target, prop) => {
        if (typeof prop === 'string' && !this.isSafe(prop)) {
          throw new ReferenceError(`${prop} is not defined`);
        }
        return Reflect.get(target, prop);
      },

      set: (target, prop) => {
        if (typeof prop === 'string' && blacklist.has(prop)) {
          throw new TypeError(`Cannot assign to read-only property ${String(prop)}`);
        }
        return Reflect.set(target, target, prop);
      },

      has: (target, prop) => {
        if (typeof prop === 'string' && !this.isSafe(prop)) {
          return false;
        }
        return Reflect.has(target, prop);
      },

      ownKeys: (target) => {
        return Reflect.ownKeys(target).filter(
          (key) => typeof key === 'string' && this.isSafe(key)
        );
      },
    });
  }
}
