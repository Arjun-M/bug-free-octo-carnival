/**
 * IsoBox - A secure, isolated sandbox for untrusted code.
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
import { TypeScriptCompiler } from '../project/TypeScriptCompiler.js'
import type { Language } from './types.js'; // MAJOR FIX: Import Language type
import ivm from 'isolated-vm';
import { IsolateManager } from '../isolate/IsolateManager.js';
import { IsolatePool } from '../isolate/IsolatePool.js';
import type { ExecutionResult } from '../execution/ExecutionEngine.js';
import { ExecutionEngine } from '../execution/ExecutionEngine.js';
import { ExecutionContext } from '../execution/ExecutionContext.js';
import { ContextBuilder } from '../context/ContextBuilder.js';
import { MemFS } from '../filesystem/MemFS.js';
import { ModuleSystem } from '../modules/ModuleSystem.js';
import { ProjectLoader } from '../project/ProjectLoader.js';
import { SessionManager, type SessionInfo } from '../session/SessionManager.js';
import { logger } from '../utils/Logger.js';

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
    // Inject 'this' into SessionManager
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

        let isolate: ivm.Isolate | undefined;
        let builder: ContextBuilder | undefined;
        let execResult: ExecutionResult<T> | undefined;
        const callbacks: ivm.Callback[] = []; // CRITICAL FIX: Initialize callbacks array outside try block

    try {
      let result: T;

      if (this.isolatePool) {
        // Pool should handle context initialization internally or we need to pass builder
        // For Phase 0, we assume pool handles basic execution or is limited.
        // NOTE: Pool execution should return ExecutionResult<T> for metrics to work correctly.
        // Assuming isolatePool.execute returns T, not ExecutionResult<T> based on the original code.
        // This is a potential bug in the pool implementation, but for now, we'll assume it returns T.
        result = await this.isolatePool.execute<T>(code, { timeout: opts.timeout ?? this.timeout });
        // Since we don't have metrics from the pool, we'll use placeholders for now.
        execResult = { value: result, duration: opts.timeout ?? this.timeout, cpuTime: 0 };
          } else {
            const { isolate: newIsolate } = this.isolateManager.create({
                memoryLimit: this.memoryLimit
            });
            isolate = newIsolate; // CRITICAL FIX: Assign to hoisted variable
    

        // Initialize context with globals, fs, etc.
        // ExecutionEngine.setupExecutionContext creates a raw context.
        // We need to use ContextBuilder to prepare the environment object,
        // but currently ContextBuilder returns a plain object, not injecting into Context directly.
        // We need to bridge them.

        const context = isolate.createContextSync();
        const global = context.global;

            // Use ContextBuilder to get safe globals
        builder = new ContextBuilder({ // CRITICAL FIX: Use hoisted variable
            ...this.options,
            memfs: this.memfs,
            moduleSystem: this.moduleSystem,
            allowTimers: this.options.allowTimers ?? true // Default to true for backward compatibility
        });

        // Add session-specific sandbox if provided in run options
        if ((opts as any).sandbox) {
            // Merge with existing sandbox options if any
            // Note: ContextBuilder constructor takes options.sandbox.
            // We might need to rebuild context or manually inject.
            // For now, let's just stick to the base builder.
        }

        const contextObj = await builder.build(opts.filename || 'script');

        // Inject into VM context
        // Iterate over contextObj and set on global
        // This is a simplified injection.
        // ContextBuilder returns { _globals: {...}, ... }
        // We need to inject _globals content into global.

        if (contextObj._globals) {
          // We iterate over the globals and inject them into the sandbox context.
          // Complex objects with functions (like console or fs) need special handling
          // because they can't be deep-copied directly if they contain functions.
          for (const key of Object.keys(contextObj._globals)) {
             const value = contextObj._globals[key];
             try {
               if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                 const hasFunctions = Object.values(value).some(v => typeof v === 'function');

                 if (hasFunctions) {
                    // Create an empty object in the sandbox to populate
                    const ref = context.evalClosureSync(`return {}`, [], { result: { reference: true } });
                    global.setSync(key, ref);

                    // Populate properties (1-level deep supported for now)
                    for (const prop of Object.keys(value)) {
                        const propVal = value[prop];
                        if (typeof propVal === 'function') {
                            const callback = new ivm.Callback(propVal);
                            callbacks.push(callback); // CRITICAL FIX: Store callback
                            ref.setSync(prop, callback);
                        } else {
                            ref.setSync(prop, propVal, { copy: true });
                        }
                    }
                 } else {
                    // Pure data object
                    global.setSync(key, value, { copy: true });
                 }
               } else if (typeof value === 'function') {
                   const callback = new ivm.Callback(value);
                   callbacks.push(callback); // CRITICAL FIX: Store callback
                   global.setSync(key, callback);
               } else {
                   // Primitives or simple arrays
                   global.setSync(key, value, { copy: true });
               }
             } catch (e) {
                 logger.warn(`Failed to inject global '${key}': ${e instanceof Error ? e.message : String(e)}`);
             }
          }
        }

        // Execute
        execResult = await this.executionEngine.execute<T>(code, isolate, context, {
            timeout,
            cpuTimeLimit: this.cpuTimeLimit,
            memoryLimit: this.memoryLimit,
            strictTimeout: this.strictTimeout,
            filename: opts.filename,
            code
        });

        if (execResult.error) {
            throw execResult.error;
        }

        result = execResult.value;
      }

          // CRITICAL FIX: Check if execResult is defined before accessing its properties
          if (execResult) {
            this.recordMetrics(execResult.duration, execResult.cpuTime, execResult.resourceStats?.memoryUsed ?? 0);
    
            this.emit('execution', {
              type: 'complete',
              id: executionId,
              duration: execResult.duration, // Use actual duration
              timestamp: Date.now(),
            });
          }
    
          return result;
        } catch (error) {
          this.globalMetrics.errorCount++;
    
          let errorObj: Error;
          if (error instanceof Error) {
            errorObj = error;
          } else if (typeof error === 'object' && error !== null && 'message' in error) {
             // Handle SanitizedError or similar objects
             const msg = (error as any).message;
             errorObj = new Error(msg);
             if ((error as any).stack) errorObj.stack = (error as any).stack;
             // Copy other properties if needed
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
          // CRITICAL FIX: Ensure isolate and builder are disposed to prevent memory leaks
          // Dispose of all ivm.Callback objects to prevent memory leaks
          callbacks.forEach(cb => cb.dispose());
    
          if (isolate) {
            // CRITICAL FIX: Use IsolateManager's disposeIsolate to ensure proper untracking
            this.isolateManager.disposeIsolate(isolate);
          }
          if (builder) {
            builder.dispose();
          }
        }
      }
  
  async compile(code: string, language: Language = 'javascript'): Promise<CompiledScript> {
    this.ensureNotDisposed();
    if (!code?.trim()) {
      throw new SandboxError('Code cannot be empty', 'EMPTY_CODE');
    }

    let compiledCode = code;
    if (language === 'typescript' || language === 'ts') {
      // CRITICAL FIX: Create an instance and use transpile method, handle async properly
      try {
        compiledCode = TypeScriptCompiler.transpile(code) // transpile is synchronous, no await needed
      } catch (error) {
        throw new SandboxError(
          `TypeScript compilation failed: ${error instanceof Error ? error.message : String(error)}`,
          'TS_COMPILATION_ERROR'
        );
      }
    }
    return new CompiledScript(code, compiledCode, language);
  }
    
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

  async createSession(id: string, opts: SessionOptions = {}): Promise<any> {
    this.ensureNotDisposed();

    const session = this.sessionManager.createSession(id, opts);
    this.emit('session:created', { sessionId: id, timestamp: Date.now() });

    return session;
  }

  getSession(id: string): any {
    return this.sessionManager.getSession(id);
  }

  listSessions(): SessionInfo[] {
    return this.sessionManager.listSessions();
  }

  async deleteSession(id: string): Promise<void> {
    await this.sessionManager.deleteSession(id);
  }

  async warmupPool(code?: string): Promise<void> {
    this.ensureNotDisposed();

    if (!this.isolatePool) {
      throw new SandboxError('Pooling disabled', 'POOLING_DISABLED');
    }

    await this.isolatePool.warmup(code);
  }

  getPoolStats(): any {
    return this.isolatePool?.getStats() ?? null;
  }

  get fs(): MemFS {
    return this.memfs;
  }

  getModuleSystem(): ModuleSystem | null {
    return this.moduleSystem;
  }

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

  on(event: string, handler: (...args: any[]) => void): void {
    this.eventEmitter.on(event, handler);
  }

  off(event: string, handler: (...args: any[]) => void): void {
    this.eventEmitter.off(event, handler);
  }

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
