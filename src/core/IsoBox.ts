/**
 * @fileoverview IsoBox main class - Session 5 Update with Pool & Sessions
 */

import { EventEmitter } from 'events';
import type {
  IsoBoxOptions,
  RunOptions,
  ProjectOptions,
  SessionOptions,
  PoolOptions,
  GlobalMetrics,
} from './types.js';
import { SandboxError } from './types.js';
import { CompiledScript } from './CompiledScript.js';
import { IsolateManager } from '../isolate/IsolateManager.js';
import { IsolatePool } from '../isolate/IsolatePool.js';
import { ExecutionEngine } from '../execution/ExecutionEngine.js';
import { ExecutionContext } from '../execution/ExecutionContext.js';
import { MemFS } from '../filesystem/MemFS.js';
import { ModuleSystem } from '../modules/ModuleSystem.js';
import { ProjectLoader } from '../project/ProjectLoader.js';
import { SessionManager, type SessionInfo } from '../session/SessionManager.js';
import { logger } from '../utils/Logger.js';

/**
 * Main IsoBox sandbox class with pooling and sessions
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

  // Configuration
  private timeout: number;
  private cpuTimeLimit: number;
  private memoryLimit: number;
  private strictTimeout: boolean;
  private fsMaxSize: number;
  private usePooling: boolean;
  private options: IsoBoxOptions;

  /**
   * Create a new IsoBox sandbox instance
   * @param options Configuration options
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
    this.sessionManager = new SessionManager(options.sessionCleanupInterval);
    this.memfs = new MemFS({
      maxSize: this.fsMaxSize,
      root: options.filesystem?.root ?? '/',
    });
    this.eventEmitter = new EventEmitter();

    // Initialize isolate pool if enabled
    if (this.usePooling && options.pool) {
      this.isolatePool = new IsolatePool(options.pool);
    }

    // Initialize module system if require options provided
    if (options.require) {
      this.moduleSystem = new ModuleSystem(options.require, this.memfs);
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
      `IsoBox initialized (timeout=${this.timeout}ms, fsSize=${(this.fsMaxSize / 1024 / 1024).toFixed(2)}MB, pooling=${this.usePooling})`
    );
  }

  /**
   * Wire up execution engine events
   */
  private wireUpExecutionEngine(): void {
    this.executionEngine.on('execution:start', (event) => {
      this.eventEmitter.emit('execution', { type: 'start', ...event });
    });

    this.executionEngine.on('execution:complete', (event) => {
      this.eventEmitter.emit('execution', { type: 'complete', ...event });
    });

    this.executionEngine.on('execution:error', (event) => {
      this.eventEmitter.emit('execution', { type: 'error', ...event });
    });

    this.executionEngine.on('timeout', (event) => {
      this.eventEmitter.emit('timeout', event);
    });

    this.executionEngine.on('resource-warning', (event) => {
      this.eventEmitter.emit('resource-warning', event);
    });
  }

  /**
   * Validate configuration options
   */
  private validateOptions(): void {
    if (this.timeout < 0) {
      throw new SandboxError('timeout must be non-negative', 'INVALID_OPTION');
    }
    if (this.memoryLimit < 1024 * 1024) {
      throw new SandboxError(
        'memoryLimit must be at least 1MB',
        'INVALID_OPTION'
      );
    }
    if (this.cpuTimeLimit < 0) {
      throw new SandboxError('cpuTimeLimit must be non-negative', 'INVALID_OPTION');
    }
    if (this.fsMaxSize < 1024 * 1024) {
      throw new SandboxError(
        'Filesystem quota must be at least 1MB',
        'INVALID_OPTION'
      );
    }
  }

  /**
   * Execute JavaScript/TypeScript code in a sandbox
   * @param code The code to execute
   * @param opts Execution options
   * @returns Promise resolving to execution result
   */
  async run<T = any>(code: string, opts: RunOptions = {}): Promise<T> {
    this.ensureNotDisposed();

    try {
      if (!code || code.trim().length === 0) {
        throw new SandboxError('Code cannot be empty', 'EMPTY_CODE');
      }

      const timeout = opts.timeout ?? this.timeout;
      const executionId = ExecutionContext.generateId();

      this.eventEmitter.emit('execution', {
        type: 'start',
        id: executionId,
        timeout,
        filename: opts.filename,
        timestamp: Date.now(),
      });

      try {
        // Use pool if enabled
        let result: T;
        if (this.isolatePool) {
          result = await this.isolatePool.execute<T>(code);
        } else {
          // Simulate execution (real isolated-vm in session 6)
          result = await this.simulateExecution<T>(code, timeout);
        }

        this.recordMetrics(timeout, 0, 0);

        this.eventEmitter.emit('execution', {
          type: 'complete',
          id: executionId,
          duration: timeout,
          timestamp: Date.now(),
        });

        return result;
      } catch (error) {
        this.globalMetrics.errorCount++;

        const errorObj = error instanceof Error ? error : new Error(String(error));
        this.eventEmitter.emit('execution', {
          type: 'error',
          id: executionId,
          error: errorObj.message,
          timestamp: Date.now(),
        });

        throw errorObj;
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(`Execution failed: ${err.message}`);
      throw err;
    }
  }

  /**
   * Compile code for later execution
   * @param code The code to compile
   * @returns A CompiledScript instance
   */
  compile(code: string): CompiledScript {
    this.ensureNotDisposed();

    if (!code || code.trim().length === 0) {
      throw new SandboxError('Code cannot be empty', 'EMPTY_CODE');
    }

    return new CompiledScript(code, code, 'javascript');
  }

  /**
   * Execute a multi-file project
   * @param project Project configuration
   * @returns Promise resolving to execution result
   */
  async runProject<T = any>(project: ProjectOptions): Promise<T> {
    this.ensureNotDisposed();

    try {
      const prepared = ProjectLoader.loadProject(project);
      logger.info(`Loading project with ${prepared.fileCount} files`);

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
   * Run code with streaming output
   * @param code The code to execute
   * @returns Async iterable of execution results
   */
  async *runStream(code: string): AsyncIterable<any> {
    this.ensureNotDisposed();

    if (!code || code.trim().length === 0) {
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
   * Create a persistent execution session
   * @param id Session identifier
   * @param opts Session options
   * @returns The created session
   */
  async createSession(id: string, opts: SessionOptions = {}): Promise<any> {
    this.ensureNotDisposed();

    const session = this.sessionManager.createSession(id, opts);
    this.eventEmitter.emit('session:created', { sessionId: id, timestamp: Date.now() });

    return session;
  }

  /**
   * Get an existing session
   * @param id Session identifier
   * @returns The session or undefined
   */
  getSession(id: string): any {
    const session = this.sessionManager.getSession(id);
    if (session) {
      return session;
    }
    return undefined;
  }

  /**
   * List all active sessions
   * @returns Array of session info
   */
  listSessions(): SessionInfo[] {
    return this.sessionManager.listSessions();
  }

  /**
   * Delete a session
   * @param id Session identifier
   */
  async deleteSession(id: string): Promise<void> {
    await this.sessionManager.deleteSession(id);
  }

  /**
   * Warm up the isolate pool
   * @param code Optional warmup code
   */
  async warmupPool(code?: string): Promise<void> {
    this.ensureNotDisposed();

    if (!this.isolatePool) {
      throw new SandboxError('Pooling not enabled', 'POOLING_DISABLED');
    }

    await this.isolatePool.warmup(code);
  }

  /**
   * Get pool statistics
   * @returns Pool stats or null if pooling disabled
   */
  getPoolStats(): any {
    if (!this.isolatePool) {
      return null;
    }
    return this.isolatePool.getStats();
  }

  /**
   * Get the virtual filesystem
   */
  get fs(): MemFS {
    return this.memfs;
  }

  /**
   * Get the module system
   */
  getModuleSystem(): ModuleSystem | null {
    return this.moduleSystem;
  }

  /**
   * Get global metrics
   */
  getMetrics(): GlobalMetrics {
    return { ...this.globalMetrics };
  }

  /**
   * Record execution metrics
   */
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
   * Register event listener
   */
  on(event: string, handler: (...args: any[]) => void): void {
    this.eventEmitter.on(event, handler);
  }

  /**
   * Remove event listener
   */
  off(event: string, handler: (...args: any[]) => void): void {
    this.eventEmitter.off(event, handler);
  }

  /**
   * Dispose sandbox and release resources
   */
  async dispose(): Promise<void> {
    if (this.disposed) {
      return;
    }

    this.disposed = true;

    try {
      this.executionEngine.dispose();
      await this.isolateManager.disposeAll();
      if (this.isolatePool) {
        await this.isolatePool.dispose();
      }
      await this.sessionManager.disposeAll();
      this.memfs.clear();
      if (this.moduleSystem) {
        this.moduleSystem.clear();
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(`Error during disposal: ${err.message}`);
      this.emit('error', err);
    }

    this.eventEmitter.removeAllListeners();
    logger.info('IsoBox disposed');
  }

  /**
   * Check if disposed
   */
  private ensureNotDisposed(): void {
    if (this.disposed) {
      throw new SandboxError('Sandbox has been disposed', 'DISPOSED');
    }
  }

  /**
   * Emit event
   */
  private emit(event: string, data?: any): void {
    this.eventEmitter.emit(event, data);
  }

  /**
   * Simulate code execution
   */
  private async simulateExecution<T>(_code: string, _timeout: number): Promise<T> {
    return undefined as unknown as T;
  }

  /**
   * Get execution engine
   */
  getExecutionEngine(): ExecutionEngine {
    return this.executionEngine;
  }

  /**
   * Get isolate manager
   */
  getIsolateManager(): IsolateManager {
    return this.isolateManager;
  }

  /**
   * Get isolate pool
   */
  getIsolatePool(): IsolatePool | null {
    return this.isolatePool;
  }

  /**
   * Get session manager
   */
  getSessionManager(): SessionManager {
    return this.sessionManager;
  }
}
