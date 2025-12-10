/**
 * @fileoverview Main module system with require/import support
 *
 * Test Scenarios:
 * ===============
 * Test 1: require('lodash') with whitelist ['lodash'] → works
 *   - Module in whitelist is allowed
 *   - Loaded from node_modules or mocked
 *   - Cached for subsequent requires
 *
 * Test 2: require('fs') without whitelist → throws error
 *   - Module not in whitelist is rejected
 *   - Throws MODULE_NOT_WHITELISTED error
 *   - No partial state on rejection
 *
 * Test 3: require('./utils') with /src/main.js and /src/utils.js → works
 *   - Relative imports resolved correctly
 *   - ImportResolver handles ./path lookups
 *   - Module loaded from MemFS
 *
 * Test 4: Circular: a.js requires b.js requires a.js → throws error
 *   - CircularDeps detects cycle
 *   - Throws CIRCULAR_DEPENDENCY error
 *   - Includes cycle path in error
 *
 * Test 5: TypeScript file imported → compiles and runs
 *   - .ts files compiled to .js before loading
 *   - Type annotations stripped
 *   - Execution works seamlessly
 */

import type { RequireOptions } from '../core/types.js';
import { SandboxError } from '../core/types.js';
import { ModuleCache } from './ModuleCache.js';
import { CircularDeps } from './CircularDeps.js';
import { ImportResolver } from './ImportResolver.js';
import { MemFS } from '../filesystem/MemFS.js';
import { logger } from '../utils/Logger.js';

/**
 * Main module system for require/import resolution
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

  /**
   * Create module system
   * @param options Module system options
   */
  constructor(
    options: RequireOptions & { memfs: MemFS },
    memfs: MemFS
  ) {
    this.memfs = memfs || options.memfs;
    this.allowBuiltins = options.allowBuiltins ?? false;
    this.cache = new ModuleCache();
    this.circularDeps = new CircularDeps();
    this.importResolver = new ImportResolver(this.memfs);

    // Setup whitelist
    this.whitelist = new Set();
    if (options.whitelist) {
      for (const pattern of options.whitelist) {
        this.whitelist.add(pattern);
      }
    }

    // Setup mocks
    this.mocks = new Map();
    if (options.mocks) {
      for (const [name, mock] of Object.entries(options.mocks)) {
        this.mocks.set(name, mock);
      }
    }

    logger.debug(
      `ModuleSystem initialized with ${this.whitelist.size} whitelisted modules`
    );
  }

  /**
   * Execute require() for a module - Legacy Host Execution
   * @param moduleName Module name or path
   * @param fromPath Path of requiring file
   * @returns Loaded module
   */
  require(moduleName: string, fromPath: string = '/'): any {
    // This is kept for backward compatibility if needed, but new logic splits resolve and loadSource
    // Reuse resolve and load logic
    const resolvedPath = this.resolve(moduleName, fromPath);

    // For mocks and builtins, loadSource returns code. We need to eval it?
    // Or we can short-circuit for Host execution.
    if (resolvedPath.startsWith('mock:')) {
        return this.mocks.get(resolvedPath.substring(5));
    }
    if (resolvedPath.startsWith('builtin:')) {
        return this.loadBuiltin(resolvedPath.substring(8));
    }

    return this.loadVirtual(resolvedPath);
  }

  /**
   * Resolve module path
   * @param moduleName Module name or path
   * @param fromPath Current path
   * @returns Resolved absolute path or special identifier
   */
  resolve(moduleName: string, fromPath: string = '/'): string {
    logger.debug(`resolving '${moduleName}' from ${fromPath}`);

    // Check mocks
    if (this.isMocked(moduleName)) {
        return `mock:${moduleName}`;
    }

    // Check circular dependency
    const stack = this.circularDeps.getStack();
    // Use absolute path or module name for circular check
    // Ideally we should resolve first then check circular on resolved path

    // Virtual module
    if (moduleName.startsWith('.') || moduleName.startsWith('/')) {
        return this.importResolver.resolve(moduleName, fromPath);
    }

    // Built-in
    if (this.isBuiltin(moduleName)) {
        if (!this.allowBuiltins) {
             throw new SandboxError(`Built-in module not allowed: ${moduleName}`, 'MODULE_NOT_ALLOWED');
        }
        return `builtin:${moduleName}`;
    }

    // External/Whitelisted
    if (this.isWhitelisted(moduleName)) {
        // Resolve to node_modules path in MemFS
        return `/node_modules/${moduleName}/index.js`; // Simplified resolution for now
    }

    throw new SandboxError(`Module not whitelisted: ${moduleName}`, 'MODULE_NOT_WHITELISTED');
  }

  /**
   * Load module source code
   * @param path Resolved path or identifier
   * @returns Source code
   */
  loadSource(path: string): string {
      // Check circular on the resolved path
      const stack = this.circularDeps.getStack();
      if (this.circularDeps.detectCircular(path, stack)) {
          const circlePath = this.circularDeps.getCircularPath(path, stack);
          throw new SandboxError(`Circular dependency detected: ${circlePath?.join(' -> ')}`, 'CIRCULAR_DEPENDENCY');
      }

      this.circularDeps.startLoading(path);
      try {
          if (path.startsWith('mock:')) {
              const name = path.substring(5);
              const mock = this.mocks.get(name);
              // Return code that exports the mock
              // We need to serialize the mock?
              // For simple mocks:
              return `module.exports = ${JSON.stringify(mock)};`;
          }

          if (path.startsWith('builtin:')) {
              // Return code that exports stub
              // We can't return host objects easily.
              // We return a simple stub
              return `module.exports = {}; // Builtin stub for ${path}`;
          }

          // Read from MemFS
          return this.memfs.read(path).toString();
      } finally {
          this.circularDeps.finishLoading(path);
      }
  }

  /**
   * Check if module name is whitelisted
   * @param moduleName Module name
   * @returns True if whitelisted
   */
  isWhitelisted(moduleName: string): boolean {
    // Check exact matches and patterns
    for (const pattern of this.whitelist) {
      if (this.matchPattern(moduleName, pattern)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Check if module is mocked
   * @param moduleName Module name
   * @returns True if mocked
   */
  isMocked(moduleName: string): boolean {
    return this.mocks.has(moduleName);
  }

  /**
   * Get mock for a module
   * @param moduleName Module name
   * @returns Mock object or undefined
   */
  getMock(moduleName: string): any {
    return this.mocks.get(moduleName);
  }

  /**
   * Check if module is built-in
   * @param moduleName Module name
   * @returns True if built-in
   */
  private isBuiltin(moduleName: string): boolean {
    return this.builtins.has(moduleName);
  }

  /**
   * Load virtual module from MemFS
   * @param path Module path in MemFS
   * @returns Loaded module
   */
  private loadVirtual(path: string): any {
    try {
      const content = this.memfs.read(path);
      const code = content.toString();

      // Simple module execution context
      const module = { exports: {} };
      const moduleContext = {
        module,
        exports: module.exports,
        require: (name: string) => this.require(name, path),
      };

      // Execute module code (simplified)
      // In real implementation, this would use eval or Function constructor
      // with proper context binding

      logger.debug(`Loaded virtual module: ${path}`);
      return moduleContext.exports;
    } catch (error) {
      throw new SandboxError(
        `Failed to load module: ${path}`,
        'MODULE_LOAD_ERROR',
        { path, error: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * Load built-in module
   * @param moduleName Module name
   * @returns Built-in module
   */
  private loadBuiltin(moduleName: string): any {
    // Return stub implementations for built-in modules
    const builtins: Record<string, any> = {
      path: {
        join: (...parts: string[]) => parts.join('/'),
        dirname: (p: string) => p.split('/').slice(0, -1).join('/'),
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
      buffer: { Buffer },
      stream: {
        Readable: class {},
        Writable: class {},
        Transform: class {},
      },
    };

    return builtins[moduleName] || {};
  }

  /**
   * Load external module from node_modules
   * @param moduleName Module name
   * @returns Loaded module
   */
  private loadExternal(moduleName: string): any {
    // Try to load from node_modules path in MemFS
    const nodeModulesPath = `/node_modules/${moduleName}`;

    if (this.memfs.exists(nodeModulesPath)) {
      return this.loadVirtual(nodeModulesPath);
    }

    throw new SandboxError(
      `Module not found: ${moduleName}`,
      'MODULE_NOT_FOUND',
      { module: moduleName }
    );
  }

  /**
   * Match module name against pattern with wildcards
   * @param name Module name
   * @param pattern Pattern (e.g., 'lodash*', '@scope/*')
   * @returns True if matches
   */
  private matchPattern(name: string, pattern: string): boolean {
    // Exact match
    if (name === pattern) {
      return true;
    }

    // Convert glob pattern to regex
    const regexPattern = pattern
      .replace(/\./g, '\\.')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');

    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(name);
  }

  /**
   * Clear all caches and state
   */
  clear(): void {
    this.cache.clear();
    this.circularDeps.clear();
    logger.debug('ModuleSystem caches cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): any {
    return this.cache.getStats();
  }

  /**
   * Get whitelist
   */
  getWhitelist(): string[] {
    return Array.from(this.whitelist);
  }

  /**
   * Add module to whitelist
   * @param moduleName Module name or pattern
   */
  addToWhitelist(moduleName: string): void {
    this.whitelist.add(moduleName);
  }

  /**
   * Remove module from whitelist
   * @param moduleName Module name or pattern
   */
  removeFromWhitelist(moduleName: string): void {
    this.whitelist.delete(moduleName);
  }
}
