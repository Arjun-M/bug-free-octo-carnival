/**
 * @file src/modules/ModuleSystem.ts
 * @description Module resolution and loading system with support for whitelisted packages, virtual filesystem modules, circular dependency detection, and mocking. Provides a secure require() implementation for sandboxed code.
 * @since 1.0.0
 * @copyright Copyright (c) 2025 Arjun-M. This source code is licensed under the MIT license.
 */

import type { RequireOptions } from '../core/types.js';
import { SandboxError } from '../core/types.js';
import { ModuleCache } from './ModuleCache.js';
import { CircularDeps } from './CircularDeps.js';
import { ImportResolver } from './ImportResolver.js';
import { MemFS } from '../filesystem/MemFS.js';
import { logger } from '../utils/Logger.js';

/**
 * Module resolution and loading system for sandboxed environments.
 *
 * Provides a secure require() implementation that:
 * - Enforces module whitelisting for external packages
 * - Loads modules from virtual filesystem
 * - Detects and prevents circular dependencies
 * - Supports module mocking for testing
 * - Optionally allows built-in Node.js modules
 *
 * The system caches loaded modules and tracks loading state to detect cycles.
 * All external module loading is disabled by default for security.
 *
 * @class ModuleSystem
 * @example
 * ```typescript
 * const moduleSystem = new ModuleSystem({
 *   whitelist: ['lodash'],
 *   mocks: { 'fake-module': { value: 42 } },
 *   allowBuiltins: true,
 *   memfs
 * });
 *
 * const lodash = moduleSystem.require('lodash', '/');
 * const myModule = moduleSystem.require('./myModule', '/src/index.js');
 * ```
 */
export class ModuleSystem {
  private whitelist: Set<string>;
  private mocks: Map<string, any>;
  private cache: ModuleCache;
  private circularDeps: CircularDeps;
  private importResolver: ImportResolver;
  private memfs: MemFS;
  private builtins: Set<string> = new Set([
    'path',
    'url',
    'util',
    'buffer',
    'stream',
  ]);
  private allowBuiltins: boolean;

  constructor(
    options: RequireOptions & { memfs: MemFS },
    memfs?: MemFS // Optional second arg if provided in options
  ) {
    this.memfs = memfs || options.memfs;
    this.allowBuiltins = options.allowBuiltins ?? false;
    this.cache = new ModuleCache();
    this.circularDeps = new CircularDeps();
    this.importResolver = new ImportResolver(this.memfs);

    this.whitelist = new Set(options.whitelist || []);
    this.mocks = new Map(Object.entries(options.mocks || {}));

    logger.debug(
      `ModuleSystem ready (${this.whitelist.size} allowed modules)`
    );
  }

  /**
   * Load and return a module.
   *
   * Resolves the module path, checks cache, detects circular dependencies, and loads
   * from appropriate source (virtual filesystem, built-in, whitelisted, or mock).
   *
   * @param moduleName - Module specifier (e.g., 'lodash', './utils', '/src/file')
   * @param fromPath - Path of the requiring module (default: '/')
   * @returns Loaded module exports
   * @throws {SandboxError} CIRCULAR_DEPENDENCY if circular dependency detected
   * @throws {SandboxError} MODULE_NOT_ALLOWED if built-in module not allowed
   * @throws {SandboxError} MODULE_NOT_WHITELISTED if external module not whitelisted
   * @throws {SandboxError} MODULE_LOAD_ERROR if loading fails
   */
  require(moduleName: string, fromPath: string = '/'): any {
    logger.debug(`require('${moduleName}') from ${fromPath}`);

    if (this.isMocked(moduleName)) {
      return this.mocks.get(moduleName);
    }

    // CRITICAL FIX: The cache key must be the resolved path, not the original moduleName.
    // This prevents cache collisions between modules with the same name in different directories.
    const resolvedPath = this.importResolver.resolve(moduleName, fromPath);

    if (this.cache.has(resolvedPath)) {
      return this.cache.get(resolvedPath);
    }

    // Cycle detection
    const stack = this.circularDeps.getStack();
    if (this.circularDeps.detectCircular(moduleName, stack)) {
      const circlePath = this.circularDeps.getCircularPath(moduleName, stack);
      throw new SandboxError(
        `Circular dependency: ${circlePath?.join(' -> ')}`,
        'CIRCULAR_DEPENDENCY',
        { module: moduleName, stack, circlePath }
      );
    }

    this.circularDeps.startLoading(resolvedPath);

    try {
      let module: any;

      // CRITICAL FIX: All local/relative modules should be loaded via loadVirtual.
      // The check for built-in and whitelisted modules should only apply to bare specifiers.
      if (moduleName.startsWith('.') || moduleName.startsWith('/')) {
        module = this.loadVirtual(resolvedPath);
      } else if (this.isBuiltin(moduleName)) {
        if (!this.allowBuiltins) {
          throw new SandboxError(
            `Built-in not allowed: ${moduleName}`,
            'MODULE_NOT_ALLOWED'
          );
        }
        module = this.loadBuiltin(moduleName);
      } else if (this.isWhitelisted(moduleName)) {
        module = this.loadExternal(moduleName);
      } else {
        throw new SandboxError(
          `Module denied: ${moduleName}`,
          'MODULE_NOT_WHITELISTED'
        );
      }

      this.cache.set(resolvedPath, module);
      return module;
    } finally {
      this.circularDeps.finishLoading(resolvedPath);
    }
  }

  /**
   * Check if a module is whitelisted for loading.
   *
   * Supports glob-style patterns (* and ? wildcards).
   *
   * @param moduleName - Module name to check
   * @returns True if module is whitelisted
   */
  isWhitelisted(moduleName: string): boolean {
    for (const pattern of this.whitelist) {
      if (this.matchPattern(moduleName, pattern)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Check if a module has a mock registered.
   *
   * @param moduleName - Module name to check
   * @returns True if module is mocked
   */
  isMocked(moduleName: string): boolean {
    return this.mocks.has(moduleName);
  }

  /**
   * Get the mock implementation for a module.
   *
   * @param moduleName - Module name
   * @returns Mock implementation
   */
  getMock(moduleName: string): any {
    return this.mocks.get(moduleName);
  }

  /**
   * Check if a module name is a built-in Node.js module.
   *
   * @param moduleName - Module name to check
   * @returns True if built-in module
   */
  private isBuiltin(moduleName: string): boolean {
    return this.builtins.has(moduleName);
  }

  /**
   * Load a module from the virtual filesystem.
   *
   * Currently not fully implemented as it requires VM-side code execution.
   * Virtual modules must be executed within the isolate context.
   *
   * @param path - Absolute path to module in virtual filesystem
   * @returns Module exports
   * @throws {SandboxError} MODULE_LOAD_UNIMPLEMENTED - feature not yet implemented
   * @throws {SandboxError} MODULE_LOAD_ERROR if loading fails
   */
  private loadVirtual(path: string): any {
    try {
      const code = this.memfs.read(path).toString();

      // CRITICAL: Virtual module loading requires code execution within the VM context.
      // The ModuleSystem cannot execute code by itself (host security risk).
      // 
      // Solution options:
      // 1. Pass an executor function from IsoBox that runs code in the VM
      // 2. Use a callback-based approach for module instantiation
      // 3. Store code and defer execution to the VM (lazy loading)
      //
      // For now, throw an explicit error indicating this isn't supported:
      throw new SandboxError(
        `Virtual module loading not yet implemented. Module path: ${path}`,
        'MODULE_LOAD_UNIMPLEMENTED',
        { path, message: 'Virtual modules require VM-side code execution' }
      );

    } catch (error) {
      if (error instanceof SandboxError) throw error;
      throw new SandboxError(
        `Load failed: ${path}`,
        'MODULE_LOAD_ERROR',
        { path, error: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * Load a built-in Node.js module polyfill.
   *
   * Provides simplified implementations of common Node.js modules for sandbox use.
   * Not full implementations - only safe subsets.
   *
   * @param moduleName - Built-in module name (e.g., 'path', 'buffer')
   * @returns Module polyfill implementation
   */
  private loadBuiltin(moduleName: string): any {
    const builtins: Record<string, any> = {
      path: {
        join: (...parts: string[]) => parts.join('/'),
        dirname: (p: string) => p.split('/').slice(0, -1).join('/') || '/',
        basename: (p: string) => p.split('/').pop() || '',
        resolve: (...parts: string[]) => '/' + parts.join('/'),
      },
      url: {
        parse: (url: string) => ({ href: url }),
        format: (url: any) => url.href,
      },
      util: {
        inspect: (obj: any) => JSON.stringify(obj),
      },
      // MAJOR FIX: Buffer must be exported as a property of the module object
      buffer: {
        Buffer: Buffer, // Now accessible as require('buffer').Buffer or const { Buffer } = require('buffer')
      },
      stream: {
        Readable: class {},
        Writable: class {},
        Transform: class {},
      },
    };

    return builtins[moduleName] || {};
  }

  /**
   * Load an external module from host environment.
   *
   * SECURITY NOTE: Currently disabled to prevent sandbox escape. External modules
   * should be bundled into virtual filesystem or provided as mocks.
   *
   * @param moduleName - External module name
   * @returns Module exports
   * @throws {SandboxError} EXTERNAL_MODULES_DISABLED - feature disabled for security
   */
  private loadExternal(moduleName: string): any {
    // SECURITY NOTE: Loading from host node_modules is disabled to prevent sandbox escape.
    // If external modules are needed, they should be:
    // 1. Bundled into the virtual filesystem before execution
    // 2. Loaded as whitelisted packages from a secure source
    // 3. Mocked via the ModuleSystem.mocks configuration
    
    logger.error(`External module requested but disabled: ${moduleName}`);

    throw new SandboxError(
      `External modules disabled for security. Use mocks or whitelisted packages instead: ${moduleName}`,
      'EXTERNAL_MODULES_DISABLED',
      { 
        module: moduleName,
        suggestion: 'Use options.mocks to provide module implementations or bundle modules into the virtual filesystem'
      }
    );
  }

  /**
   * Check if a name matches a glob-style pattern.
   *
   * Supports * (any characters) and ? (single character) wildcards.
   *
   * @param name - Name to test
   * @param pattern - Pattern with wildcards
   * @returns True if name matches pattern
   */
  private matchPattern(name: string, pattern: string): boolean {
    if (name === pattern) return true;
    const regexPattern = pattern
      .replace(/\./g, '\\.')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    return new RegExp(`^${regexPattern}$`).test(name);
  }

  /**
   * Clear module cache and circular dependency tracking.
   */
  clear(): void {
    this.cache.clear();
    this.circularDeps.clear();
  }

  /**
   * Get module cache statistics.
   *
   * @returns Cache stats including size, hits, misses, and hit rate
   */
  getCacheStats(): any {
    return this.cache.getStats();
  }

  /**
   * Get list of whitelisted module patterns.
   *
   * @returns Array of whitelist patterns
   */
  getWhitelist(): string[] {
    return Array.from(this.whitelist);
  }

  /**
   * Add a module to the whitelist.
   *
   * @param moduleName - Module name or pattern to whitelist
   */
  addToWhitelist(moduleName: string): void {
    this.whitelist.add(moduleName);
  }

  /**
   * Remove a module from the whitelist.
   *
   * @param moduleName - Module name or pattern to remove
   */
  removeFromWhitelist(moduleName: string): void {
    this.whitelist.delete(moduleName);
  }
}
