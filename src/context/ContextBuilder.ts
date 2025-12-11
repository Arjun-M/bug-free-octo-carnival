/**
 * Configures the execution environment for an isolate.
 *
 * Sets up:
 * - Globals (Object, Array, etc.)
 * - Console redirection
 * - Virtual Filesystem ($fs)
 * - Environment variables ($env)
 * - Custom require()
 */

import type { IsoBoxOptions } from '../core/types.js';
import { SandboxError } from '../core/types.js';
import { GlobalsInjector } from './GlobalsInjector.js';
import { ConsoleHandler, type ConsoleMode } from './ConsoleHandler.js';
import { EnvHandler } from './EnvHandler.js';
import { MemFS } from '../filesystem/MemFS.js';
import { ModuleSystem } from '../modules/ModuleSystem.js';
import { logger } from '../utils/Logger.js';

export class ContextBuilder {
  private globalsInjector: GlobalsInjector;
  private consoleHandler: ConsoleHandler;
  private envHandler: EnvHandler;
  private memfs: MemFS;
  private moduleSystem: ModuleSystem | null;
  private sandbox: Record<string, any>;
  private options: IsoBoxOptions;

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
    // Fix callback signature mismatch: ConsoleHandler expects (type: string, msg: string), but onOutput in types.ts is (level, args)
    const onOutputAdapter = options.console?.onOutput
      ? (type: string, message: string) => {
          // Map type string to allowed levels
          const level = (['log', 'warn', 'error', 'info'].includes(type) ? type : 'log') as 'log' | 'warn' | 'error' | 'info';
          options.console!.onOutput!(level, [message]);
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
   * Prepare the context object.
   * Note: This returns a plain object definition.
   * The actual injection into isolated-vm Context happens elsewhere (e.g. ExecutionContext).
   */
  async build(isolateId: string): Promise<Record<string, any>> {
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
      await this.injectRequire(context);
    }

    if (Object.keys(this.sandbox).length > 0) {
      await this.injectSandbox(context);
    }

    return context;
  }

  private async injectGlobals(context: Record<string, any>): Promise<void> {
    const globals = this.globalsInjector.getAllGlobals();
    // Do not inject 'global' with circular reference as it breaks isolated-vm transfer
    // globals['global'] = globals;
    context._globals = globals;
  }

  private async injectConsole(context: Record<string, any>): Promise<void> {
    const handler = this.consoleHandler;

    // These functions will need to be marshalled to the VM
    context._console_log = (...args: any[]) => handler.handleOutput('log', args);
    context._console_error = (...args: any[]) => handler.handleOutput('error', args);
    context._console_warn = (...args: any[]) => handler.handleOutput('warn', args);
    context._console_info = (...args: any[]) => handler.handleOutput('log', args); // Map info to log
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
      write: (path: string, content: string) => memfs.write(path, content),
      read: (path: string) => memfs.read(path).toString(),
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

  private async injectRequire(context: Record<string, any>): Promise<void> {
    if (!this.moduleSystem) return;

    const moduleSystem = this.moduleSystem;
    const require_fn = (moduleName: string) => {
      return moduleSystem.require(moduleName, context.isolateId);
    };

    context._globals.require = require_fn;
  }

  private async injectSandbox(context: Record<string, any>): Promise<void> {
    for (const [key, value] of Object.entries(this.sandbox)) {
      try {
        context._globals[key] = JSON.parse(JSON.stringify(value));
      } catch {
        // Fallback for non-serializable?
        context._globals[key] = String(value);
      }
    }
  }

  validateContext(context: Record<string, any>): void {
    const required = [
      'console',
      '$fs',
      '$env',
    ];

    const globals = context._globals || {};

    for (const key of required) {
      if (!(key in globals)) {
        // $fs and $env might be disabled by config, so only warn or check config
        if (key === '$fs' && this.options.filesystem?.enabled === false) continue;
        // if (key === '$env') ...

        throw new SandboxError(`Missing global: ${key}`, 'MISSING_GLOBAL');
      }
    }
  }

  getConsoleHandler(): ConsoleHandler {
    return this.consoleHandler;
  }

  getEnvHandler(): EnvHandler {
    return this.envHandler;
  }
}
