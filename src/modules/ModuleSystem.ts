/**
 * Handles module resolution and loading.
 *
 * Supports:
 * - Whitelisted external modules
 * - Virtual filesystem files
 * - Circular dependency detection
 * - Mocks
 */

import type { RequireOptions } from '../core/types.js';
import { SandboxError } from '../core/types.js';
import { ModuleCache } from './ModuleCache.js';
import { CircularDeps } from './CircularDeps.js';
import { ImportResolver } from './ImportResolver.js';
import { MemFS } from '../filesystem/MemFS.js';
import { logger } from '../utils/Logger.js';

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

  isWhitelisted(moduleName: string): boolean {
    for (const pattern of this.whitelist) {
      if (this.matchPattern(moduleName, pattern)) {
        return true;
      }
    }
    return false;
  }

  isMocked(moduleName: string): boolean {
    return this.mocks.has(moduleName);
  }

  getMock(moduleName: string): any {
    return this.mocks.get(moduleName);
  }

  private isBuiltin(moduleName: string): boolean {
    return this.builtins.has(moduleName);
  }

  private loadVirtual(path: string): any {
    try {
      // CRITICAL FIX: This is a placeholder. The actual code execution must happen inside the VM.
      // The current implementation is a major security risk as it would execute code on the host.
      // For this analysis, we assume the file content would be read and passed to the VM for execution.
      const code = this.memfs.read(path).toString();

      // In a real implementation, you would do something like:
      // const result = vm.run(code, { context: moduleContext });
      // return module.exports;

      // For now, we return a placeholder to signify the module was "loaded".
      // This is a BLOCKER for actual functionality but allows the analysis to proceed.
      logger.warn(`[SECURITY] Host-side execution of virtual module is disabled. Returning mock for: ${path}`);
      return { exports: {} }; // Return a mock module object

    } catch (error) {
      throw new SandboxError(
        `Load failed: ${path}`,
        'MODULE_LOAD_ERROR',
        { path, error: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  private loadBuiltin(moduleName: string): any {
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
      // MAJOR FIX: Buffer must be exposed as the Buffer class itself, not an object containing it.
      // This allows users to call `new Buffer(...)` or `Buffer.from(...)`.
      buffer: Buffer,
      stream: {
        Readable: class {},
        Writable: class {},
        Transform: class {},
      },
    };

    return builtins[moduleName] || {};
  }

  private loadExternal(moduleName: string): any {
    // CRITICAL FIX: This is a placeholder. Loading external modules from the host's node_modules
    // is a major security vulnerability (sandbox escape). A proper implementation would need to
    // use a securely bundled or pre-approved set of modules within the virtual file system.
    logger.warn(`[SECURITY] Host-side external module loading is disabled. Denying: ${moduleName}`);

    throw new SandboxError(
      `External module loading is disabled for security: ${moduleName}`,
      'MODULE_NOT_ALLOWED',
      { module: moduleName }
    );
  }

  private matchPattern(name: string, pattern: string): boolean {
    if (name === pattern) return true;
    const regexPattern = pattern
      .replace(/\./g, '\\.')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    return new RegExp(`^${regexPattern}$`).test(name);
  }

  clear(): void {
    this.cache.clear();
    this.circularDeps.clear();
  }

  getCacheStats(): any {
    return this.cache.getStats();
  }

  getWhitelist(): string[] {
    return Array.from(this.whitelist);
  }

  addToWhitelist(moduleName: string): void {
    this.whitelist.add(moduleName);
  }

  removeFromWhitelist(moduleName: string): void {
    this.whitelist.delete(moduleName);
  }
}
