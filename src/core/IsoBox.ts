/**
 * @file src/core/IsoBox.ts
 * @description Main IsoBox class - orchestrates secure code execution with isolated-vm, managing execution lifecycle, resource monitoring, filesystem operations, and session management. Provides APIs for running JavaScript/TypeScript code in isolated environments with configurable timeouts, memory limits, and security controls.
 * @since 1.0.0
 * @copyright Copyright (c) 2025 Arjun-M. This source code is licensed under the MIT license.
 */

import { EventEmitter } from 'events';
import type {
  IsoBoxOptions,
  RunOptions,
  ProjectOptions,
  SessionOptions,
  GlobalMetrics,
} from './types.js';
import { SandboxError } from './types.js';
import { CompiledScript } from './CompiledScript.js';
import { TypeScriptCompiler } from '../project/TypeScriptCompiler.js';
import type { Language } from './types.js';
import type { ExecutionResult } from '../execution/ExecutionEngine.js';
import ivm from 'isolated-vm';
import { IsolateManager } from '../isolate/IsolateManager.js';
import { IsolatePool } from '../isolate/IsolatePool.js';
import { ExecutionEngine } from '../execution/ExecutionEngine.js';
import { ExecutionContext } from '../execution/ExecutionContext.js';
import { ContextBuilder } from '../context/ContextBuilder.js';
import { MemFS } from '../filesystem/MemFS.js';
import { ModuleSystem } from '../modules/ModuleSystem.js';
import { ProjectLoader } from '../project/ProjectLoader.js';
import { SessionManager, type SessionInfo } from '../session/SessionManager.js';
import { logger } from '../utils/Logger.js';

/**
 * IsoBox - A secure, isolated sandbox for executing untrusted JavaScript/TypeScript code.
 *
 * Provides comprehensive sandboxing capabilities including:
 * - Isolated VM execution with configurable memory and CPU limits
 * - Virtual filesystem with quota management
 * - Module system with whitelist/blacklist support
 * - Session management for persistent state
 * - Resource pooling for improved performance
 * - TypeScript compilation support
 * - Event-driven execution lifecycle monitoring
 *
 * @class
 * @example
 * ```typescript
 * const sandbox = new IsoBox({
 *   timeout: 5000,
 *   memoryLimit: 128 * 1024 * 1024,
 *   strictTimeout: true
 * });
 *
 * const result = await sandbox.run('return 2 + 2');
 * console.log(result); // 4
 *
 * await sandbox.dispose();
 * ```
 */
export class IsoBox {
  private isolateManager: IsolateManager;
  private isolatePool: IsolatePool | null = null;
  private executionEngine: ExecutionEngine;
  private memfs: MemFS;
  private moduleSystem: ModuleSystem | null = null;
  private sessionManager: SessionManager;
  private eventEmitter: EventEmitter;
  private globalMetrics: GlobalMetrics;
  private disposed: boolean = false;

  private timeout: number;
  private cpuTimeLimit: number;
  private memoryLimit: number;
  private strictTimeout: boolean;
  private fsMaxSize: number;
  private usePooling: boolean;
  private options: IsoBoxOptions;

  /**
   * Creates a new IsoBox sandbox instance.
   *
   * @param {IsoBoxOptions} options - Configuration options for the sandbox
   * @param {number} [options.timeout=5000] - Maximum execution time in milliseconds
   * @param {number} [options.cpuTimeLimit=10000] - CPU time limit in milliseconds
   * @param {number} [options.memoryLimit=134217728] - Memory limit in bytes (default: 128MB)
   * @param {boolean} [options.strictTimeout=true] - Enable strict timeout enforcement with infinite loop detection
   * @param {boolean} [options.usePooling=false] - Enable isolate pooling for improved performance
   * @param {FilesystemOptions} [options.filesystem] - Filesystem configuration
   * @param {RequireOptions} [options.require] - Module system configuration
   * @param {PoolOptions} [options.pool] - Pooling configuration
   * @throws {SandboxError} If options are invalid
   * @example
   * ```typescript
   * const sandbox = new IsoBox({
   *   timeout: 3000,
   *   memoryLimit: 64 * 1024 * 1024,
   *   require: {
   *     mode: 'whitelist',
   *     whitelist: ['fs', 'path']
   *   }
   * });
   * ```
   */
  constructor(options: IsoBoxOptions = {}) {
    this.options = options;
    this.timeout = options.timeout ?? 5000;
    this.cpuTimeLimit = options.cpuTimeLimit ?? 10000;
    this.memoryLimit = options.memoryLimit ?? 128 * 1024 * 1024;
    this.strictTimeout = options.strictTimeout ?? true;
    this.fsMaxSize = options.filesystem?.maxSize ?? 64 * 1024 * 1024;
    this.usePooling = options.usePooling ?? false;

    this.isolateManager = new IsolateManager();
    this.executionEngine = new ExecutionEngine();
    this.sessionManager = new SessionManager(this, options.sessionCleanupInterval);
    this.memfs = new MemFS({
      maxSize: this.fsMaxSize,
      root: options.filesystem?.root ?? '/',
    });
    this.eventEmitter = new EventEmitter();

    if (this.usePooling && options.pool) {
      this.isolatePool = new IsolatePool(options.pool);
    }

    if (options.require) {
      this.moduleSystem = new ModuleSystem({ ...options.require, memfs: this.memfs });
    }

    this.globalMetrics = {
      totalExecutions: 0,
      errorCount: 0,
      avgTime: 0,
      memoryUsed: 0,
      cpuTimeUsed: 0,
      startTime: Date.now(),
      lastExecutionTime: 0,
    };

    this.validateOptions();
    this.wireUpExecutionEngine();

    logger.info(
      `IsoBox ready (timeout=${this.timeout}ms, fs=${(this.fsMaxSize / 1e6).toFixed(1)}MB)`
    );
  }

  private wireUpExecutionEngine(): void {
    this.executionEngine.on('execution:start', (event) => {
      this.emit('execution', { type: 'start', ...event });
    });

    this.executionEngine.on('execution:complete', (event) => {
      this.emit('execution', { type: 'complete', ...event });
    });

    this.executionEngine.on('execution:error', (event) => {
      this.emit('execution', { type: 'error', ...event });
    });

    this.executionEngine.on('timeout', (event) => {
      this.emit('timeout', event);
    });

    this.executionEngine.on('resource-warning', (event) => {
      this.emit('resource-warning', event);
    });
  }

  private validateOptions(): void {
    if (this.timeout < 0) throw new SandboxError('timeout must be non-negative', 'INVALID_OPTION');
    if (this.memoryLimit < 1024 * 1024) throw new SandboxError('memoryLimit must be > 1MB', 'INVALID_OPTION');
    if (this.cpuTimeLimit < 0) throw new SandboxError('cpuTimeLimit must be non-negative', 'INVALID_OPTION');
    if (this.fsMaxSize < 1024 * 1024) throw new SandboxError('FS quota must be > 1MB', 'INVALID_OPTION');
  }

  /**
   * Executes JavaScript/TypeScript code in an isolated environment.
   *
   * Creates a new isolate (or reuses from pool), sets up the execution context,
   * injects globals, and runs the code with timeout and resource monitoring.
   *
   * @template T - Expected return type of the code execution
   * @param {string} code - JavaScript/TypeScript code to execute
   * @param {RunOptions} [opts={}] - Execution options
   * @param {number} [opts.timeout] - Override default timeout
   * @param {string} [opts.filename] - Optional filename for better error messages
   * @param {Language} [opts.language] - Code language ('javascript' or 'typescript')
   * @returns {Promise<T>} The result of code execution
   * @throws {SandboxError} If code is empty or sandbox is disposed
   * @throws {TimeoutError} If execution exceeds timeout
   * @throws {MemoryLimitError} If memory limit is exceeded
   * @throws {CPULimitError} If CPU limit is exceeded
   * @example
   * ```typescript
   * // Simple arithmetic
   * const result = await sandbox.run<number>('return 2 + 2');
   * console.log(result); // 4
   *
   * // Async code
   * const data = await sandbox.run(`
   *   return new Promise(resolve => {
   *     setTimeout(() => resolve('done'), 1000);
   *   });
   * `);
   *
   * // TypeScript
   * const typed = await sandbox.run<string>('const x: number = 42; return x.toString();', {
   *   language: 'typescript'
   * });
   * ```
   */
  async run<T = any>(code: string, opts: RunOptions = {}): Promise<T> {
    this.ensureNotDisposed();

    if (!code?.trim()) {
      throw new SandboxError('Code cannot be empty', 'EMPTY_CODE');
    }

    const timeout = opts.timeout ?? this.timeout;
    const executionId = ExecutionContext.generateId();

    this.emit('execution', {
      type: 'start',
      id: executionId,
      timeout,
      filename: opts.filename,
      timestamp: Date.now(),
    });

    // CRITICAL FIX: Hoist all variables outside try block for proper cleanup in finally
    let isolate: ivm.Isolate | undefined;
    let builder: ContextBuilder | undefined;
    let execResult: ExecutionResult<T> | undefined;
    let result: T | undefined;
    const callbacks: ivm.Callback[] = []; // Initialize callbacks array before try

    try {
      if (this.isolatePool) {
        result = await this.isolatePool.execute<T>(code, { timeout: opts.timeout ?? this.timeout });
        execResult = { value: result, duration: opts.timeout ?? this.timeout, cpuTime: 0 };
      } else {
        const { isolate: newIsolate } = this.isolateManager.create({
          memoryLimit: this.memoryLimit,
        });
        isolate = newIsolate;

        const context = isolate.createContextSync();
        const global = context.global;

        builder = new ContextBuilder({
          ...this.options,
          memfs: this.memfs,
          moduleSystem: this.moduleSystem,
          allowTimers: this.options.allowTimers ?? true,
        });

        const contextObj = await builder.build(opts.filename || 'script');

        // MAJOR FIX: Proper context injection with correct type handling
        if (contextObj._globals) {
          for (const key of Object.keys(contextObj._globals)) {
            const value = contextObj._globals[key];
            try {
              if (typeof value === 'function') {
                // Functions must be wrapped in ivm.Callback
                const callback = new ivm.Callback(value);
                callbacks.push(callback);
                global.setSync(key, callback);
              } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                // For objects, check if they have methods
                const hasNonFunctions = Object.values(value).some(v => typeof v !== 'function');
                const hasFunctions = Object.values(value).some(v => typeof v === 'function');

                if (hasFunctions) {
                  // Create empty ref and populate with mixed content
                  const ref = context.evalClosureSync('() => ({})', [], { result: { reference: true } });
                  global.setSync(key, ref);

                  for (const prop of Object.keys(value)) {
                    const propVal = value[prop];
                    try {
                      if (typeof propVal === 'function') {
                        const callback = new ivm.Callback(propVal);
                        callbacks.push(callback);
                        ref.setSync(prop, callback);
                      } else if (typeof propVal === 'object' && propVal !== null) {
                        try {
                          ref.setSync(prop, propVal, { copy: true });
                        } catch (e) {
                          ref.setSync(prop, String(propVal), { copy: true });
                        }
                      } else {
                        ref.setSync(prop, propVal, { copy: true });
                      }
                    } catch (e) {
                      logger.warn(`Failed to inject property '${key}.${prop}': ${e instanceof Error ? e.message : String(e)}`);
                    }
                  }
                } else if (hasNonFunctions) {
                  // Pure data object
                  global.setSync(key, value, { copy: true });
                }
              } else if (Array.isArray(value)) {
                global.setSync(key, value, { copy: true });
              } else {
                // Primitives
                global.setSync(key, value, { copy: true });
              }
            } catch (e) {
              logger.warn(`Failed to inject global '${key}': ${e instanceof Error ? e.message : String(e)}`);
            }
          }
        }

        execResult = await this.executionEngine.execute<T>(code, isolate, context, {
          timeout,
          cpuTimeLimit: this.cpuTimeLimit,
          memoryLimit: this.memoryLimit,
          strictTimeout: this.strictTimeout,
          filename: opts.filename,
          code,
        });

        if (execResult.error) {
          throw execResult.error;
        }

        result = execResult.value;
      }

      // CRITICAL FIX: Check if execResult is defined before accessing properties
      if (execResult) {
        this.recordMetrics(execResult.duration, execResult.cpuTime, execResult.resourceStats?.memoryUsed ?? 0);

        this.emit('execution', {
          type: 'complete',
          id: executionId,
          duration: execResult.duration,
          timestamp: Date.now(),
        });
      }

      return result as T;
    } catch (error) {
      this.globalMetrics.errorCount++;

      let errorObj: Error;
      if (error instanceof Error) {
        errorObj = error;
      } else if (typeof error === 'object' && error !== null && 'message' in error) {
        const msg = (error as any).message;
        errorObj = new Error(msg);
        if ((error as any).stack) errorObj.stack = (error as any).stack;
        if ((error as any).code) (errorObj as any).code = (error as any).code;
      } else {
        errorObj = new Error(String(error));
      }

      this.emit('execution', {
        type: 'error',
        id: executionId,
        error: errorObj.message,
        timestamp: Date.now(),
      });

      throw errorObj;
    } finally {
      // CRITICAL FIX: Proper cleanup of all resources
      // Dispose of all ivm.Callback objects to prevent memory leaks
      for (const callback of callbacks) {
        try {
          callback.dispose();
        } catch (err) {
          // Ignore errors if already disposed
        }
      }
      callbacks.length = 0;

      if (isolate) {
        try {
          this.isolateManager.disposeIsolate(isolate);
        } catch (err) {
          logger.warn(`Failed to dispose isolate: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      if (builder) {
        try {
          builder.dispose();
        } catch (err) {
          // Ignore errors
        }
      }
    }
  }

  /**
   * Compiles/transpiles code for later execution.
   *
   * If the language is TypeScript, transpiles it to JavaScript. Returns a CompiledScript
   * object that can be reused to avoid re-compilation overhead.
   *
   * @param {string} code - Source code to compile
   * @param {Language} [language='javascript'] - Source language ('javascript', 'typescript', or 'ts')
   * @returns {Promise<CompiledScript>} Compiled script wrapper
   * @throws {SandboxError} If code is empty, sandbox is disposed, or compilation fails
   * @example
   * ```typescript
   * const compiled = await sandbox.compile('const x: number = 42; return x;', 'typescript');
   * console.log(compiled.getCompiled()); // JavaScript output
   * ```
   */
  async compile(code: string, language: Language = 'javascript'): Promise<CompiledScript> {
    this.ensureNotDisposed();

    if (!code?.trim()) {
      throw new SandboxError('Code cannot be empty', 'EMPTY_CODE');
    }

    let compiledCode = code;
    if (language === 'typescript' || language === 'ts') {
      try {
        compiledCode = TypeScriptCompiler.transpile(code);
      } catch (error) {
        throw new SandboxError(
          `TypeScript compilation failed: ${error instanceof Error ? error.message : String(error)}`,
          'TS_COMPILATION_ERROR'
        );
      }
    }

    return new CompiledScript(code, compiledCode, language);
  }

  /**
   * Executes a multi-file project in the sandbox.
   *
   * Loads all project files into the virtual filesystem, compiles TypeScript if needed,
   * and executes the entry point file.
   *
   * @template T - Expected return type
   * @param {ProjectOptions} project - Project configuration
   * @param {ProjectFile[]} project.files - Array of project files with path and content
   * @param {string} project.entrypoint - Path to entry point file (e.g., 'index.js')
   * @param {number} [project.timeout] - Override default timeout
   * @returns {Promise<T>} Result from entry point execution
   * @throws {SandboxError} If project validation fails or sandbox is disposed
   * @example
   * ```typescript
   * const result = await sandbox.runProject({
   *   files: [
   *     { path: 'math.js', content: 'exports.add = (a, b) => a + b;' },
   *     { path: 'index.js', content: 'const math = require("./math"); return math.add(2, 3);' }
   *   ],
   *   entrypoint: 'index.js'
   * });
   * console.log(result); // 5
   * ```
   */
  async runProject<T = any>(project: ProjectOptions): Promise<T> {
    this.ensureNotDisposed();

    try {
      const prepared = ProjectLoader.loadProject(project);
      logger.info(`Loading project: ${prepared.fileCount} files`);

      ProjectLoader.writeProjectFiles(project, this.memfs);

      const entrypointBuffer = this.memfs.read(project.entrypoint);
      const entrypointCode = entrypointBuffer.toString();

      const timeout = project.timeout ?? this.timeout;
      return this.run<T>(entrypointCode, {
        filename: project.entrypoint,
        timeout,
        language: 'javascript',
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(`Project execution failed: ${err.message}`);
      throw err;
    }
  }

  /**
   * Executes code with streaming output support.
   *
   * Returns an async iterator that yields execution progress events,
   * including start, result, error, and end events.
   *
   * @param {string} code - JavaScript code to execute
   * @yields {{ type: 'start' | 'result' | 'error' | 'end', value?: any, error?: string, timestamp: number }}
   * @throws {SandboxError} If code is empty or sandbox is disposed
   * @example
   * ```typescript
   * for await (const event of sandbox.runStream('return 42')) {
   *   console.log(event);
   *   // { type: 'start', timestamp: ... }
   *   // { type: 'result', value: 42, timestamp: ... }
   *   // { type: 'end', timestamp: ... }
   * }
   * ```
   */
  async *runStream(code: string): AsyncIterable<any> {
    this.ensureNotDisposed();

    if (!code?.trim()) {
      throw new SandboxError('Code cannot be empty', 'EMPTY_CODE');
    }

    yield { type: 'start', timestamp: Date.now() };

    try {
      const result = await this.run(code);
      yield { type: 'result', value: result, timestamp: Date.now() };
    } catch (error) {
      yield {
        type: 'error',
        error: error instanceof Error ? error.message : String(error),
        timestamp: Date.now(),
      };
    }

    yield { type: 'end', timestamp: Date.now() };
  }

  /**
   * Creates a persistent session for stateful code execution.
   *
   * Sessions allow multiple code executions to share state and persist
   * variables between runs.
   *
   * @param {string} id - Unique session identifier
   * @param {SessionOptions} [opts={}] - Session configuration
   * @param {number} [opts.ttl] - Session time-to-live in milliseconds
   * @param {number} [opts.maxExecutions] - Maximum number of executions per session
   * @returns {Promise<any>} Created session object
   * @throws {SandboxError} If sandbox is disposed
   * @example
   * ```typescript
   * const session = await sandbox.createSession('user-123', { ttl: 3600000 });
   * // Session persists for 1 hour
   * ```
   */
  async createSession(id: string, opts: SessionOptions = {}): Promise<any> {
    this.ensureNotDisposed();

    const session = this.sessionManager.createSession(id, opts);
    this.emit('session:created', { sessionId: id, timestamp: Date.now() });

    return session;
  }

  /**
   * Retrieves an existing session by ID.
   *
   * @param {string} id - Session identifier
   * @returns {any} Session object or null if not found
   */
  getSession(id: string): any {
    return this.sessionManager.getSession(id);
  }

  /**
   * Lists all active sessions.
   *
   * @returns {SessionInfo[]} Array of session information objects
   */
  listSessions(): SessionInfo[] {
    return this.sessionManager.listSessions();
  }

  /**
   * Deletes a session and cleans up its resources.
   *
   * @param {string} id - Session identifier
   * @returns {Promise<void>}
   */
  async deleteSession(id: string): Promise<void> {
    await this.sessionManager.deleteSession(id);
  }

  /**
   * Pre-warms the isolate pool for improved performance.
   *
   * Creates and initializes isolates in advance, optionally running
   * warmup code to prime the JIT compiler.
   *
   * @param {string} [code] - Optional warmup code to execute in each isolate
   * @returns {Promise<void>}
   * @throws {SandboxError} If pooling is disabled or sandbox is disposed
   * @example
   * ```typescript
   * await sandbox.warmupPool('const x = 1 + 1;'); // Warm up with simple code
   * ```
   */
  async warmupPool(code?: string): Promise<void> {
    this.ensureNotDisposed();

    if (!this.isolatePool) {
      throw new SandboxError('Pooling disabled', 'POOLING_DISABLED');
    }

    await this.isolatePool.warmup(code);
  }

  /**
   * Gets statistics about the isolate pool.
   *
   * @returns {any} Pool statistics or null if pooling is disabled
   */
  getPoolStats(): any {
    return this.isolatePool?.getStats() ?? null;
  }

  /**
   * Gets the virtual filesystem instance.
   *
   * @returns {MemFS} In-memory filesystem
   */
  get fs(): MemFS {
    return this.memfs;
  }

  /**
   * Gets the module system instance.
   *
   * @returns {ModuleSystem | null} Module system or null if not configured
   */
  getModuleSystem(): ModuleSystem | null {
    return this.moduleSystem;
  }

  /**
   * Gets global execution metrics.
   *
   * @returns {GlobalMetrics} Metrics including total executions, errors, average time, CPU/memory usage
   */
  getMetrics(): GlobalMetrics {
    return { ...this.globalMetrics };
  }

  private recordMetrics(duration: number, cpuTime: number, memory: number): void {
    this.globalMetrics.totalExecutions++;
    this.globalMetrics.cpuTimeUsed += cpuTime;
    this.globalMetrics.memoryUsed = Math.max(
      this.globalMetrics.memoryUsed,
      memory
    );
    this.globalMetrics.lastExecutionTime = Date.now();

    const prevTotal = this.globalMetrics.totalExecutions - 1;
    const prevAvg = this.globalMetrics.avgTime;
    this.globalMetrics.avgTime =
      (prevAvg * prevTotal + duration) / this.globalMetrics.totalExecutions;
  }

  /**
   * Registers an event listener.
   *
   * @param {string} event - Event name ('execution', 'timeout', 'resource-warning', 'session:created', 'error')
   * @param {Function} handler - Event handler function
   * @example
   * ```typescript
   * sandbox.on('timeout', (event) => {
   *   console.log(`Execution ${event.id} timed out: ${event.reason}`);
   * });
   * ```
   */
  on(event: string, handler: (...args: any[]) => void): void {
    this.eventEmitter.on(event, handler);
  }

  /**
   * Removes an event listener.
   *
   * @param {string} event - Event name
   * @param {Function} handler - Event handler function to remove
   */
  off(event: string, handler: (...args: any[]) => void): void {
    this.eventEmitter.off(event, handler);
  }

  /**
   * Disposes of the sandbox and releases all resources.
   *
   * Cleans up isolates, pools, sessions, filesystem, and event listeners.
   * After disposal, the sandbox cannot be used again.
   *
   * @returns {Promise<void>}
   * @example
   * ```typescript
   * await sandbox.dispose();
   * // Sandbox is now unusable
   * ```
   */
  async dispose(): Promise<void> {
    if (this.disposed) return;
    this.disposed = true;

    try {
      this.executionEngine.dispose();
      await this.isolateManager.disposeAll();
      if (this.isolatePool) await this.isolatePool.dispose();
      await this.sessionManager.disposeAll();
      this.memfs.clear();
      if (this.moduleSystem) this.moduleSystem.clear();
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(`Disposal error: ${err.message}`);
      this.emit('error', err);
    }

    this.eventEmitter.removeAllListeners();
    logger.info('IsoBox disposed');
  }

  private ensureNotDisposed(): void {
    if (this.disposed) {
      throw new SandboxError('Sandbox disposed', 'DISPOSED');
    }
  }

  private emit(event: string, data?: any): void {
    this.eventEmitter.emit(event, data);
  }

  getExecutionEngine(): ExecutionEngine { return this.executionEngine; }
  getIsolateManager(): IsolateManager { return this.isolateManager; }
  getIsolatePool(): IsolatePool | null { return this.isolatePool; }
  getSessionManager(): SessionManager { return this.sessionManager; }
  }
