/**
 * @fileoverview Global safe objects injector
 *
 * Injects only safe built-in globals into sandbox:
 * - Object, Array, String, Number, Boolean, Date, Math, JSON
 * - Promise, Set, Map, WeakMap, WeakSet
 * - Error types
 * - Optional: setTimeout, setInterval, clearTimeout, clearInterval
 *
 * Does NOT inject (security):
 * - process, Buffer, require
 * - Function, eval, constructor access
 * - Node.js APIs (fs, path, http, etc.)
 */

/**
 * Inject safe global objects into sandbox context
 */
export class GlobalsInjector {
  private allowTimers: boolean;

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
    return {
      // Global reference
      globalThis: globalThis,

      // Built-in constructors (safe)
      Object,
      Array,
      String,
      Number,
      Boolean,
      Symbol,
      Date,
      Math,
      JSON,
      Promise,
      Set,
      Map,
      WeakMap,
      WeakSet,

      // Error types
      Error,
      TypeError,
      RangeError,
      ReferenceError,
      SyntaxError,
      EvalError,
      URIError,

      // Type checking
      isNaN,
      isFinite,
      parseInt,
      parseFloat,
      encodeURI,
      decodeURI,
      encodeURIComponent,
      decodeURIComponent,
    };
  }

  /**
   * Get globals including timers (if enabled)
   */
  getAllGlobals(): Record<string, any> {
    const globals = this.getSafeGlobals();

    if (this.allowTimers) {
      globals['setTimeout'] = setTimeout;
      globals['setInterval'] = setInterval;
      globals['clearTimeout'] = clearTimeout;
      globals['clearInterval'] = clearInterval;
    }

    return globals;
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
