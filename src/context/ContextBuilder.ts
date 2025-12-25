/**
 * @file src/context/ContextBuilder.ts
 * @description Configures the execution environment for an isolate by injecting globals, console, filesystem APIs, environment variables, and module loading capabilities. Orchestrates context setup for sandboxed code execution.
 * @since 1.0.0
 * @copyright Copyright (c) 2025 Arjun-M. This source code is licensed under the MIT license.
 */

import type { IsoBoxOptions } from '../core/types.js';
import { SandboxError } from '../core/types.js';
import { GlobalsInjector } from './GlobalsInjector.js';
import { ConsoleHandler, type ConsoleMode } from './ConsoleHandler.js';
import { EnvHandler } from './EnvHandler.js';
import { MemFS } from '../filesystem/MemFS.js';
import { ModuleSystem } from '../modules/ModuleSystem.js';
import { logger } from '../utils/Logger.js';
import ivm from 'isolated-vm';

/**
 * Builds execution contexts for isolated-vm with injected APIs and globals.
 *
 * Orchestrates the setup of:
 * - Safe global objects (Object, Array, etc.)
 * - Console redirection (log, error, warn)
 * - Virtual filesystem access ($fs)
 * - Environment variables ($env)
 * - Module loading (require)
 * - Custom sandbox objects
 *
 * The builder prepares a context definition object that can be transferred
 * into an isolate's execution environment.
 *
 * @class ContextBuilder
 * @example
 * ```typescript
 * const builder = new ContextBuilder({
 *   console: { mode: 'redirect' },
 *   filesystem: { enabled: true },
 *   allowTimers: true,
 *   memfs,
 *   moduleSystem
 * });
 *
 * const context = await builder.build('isolate-1');
 * ```
 */
export class ContextBuilder {
  private globalsInjector: GlobalsInjector;
  private consoleHandler: ConsoleHandler;
  private envHandler: EnvHandler;
  private memfs: MemFS;
  private moduleSystem: ModuleSystem | null;
  private sandbox: Record<string, any>;
  private options: IsoBoxOptions;
  private disposables: (() => void)[] = [];

  constructor(
    options: IsoBoxOptions & {
      memfs: MemFS;
      moduleSystem?: ModuleSystem | null;
    }
  ) {
    this.options = options;
    this.memfs = options.memfs;
    this.moduleSystem = options.moduleSystem ?? null;

    const consoleMode: ConsoleMode = options.console?.mode ?? 'inherit';

    // Pass original arguments to onOutput callback if available
    const onOutputAdapter = options.console?.onOutput
      ? (type: string, message: string, args?: any[]) => {
          // Map type string to allowed levels
          const level = (['log', 'warn', 'error', 'info'].includes(type) ? type : 'log') as 'log' | 'warn' | 'error' | 'info';
          // Use original args if available, otherwise wrap message
          options.console!.onOutput!(level, args || [message]);
      }
      : undefined;

    this.consoleHandler = new ConsoleHandler(
      consoleMode,
      onOutputAdapter
    );

    // Use the allowTimers option (defaults to true if not specified)
    this.globalsInjector = new GlobalsInjector(options.allowTimers ?? true);

    this.envHandler = new EnvHandler({});

    this.sandbox = options.sandbox ?? {};

    logger.debug('ContextBuilder ready');
  }

  /**
   * Build a context definition object for an isolate.
   *
   * Assembles all configured APIs and globals into a plain object. The actual
   * injection into isolated-vm Context happens elsewhere (e.g., ExecutionContext).
   *
   * @param isolateId - Unique identifier for the isolate
   * @param ivmContext - Optional isolate context (required for virtual module loading)
   * @returns Context object with _globals containing all APIs
   */
  async build(isolateId: string, ivmContext?: ivm.Context): Promise<Record<string, any>> {
    const context: Record<string, any> = {
      isolateId,
      _globals: {},
    };

    await this.injectGlobals(context);

    if (this.options.console?.mode !== 'off') {
      await this.injectConsole(context);
    }

    await this.injectEnvironment(context);

    if (this.options.filesystem?.enabled !== false) {
      await this.injectFilesystem(context);
    }

    if (this.options.require) {
      await this.injectRequire(context, ivmContext);
    }

    if (Object.keys(this.sandbox).length > 0) {
      await this.injectSandbox(context);
    }

    return context;
  }

  private async injectGlobals(context: Record<string, any>): Promise<void> {
    const globals = this.globalsInjector.getAllGlobals();
    context._globals = globals;
  }

  private async injectConsole(context: Record<string, any>): Promise<void> {
    const handler = this.consoleHandler;

    context._console_log = (...args: any[]) => handler.handleOutput('log', args);
    context._console_error = (...args: any[]) => handler.handleOutput('error', args);
    context._console_warn = (...args: any[]) => handler.handleOutput('warn', args);
    context._console_info = (...args: any[]) => handler.handleOutput('info', args); // Map info to info
    context._console_debug = (...args: any[]) => handler.handleOutput('debug', args);

    const console_obj = {
      log: context._console_log,
      error: context._console_error,
      warn: context._console_warn,
      info: context._console_info,
      debug: context._console_debug,
      clear: () => handler.clear(),
    };

    context._globals.console = console_obj;
  }

  private async injectEnvironment(context: Record<string, any>): Promise<void> {
    const env = this.envHandler.toObject();
    context._globals.$env = env;
  }

  private async injectFilesystem(context: Record<string, any>): Promise<void> {
    const memfs = this.memfs;

    const fs_obj = {
      // Removed .toString() to allow binary data transfer
      write: (path: string, content: string | Buffer) => memfs.write(path, content),
      // Use ivm.ExternalCopy for safe Buffer transfer across boundary
      read: (path: string) => {
        const buffer = memfs.read(path);
        return new ivm.ExternalCopy(buffer).copyInto();
      },
      exists: (path: string) => memfs.exists(path),
      readdir: (path: string) => memfs.readdir(path),
      mkdir: (path: string, recursive?: boolean) => memfs.mkdir(path, recursive),
      delete: (path: string, recursive?: boolean) => memfs.delete(path, recursive),
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
  }

  private async injectRequire(context: Record<string, any>, ivmContext?: ivm.Context): Promise<void> {
    if (!this.moduleSystem) return;

    const moduleSystem = this.moduleSystem;

    // Executor for virtual modules: runs code in the VM
    let executor: ((code: string, filename: string) => any) | undefined;

    if (ivmContext) {
      executor = (code: string, filename: string) => {
        // Wrap in CommonJS function
        // (exports, require, module, __filename, __dirname)
        const wrapped = `(function(exports, require, module, __filename, __dirname) { ${code} \n})`;

        // Compile the wrapped code to get a function reference
        const script = ivmContext.evalSync(wrapped, { filename, reference: true });

        // Use a runner helper in the VM to setup the module environment and execute the script
        const runner = ivmContext.evalSync(`
          (function(moduleFn, filename, requireFn) {
            const exports = {};
            const module = { exports: exports };
            const __filename = filename;
            const __dirname = filename.split('/').slice(0, -1).join('/') || '/';

            // Execute the compiled module function
            moduleFn.apply(undefined, [module.exports, requireFn, module, __filename, __dirname]);
            return module.exports;
          })
        `, { reference: true });

        // Create scoped require function
        const scopedRequire = new ivm.Callback((id: string) => {
             // Resolve relative to current file
             const fromPath = filename;
             return moduleSystem.require(id, fromPath, executor);
        });

        // Track scopedRequire for later disposal instead of immediate disposal
        this.disposables.push(() => {
          try {
            scopedRequire.dispose();
          } catch (e) { /* ignore */ }
        });

        try {
            // Execute runner with the compiled script reference
            return runner.applySync(undefined, [script, filename, scopedRequire], { result: { copy: true, reference: false } });
        } finally {
            // Callback lifecycle managed by disposables
            runner.dispose();
            script.release();
        }
      };
    }

    // The require function should only take moduleName in sandbox context.
    // The fromPath should default to '/' since modules are loaded from MemFS root.
    const require_fn = (moduleName: string) => {
      // If we have an executor (context available), use it.
      // If not (e.g. initial build without context), it might fail for virtual modules.
      // But we plan to pass context to build().
      return moduleSystem.require(moduleName, '/', executor);
    };

    context._globals.require = require_fn;
  }

  private async injectSandbox(context: Record<string, any>): Promise<void> {
    for (const [key, value] of Object.entries(this.sandbox)) {
      // Allow non-serializable values to be passed directly.
      // IsoBox.run will handle the ivm.Callback wrapping for functions.
      context._globals[key] = value;
    }
  }

  /**
   * Validate that a context has all required globals.
   *
   * @param context - Context object to validate
   * @throws {SandboxError} MISSING_GLOBAL if required global is missing
   */
  validateContext(context: Record<string, any>): void {
    const required = [
      'console',
      '$fs',
      '$env',
    ];

    const globals = context._globals || {};

    for (const key of required) {
      if (!(key in globals)) {
        if (key === '$fs' && this.options.filesystem?.enabled === false) continue;

        throw new SandboxError(`Missing global: ${key}`, 'MISSING_GLOBAL');
      }
    }
  }

  /**
   * Get the console handler instance.
   *
   * @returns ConsoleHandler for managing console output
   */
  getConsoleHandler(): ConsoleHandler {
    return this.consoleHandler;
  }

  /**
   * Get the environment handler instance.
   *
   * @returns EnvHandler for managing environment variables
   */
  getEnvHandler(): EnvHandler {
    return this.envHandler;
  }

  /**
   * Clean up resources, particularly active timers.
   */
  dispose(): void {
    if (this.globalsInjector) {
      this.globalsInjector.dispose();
    }

    // Dispose of all tracked resources
    for (const dispose of this.disposables) {
      dispose();
    }
    this.disposables = [];
  }
}
