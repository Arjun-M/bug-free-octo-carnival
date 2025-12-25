/**
 * @file src/context/GlobalsInjector.ts
 * @description Global safe objects injector for sandbox environments. Provides optional timer functions while blocking dangerous Node.js APIs and eval-like constructs for security.
 * @since 1.0.0
 * @copyright Copyright (c) 2025 Arjun-M. This source code is licensed under the MIT license.
 */

import ivm from 'isolated-vm';

/**
 * Injects safe global objects into sandbox contexts.
 *
 * Provides optional timer functions (setTimeout, setInterval) while explicitly
 * blocking dangerous globals for security:
 * - process, Buffer, require, module, exports
 * - Function, eval, constructor access
 * - Node.js APIs (fs, path, http, child_process, etc.)
 *
 * Standard JavaScript globals (Object, Array, etc.) are provided intrinsically
 * by isolated-vm and are not injected by this class.
 *
 * @class GlobalsInjector
 * @example
 * ```typescript
 * const injector = new GlobalsInjector(true); // Enable timers
 * const globals = injector.getAllGlobals();
 *
 * // globals.setTimeout is available
 * // globals.process is NOT available (blacklisted)
 * ```
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
    // However, explicitly ensuring these are available can be helpful if context setup varies.
    // We explicitly explicitly rely on the VM's intrinsic globals.
    // If we wanted to polyfill missing ones, we would do it here.
    return {
      // Standard globals like Object, Array, Date, Promise are provided by the Isolate.
    };
  }

  /**
   * Get globals including timers (if enabled)
   */
  getAllGlobals(): Record<string, any> {
    const globals = this.getSafeGlobals();

    if (this.allowTimers) {
      // Wrapper for setTimeout to handle ivm.Callback/Reference
      globals['setTimeout'] = (callback: any, delay: number, ...args: any[]) => {
          // Ensure callback is an ivm.Reference (which includes ivm.Callback)
          // This prevents arbitrary host functions from being executed by the sandbox.
          if (callback instanceof ivm.Reference) {
              const id = ++this.timerIdCounter;
              const timer = setTimeout(() => {
                  this.activeTimers.delete(id);
                  try {
                      // Call the function in the sandbox
                      // Use applyIgnored for async execution to avoid blocking the host thread and ignoring result
                      callback.applyIgnored(undefined, args);
                  } catch (e) {
                      // Isolate might be disposed
                  }
              }, delay);
              this.activeTimers.set(id, timer);
              return id; // Return primitive ID
          }
          return 0; // Return 0 for invalid callback
      };

      globals['setInterval'] = (callback: any, delay: number, ...args: any[]) => {
         // Ensure callback is an ivm.Reference
         if (callback instanceof ivm.Reference) {
             const id = ++this.timerIdCounter;
             const timer = setInterval(() => {
                  try {
                       // Use applyIgnored for async execution
                       callback.applyIgnored(undefined, args);
                  } catch (e) {
                      // Stop interval if execution fails (e.g. isolate disposed)
                      clearInterval(timer);
                      this.activeTimers.delete(id);
                  }
             }, delay);
             this.activeTimers.set(id, timer);
             return id; // Return primitive ID
         }
         return 0; // Return 0 for invalid callback
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
