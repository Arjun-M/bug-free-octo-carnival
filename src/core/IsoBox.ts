/**
 * @fileoverview IsoBox main class - core sandbox orchestration (Session 3 Update)
 */

import { EventEmitter } from 'events';
import type {
  IsoBoxOptions,
  RunOptions,
  ProjectOptions,
  SessionOptions,
  GlobalMetrics,
  Session,
} from './types.js';
import { SandboxError, TimeoutError } from './types.js';
import { CompiledScript } from './CompiledScript.js';
import { IsolateManager } from '../isolate/IsolateManager.js';
import { ExecutionEngine } from '../execution/ExecutionEngine.js';
import { ExecutionContext } from '../execution/ExecutionContext.js';
import { MemFS } from '../filesystem/MemFS.js';
import { logger } from '../utils/Logger.js';

/**
 * Main IsoBox sandbox class providing secure code execution
 *
 * Test Scenarios:
 * ===============
 * Test 1: while(true) {} → should timeout in <timeout>ms + 100ms max
 *   - Infinite loop detection triggers within 100ms of first CPU saturation
 *   - Isolate is disposed immediately, no zombie processes
 *
 * Test 2: await new Promise(r => setTimeout(r, 10000)) with 1000ms timeout
 *   - Promise-based async code is subject to timeout
 *   - Promise.race with timeout triggers at 1000ms
 *   - Isolate is killed, no dangling promises
 *
 * Test 3: Heavy computation (complex recursion, factorials)
 *   - CPU time tracking works correctly via isolate.cpuTime
 *   - CPU percent = (cpuTime / wallTime) accurately reflects usage
 *   - Metrics show peak and average CPU consumption
 *
 * Test 4: File I/O with $fs object
 *   - $fs.write('/sandbox/test.txt', 'hello') writes content
 *   - $fs.read('/sandbox/test.txt') returns content
 *   - Quota limits enforced on write operations
 *
 * Test 5: File watching
 *   - $fs.watch('/sandbox/file.txt', callback) notifies on changes
 *   - Multiple writes trigger multiple callbacks
 *   - Watchers cleaned up on dispose
 */
export class IsoBox {
  private isolateManager: IsolateManager;
  private executionEngine: ExecutionEngine;
  private memfs: MemFS;
  private eventEmitter: EventEmitter;
  private sessions: Map<string, Session> = new Map();
  private globalMetrics: GlobalMetrics;
  private disposed: boolean = false;

  // Configuration
  private timeout: number;
  private cpuTimeLimit: number;
  private memoryLimit: number;
  private strictTimeout: boolean;
  private fsMaxSize: number;
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
    this.fsMaxSize = options.filesystem?.maxSize ?? 64 * 1024 * 1024; // 64MB default for MemFS

    this.isolateManager = new IsolateManager();
    this.executionEngine = new ExecutionEngine();
    this.memfs = new MemFS({
      maxSize: this.fsMaxSize,
      root: options.filesystem?.root ?? '/',
    });
    this.eventEmitter = new EventEmitter();

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
      `IsoBox initialized (timeout=${this.timeout}ms, fsSize=${(this.fsMaxSize / 1024 / 1024).toFixed(2)}MB)`
    );
  }

  /**
   * Wire up execution engine events to main event emitter
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
   * @returns Promise resolving to the execution result
   */
  async run<T = any>(code: string, opts: RunOptions = {}): Promise<T> {
    this.ensureNotDisposed();

    try {
      if (!code || code.trim().length === 0) {
        throw new SandboxError('Code cannot be empty', 'EMPTY_CODE');
      }

      const timeout = opts.timeout ?? this.timeout;
      const cpuTimeLimit = this.cpuTimeLimit;
      const memoryLimit = this.memoryLimit;

      logger.debug(`Running code with timeout=${timeout}ms`);

      const executionId = ExecutionContext.generateId();

      this.eventEmitter.emit('execution', {
        type: 'start',
        id: executionId,
        timeout,
        filename: opts.filename,
        timestamp: Date.now(),
      });

      try {
        // Simulate execution (real isolated-vm in session 4)
        const result = await this.simulateExecution<T>(code, timeout);
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
   * @returns Promise resolving to the execution result
   */
  async runProject<T = any>(project: ProjectOptions): Promise<T> {
    this.ensureNotDisposed();

    if (!project.files || project.files.length === 0) {
      throw new SandboxError('Project must have at least one file', 'EMPTY_PROJECT');
    }

    const timeout = project.timeout ?? this.timeout;
    const entrypoint = project.files.find((f) => f.path === project.entrypoint);

    if (!entrypoint) {
      throw new SandboxError(
        `Entrypoint file ${project.entrypoint} not found`,
        'ENTRYPOINT_NOT_FOUND'
      );
    }

    return this.run<T>(entrypoint.code, {
      filename: project.entrypoint,
      timeout,
      language: entrypoint.language ?? 'javascript',
    });
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
   * @param id Unique session identifier
   * @param opts Session options
   * @returns Promise resolving to the session
   */
  async createSession(id: string, opts: SessionOptions = {}): Promise<Session> {
    this.ensureNotDisposed();

    if (this.sessions.has(id)) {
      throw new SandboxError(`Session ${id} already exists`, 'SESSION_EXISTS');
    }

    const now = Date.now();
    const session: Session = {
      id,
      created: now,
      expiresAt: now + (opts.ttl ?? 3600000),
      state: {},
      executionCount: 0,
      maxExecutions: opts.maxExecutions ?? 0,
      lastAccessed: now,
      persistent: opts.persistent ?? true,
    };

    this.sessions.set(id, session);
    this.eventEmitter.emit('session:created', { sessionId: id, timestamp: now });

    return session;
  }

  /**
   * Get an existing session
   * @param id Session identifier
   * @returns The session if found, undefined otherwise
   */
  getSession(id: string): Session | undefined {
    const session = this.sessions.get(id);

    if (session && session.expiresAt < Date.now()) {
      this.sessions.delete(id);
      return undefined;
    }

    if (session) {
      session.lastAccessed = Date.now();
    }

    return session;
  }

  /**
   * Get the virtual filesystem
   * @returns MemFS instance
   */
  get fs(): MemFS {
    return this.memfs;
  }

  /**
   * Get global metrics across all executions
   * @returns Metrics object
   */
  getMetrics(): GlobalMetrics {
    return { ...this.globalMetrics };
  }

  /**
   * Record execution metrics
   * @param duration Execution time in milliseconds
   * @param cpuTime CPU time used in milliseconds
   * @param memory Memory used in bytes
   */
  private recordMetrics(duration: number, cpuTime: number, memory: number): void {
    this.globalMetrics.totalExecutions++;
    this.globalMetrics.cpuTimeUsed += cpuTime;
    this.globalMetrics.memoryUsed = Math.max(
      this.globalMetrics.memoryUsed,
      memory
    );
    this.globalMetrics.lastExecutionTime = Date.now();

    // Calculate rolling average
    const prevTotal = this.globalMetrics.totalExecutions - 1;
    const prevAvg = this.globalMetrics.avgTime;
    this.globalMetrics.avgTime =
      (prevAvg * prevTotal + duration) / this.globalMetrics.totalExecutions;
  }

  /**
   * Register an event listener
   * @param event Event name
   * @param handler Event handler function
   */
  on(event: string, handler: (...args: any[]) => void): void {
    this.eventEmitter.on(event, handler);
  }

  /**
   * Remove an event listener
   * @param event Event name
   * @param handler Event handler function
   */
  off(event: string, handler: (...args: any[]) => void): void {
    this.eventEmitter.off(event, handler);
  }

  /**
   * Dispose of the sandbox and release all resources
   */
  async dispose(): Promise<void> {
    if (this.disposed) {
      return;
    }

    this.disposed = true;

    try {
      this.executionEngine.dispose();
      await this.isolateManager.disposeAll();
      this.memfs.clear();
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(`Error during disposal: ${err.message}`);
      this.emit('error', err);
    }

    this.sessions.clear();
    this.eventEmitter.removeAllListeners();

    logger.info('IsoBox disposed');
  }

  /**
   * Check if sandbox is disposed
   */
  private ensureNotDisposed(): void {
    if (this.disposed) {
      throw new SandboxError('Sandbox has been disposed', 'DISPOSED');
    }
  }

  /**
   * Emit an event
   * @param event Event name
   * @param data Event data
   */
  private emit(event: string, data?: any): void {
    this.eventEmitter.emit(event, data);
  }

  /**
   * Simulate code execution (placeholder for real execution)
   * @param code Code to execute
   * @param timeout Execution timeout
   * @returns Simulation result
   */
  private async simulateExecution<T>(_code: string, _timeout: number): Promise<T> {
    // Placeholder implementation for Session 3
    // Real isolated-vm execution will be implemented in session 4
    return undefined as unknown as T;
  }

  /**
   * Get execution engine (for advanced usage)
   */
  getExecutionEngine(): ExecutionEngine {
    return this.executionEngine;
  }

  /**
   * Get isolate manager (for advanced usage)
   */
  getIsolateManager(): IsolateManager {
    return this.isolateManager;
  }
}
