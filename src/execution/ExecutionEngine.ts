/**
 * @fileoverview Main execution engine orchestrating code execution
 */

import { EventEmitter } from 'events';
import type { Context, Isolate } from 'isolated-vm';
import { CompiledScript } from '../core/CompiledScript.js';
import { TimeoutError } from '../core/types.js';
import { TimeoutManager, type TimeoutHandle } from './TimeoutManager.js';
import { ResourceMonitor, type ResourceStats } from './ResourceMonitor.js';
import { ExecutionContext } from './ExecutionContext.js';
import { ErrorSanitizer, type SanitizedError } from '../security/ErrorSanitizer.js';
import { Timer } from '../utils/Timer.js';
import { logger } from '../utils/Logger.js';

/**
 * Options for execution
 */
export interface ExecuteOptions {
  timeout: number;
  cpuTimeLimit: number;
  memoryLimit: number;
  strictTimeout: boolean;
  filename?: string;
  code?: string;
}

/**
 * Execution result with metrics
 */
export interface ExecutionResult<T = any> {
  value: T;
  duration: number;
  cpuTime: number;
  resourceStats?: ResourceStats;
  error?: SanitizedError;
}

/**
 * Main execution engine coordinating timeouts, resources, and error handling
 *
 * Key features:
 * - Strict timeout enforcement kills isolates on timeout
 * - Infinite loop detection using CPU time monitoring
 * - Resource tracking (CPU, memory)
 * - Error sanitization to prevent info leakage
 * - Promise.race for timeout enforcement
 */
export class ExecutionEngine {
  private timeoutManager: TimeoutManager;
  private resourceMonitor: ResourceMonitor;
  private errorSanitizer: ErrorSanitizer;
  private eventEmitter: EventEmitter;

  constructor() {
    this.timeoutManager = new TimeoutManager();
    this.resourceMonitor = new ResourceMonitor();
    this.errorSanitizer = new ErrorSanitizer();
    this.eventEmitter = new EventEmitter();

    // Wire up timeout manager events
    this.timeoutManager.on('timeout', (event) => {
      this.eventEmitter.emit('timeout', event);
    });

    this.timeoutManager.on('warning', (event) => {
      this.eventEmitter.emit('resource-warning', event);
    });

    // Wire up resource monitor events
    this.resourceMonitor.on('warning', (event) => {
      this.eventEmitter.emit('resource-warning', event);
    });
  }

  /**
   * Execute code string in an isolate
   * @param code Source code to execute
   * @param isolate The isolate to execute in
   * @param context The execution context
   * @param options Execution options
   * @returns Execution result with value and metrics
   */
  async execute<T = any>(
    code: string,
    isolate: Isolate,
    context: Context,
    options: ExecuteOptions
  ): Promise<ExecutionResult<T>> {
    const executionId = ExecutionContext.generateId();
    const timer = new Timer().start();

    const executionContext = new ExecutionContext(
      executionId,
      code,
      options.timeout,
      options.cpuTimeLimit,
      options.memoryLimit,
      undefined,
      { filename: options.filename }
    );

    logger.debug(
      `[${executionId}] Starting execution (timeout=${options.timeout}ms, cpuLimit=${options.cpuTimeLimit}ms)`
    );

    this.eventEmitter.emit('execution:start', {
      id: executionId,
      timeout: options.timeout,
      filename: options.filename,
      timestamp: Date.now(),
    });

    const timeoutHandle = this.timeoutManager.startTimeout(
      isolate,
      options.timeout,
      options.strictTimeout,
      executionId
    );

    const resourceId = this.resourceMonitor.startMonitoring(
      isolate,
      executionId,
      options.cpuTimeLimit,
      options.memoryLimit
    );

    try {
      // Compile the code
      const script = await this.createTimeoutPromise(
        isolate.compileScript(code, {
          filename: options.filename || 'script',
        }),
        options.timeout * 0.5 // Give compilation 50% of timeout budget
      );

      // Execute with timeout race
      const result = await this.createTimeoutPromise(
        script.run(context, {
          timeout: options.timeout,
          promise: true,
        }),
        options.timeout
      );

      const duration = timer.stop();

      // Stop monitoring and get stats
      this.timeoutManager.clearTimeout(executionId);
      const resourceStats = this.resourceMonitor.stopMonitoring(resourceId);

      const finalResult = this.transferResult<T>(result);

      logger.debug(
        `[${executionId}] Execution completed in ${duration.toFixed(2)}ms (cpu: ${resourceStats.finalCpuTime.toFixed(2)}ms)`
      );

      this.eventEmitter.emit('execution:complete', {
        id: executionId,
        duration,
        cpuTime: resourceStats.finalCpuTime,
        timestamp: Date.now(),
      });

      return {
        value: finalResult,
        duration,
        cpuTime: resourceStats.finalCpuTime,
        resourceStats,
      };
    } catch (error) {
      // Stop timeout and monitoring
      this.timeoutManager.clearTimeout(executionId);

      let resourceStats: ResourceStats | undefined;
      try {
        resourceStats = this.resourceMonitor.stopMonitoring(resourceId);
      } catch {
        // Resource monitoring may have already been cleaned up
      }

      const duration = timer.stop();
      const sanitizedError = this.errorSanitizer.sanitize(error, code);

      logger.debug(
        `[${executionId}] Execution failed: ${sanitizedError.message} (${duration.toFixed(2)}ms)`
      );

      this.eventEmitter.emit('execution:error', {
        id: executionId,
        error: sanitizedError.message,
        code: sanitizedError.code,
        duration,
        timestamp: Date.now(),
      });

      return {
        value: undefined as unknown as T,
        duration,
        cpuTime: resourceStats?.finalCpuTime ?? 0,
        resourceStats,
        error: sanitizedError,
      };
    }
  }

  /**
   * Execute a compiled script
   * @param compiled Compiled script to execute
   * @param context Execution context
   * @param options Execution options
   * @returns Execution result
   */
  async executeScript<T = any>(
    compiled: CompiledScript,
    context: Context,
    options: ExecuteOptions
  ): Promise<ExecutionResult<T>> {
    const code = compiled.getSource();
    return this.execute(code, (context as any).isolate, context, options);
  }

  /**
   * Wrap a promise with timeout enforcement
   * @param promise Promise to wrap
   * @param timeoutMs Timeout in milliseconds
   * @returns Promise that rejects with TimeoutError if timeout exceeded
   */
  private createTimeoutPromise<T>(
    promise: Promise<T>,
    timeoutMs: number
  ): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        setTimeout(() => {
          reject(new TimeoutError('Execution timeout exceeded', timeoutMs));
        }, timeoutMs);
      }),
    ]);
  }

  /**
   * Transfer a result from isolated-vm context to host
   * @param result Result from isolated-vm
   * @returns Transferred result
   */
  private transferResult<T>(result: any): T {
    if (result === null || result === undefined) {
      return result;
    }

    // If it has a copy method (isolated-vm Reference), call it
    if (typeof result.copy === 'function') {
      try {
        return result.copy() as T;
      } catch (err) {
        logger.debug(`Error copying result: ${err instanceof Error ? err.message : String(err)}`);
        return result;
      }
    }

    return result as T;
  }

  /**
   * Setup execution context with isolated-vm
   * @param isolate Isolate to setup context in
   * @param options Execution options
   * @returns Created context
   */
  setupExecutionContext(isolate: Isolate, options: ExecuteOptions): Context {
    try {
      const context = isolate.createContextSync();

      // Optionally set sandbox globals
      // This will be expanded in future sessions

      return context;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(`Failed to setup execution context: ${err.message}`);
      throw err;
    }
  }

  /**
   * Register event listener
   * @param event Event name
   * @param handler Event handler
   */
  on(event: string, handler: (...args: any[]) => void): void {
    this.eventEmitter.on(event, handler);
  }

  /**
   * Remove event listener
   * @param event Event name
   * @param handler Event handler
   */
  off(event: string, handler: (...args: any[]) => void): void {
    this.eventEmitter.off(event, handler);
  }

  /**
   * Get timeout manager
   */
  getTimeoutManager(): TimeoutManager {
    return this.timeoutManager;
  }

  /**
   * Get resource monitor
   */
  getResourceMonitor(): ResourceMonitor {
    return this.resourceMonitor;
  }

  /**
   * Get error sanitizer
   */
  getErrorSanitizer(): ErrorSanitizer {
    return this.errorSanitizer;
  }

  /**
   * Cleanup and dispose resources
   */
  dispose(): void {
    this.timeoutManager.clearAll();
    this.resourceMonitor.stopAll();
    this.eventEmitter.removeAllListeners();
  }
}
