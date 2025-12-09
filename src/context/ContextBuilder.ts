/**
 * @fileoverview Context builder for isolated execution environment
 *
 * Test Scenarios:
 * ===============
 * Test 1: console.log('hello') with mode=inherit
 *   - Calls ConsoleHandler with 'inherit' mode
 *   - Output goes to host console
 *   - Works correctly
 *
 * Test 2: Access process → ReferenceError
 *   - Code tries: process.env
 *   - Not in globals (blacklisted)
 *   - Throws: ReferenceError: process is not defined
 *
 * Test 3: $fs.write() creates file in MemFS
 *   - $fs injected from MemFS
 *   - Code calls: $fs.write('/test.txt', 'data')
 *   - File created in MemFS
 *   - Can read with $fs.read()
 *
 * Test 4: $env access
 *   - Environment variables injected
 *   - Code accesses: $env.API_KEY
 *   - Returns configured value
 *
 * Test 5: Sandbox variables available
 *   - Pass sandbox: { myData: [1, 2, 3] }
 *   - Code accesses: global.myData[0]
 *   - Returns: 1
 */

import type { IsoBoxOptions } from '../core/types.js';
import { SandboxError } from '../core/types.js';
import { GlobalsInjector } from './GlobalsInjector.js';
import { ConsoleHandler, type ConsoleMode } from './ConsoleHandler.js';
import { EnvHandler } from './EnvHandler.js';
import { MemFS } from '../filesystem/MemFS.js';
import { ModuleSystem } from '../modules/ModuleSystem.js';
import { logger } from '../utils/Logger.js';

/**
 * Builds isolated sandbox context
 */
export class ContextBuilder {
  private globalsInjector: GlobalsInjector;
  private consoleHandler: ConsoleHandler;
  private envHandler: EnvHandler;
  private memfs: MemFS;
  private moduleSystem: ModuleSystem | null;
  private sandbox: Record<string, any>;
  private options: IsoBoxOptions;

  /**
   * Create context builder
   * @param options Configuration options
   */
  constructor(
    options: IsoBoxOptions & {
      memfs: MemFS;
      moduleSystem?: ModuleSystem | null;
    }
  ) {
    this.options = options;
    this.memfs = options.memfs;
    this.moduleSystem = options.moduleSystem ?? null;

    // Setup injectors
    const consoleMode: ConsoleMode = options.console?.mode ?? 'inherit';
    this.consoleHandler = new ConsoleHandler(
      consoleMode,
      options.console?.onOutput
    );

    this.globalsInjector = new GlobalsInjector(options.console?.allowTimers ?? false);

    const env = options.env ?? {};
    this.envHandler = new EnvHandler(env);

    this.sandbox = options.sandbox ?? {};

    logger.debug('ContextBuilder initialized');
  }

  /**
   * Build and configure a context
   * @param isolateId ID of isolate (for context identification)
   * @returns Configured context object
   */
  async build(isolateId: string): Promise<Record<string, any>> {
    logger.debug(`Building context for isolate: ${isolateId}`);

    // Simulate context creation (real isolated-vm would create actual context)
    const context: Record<string, any> = {
      isolateId,
      _globals: {},
      _console: this.consoleHandler,
      _env: this.envHandler,
      _fs: this.memfs,
      _modules: this.moduleSystem,
    };

    // Inject safe globals
    await this.injectGlobals(context);

    // Inject console if enabled
    if (this.options.console?.enabled !== false) {
      await this.injectConsole(context);
    }

    // Inject environment variables
    await this.injectEnvironment(context);

    // Inject filesystem
    if (this.options.filesystem?.enabled !== false) {
      await this.injectFilesystem(context);
    }

    // Inject require if enabled
    if (this.options.require) {
      await this.injectRequire(context);
    }

    // Inject sandbox variables
    if (Object.keys(this.sandbox).length > 0) {
      await this.injectSandbox(context);
    }

    return context;
  }

  /**
   * Inject safe global objects
   */
  private async injectGlobals(context: Record<string, any>): Promise<void> {
    const globals = this.globalsInjector.getAllGlobals();

    // Add global reference to itself
    globals['global'] = globals;

    context._globals = globals;

    logger.debug(
      `Injected ${Object.keys(globals).length} safe global objects`
    );
  }

  /**
   * Inject console object
   */
  private async injectConsole(context: Record<string, any>): Promise<void> {
    const handler = this.consoleHandler;

    context._console_log = (...args: any[]) => handler.handleOutput('log', args);
    context._console_error = (...args: any[]) => handler.handleOutput('error', args);
    context._console_warn = (...args: any[]) => handler.handleOutput('warn', args);
    context._console_info = (...args: any[]) => handler.handleOutput('log', args);
    context._console_debug = (...args: any[]) => handler.handleOutput('debug', args);

    // Create console object
    const console_obj = {
      log: context._console_log,
      error: context._console_error,
      warn: context._console_warn,
      info: context._console_info,
      debug: context._console_debug,
      clear: () => handler.clear(),
    };

    context._globals.console = console_obj;

    logger.debug('Injected console object');
  }

  /**
   * Inject environment variables
   */
  private async injectEnvironment(context: Record<string, any>): Promise<void> {
    const env = this.envHandler.toObject();
    context._globals.$env = env;

    logger.debug(`Injected environment with ${Object.keys(env).length} variables`);
  }

  /**
   * Inject filesystem access
   */
  private async injectFilesystem(context: Record<string, any>): Promise<void> {
    const memfs = this.memfs;

    const fs_obj = {
      write: (path: string, content: string) => memfs.write(path, content),
      read: (path: string) => {
        const buffer = memfs.read(path);
        return buffer.toString();
      },
      exists: (path: string) => memfs.exists(path),
      readdir: (path: string) => memfs.readdir(path),
      mkdir: (path: string, recursive?: boolean) => memfs.mkdir(path, recursive),
      delete: (path: string, recursive?: boolean) =>
        memfs.delete(path, recursive),
      stat: (path: string) => {
        const stat = memfs.stat(path);
        return {
          isDirectory: stat.isDirectory,
          size: stat.size,
          created: stat.created,
          modified: stat.modified,
        };
      },
    };

    context._globals.$fs = fs_obj;

    logger.debug('Injected filesystem ($fs)');
  }

  /**
   * Inject require function
   */
  private async injectRequire(context: Record<string, any>): Promise<void> {
    if (!this.moduleSystem) {
      logger.warn('Module system not available, skipping require injection');
      return;
    }

    const moduleSystem = this.moduleSystem;

    const require_fn = (moduleName: string) => {
      return moduleSystem.require(moduleName, context.isolateId);
    };

    context._globals.require = require_fn;
    context._require = require_fn;

    logger.debug('Injected require function');
  }

  /**
   * Inject sandbox variables
   */
  private async injectSandbox(context: Record<string, any>): Promise<void> {
    for (const [key, value] of Object.entries(this.sandbox)) {
      // Deep copy to prevent host mutation
      context._globals[key] = JSON.parse(JSON.stringify(value));
    }

    logger.debug(`Injected ${Object.keys(this.sandbox).length} sandbox variables`);
  }

  /**
   * Validate context has expected globals
   */
  validateContext(context: Record<string, any>): void {
    const required = [
      'Object',
      'Array',
      'String',
      'Number',
      'Promise',
      'Math',
      'JSON',
      'Error',
      'console',
      '$fs',
      '$env',
    ];

    const globals = context._globals || {};

    for (const key of required) {
      if (!(key in globals)) {
        throw new SandboxError(`Missing required global: ${key}`, 'MISSING_GLOBAL');
      }
    }

    logger.debug('Context validation passed');
  }

  /**
   * Get console handler for output capture
   */
  getConsoleHandler(): ConsoleHandler {
    return this.consoleHandler;
  }

  /**
   * Get environment handler
   */
  getEnvHandler(): EnvHandler {
    return this.envHandler;
  }
}
