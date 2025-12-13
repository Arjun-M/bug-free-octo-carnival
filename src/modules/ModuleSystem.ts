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

    if (this.cache.has(moduleName)) {
      return this.cache.get(moduleName);
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

    this.circularDeps.startLoading(moduleName);

    try {
      let module: any;

      if (moduleName.startsWith('.') || moduleName.startsWith('/')) {
        const resolved = this.importResolver.resolve(moduleName, fromPath);
        module = this.loadVirtual(resolved);
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

      this.cache.set(moduleName, module);
      return module;
    } finally {
      this.circularDeps.finishLoading(moduleName);
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
      this.memfs.read(path); // Verify existence/readability but don't use content yet since execution is disabled

      // Basic CJS emulation
      const module = { exports: {} };
      const moduleContext = {
        module,
        exports: module.exports,
        require: (name: string) => this.require(name, path),
      };

      // Execution of virtual modules in HOST is disabled for Phase 0 security cleanup.
      // Real implementation must execute inside VM.
      logger.warn(`Virtual module execution skipped (VM required): ${path}`);
      return moduleContext.exports;

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
