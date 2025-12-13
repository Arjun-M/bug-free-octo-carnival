/**
 * @file src/execution/ExecutionEngine.ts
 * @description Core execution engine orchestrating code compilation, execution, timeout management, resource monitoring, and error sanitization. Coordinates TimeoutManager, ResourceMonitor, and ErrorSanitizer to provide safe and monitored code execution.
 * @since 1.0.0
 * @copyright Copyright (c) 2025 Arjun-M. This source code is licensed under the MIT license.
 */

import { EventEmitter } from 'events';
import type { Context, Isolate } from 'isolated-vm';
import { CompiledScript } from '../core/CompiledScript.js';
import { TimeoutError } from '../core/types.js';
import { TimeoutManager } from './TimeoutManager.js';
import { ResourceMonitor, type ResourceStats } from './ResourceMonitor.js';
import { ExecutionContext } from './ExecutionContext.js';
import { ErrorSanitizer, type SanitizedError } from '../security/ErrorSanitizer.js';
import { Timer } from '../utils/Timer.js';
import { logger } from '../utils/Logger.js';

export interface ExecuteOptions {
  timeout: number;
  cpuTimeLimit: number;
  memoryLimit: number;
  strictTimeout: boolean;
  filename?: string;
  code?: string;
}

export interface ExecutionResult<T = any> {
  value: T;
  duration: number;
  cpuTime: number;
  resourceStats?: ResourceStats;
  error?: SanitizedError;
}

/**
 * Orchestrates code execution.
 *
 * Handles:
 * - Timeouts (strict & graceful)
 * - Resource monitoring (CPU/RAM)
 * - Error sanitization
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

    this.timeoutManager.on('timeout', (event) => {
      this.eventEmitter.emit('timeout', event);
    });

    this.timeoutManager.on('warning', (event) => {
      this.eventEmitter.emit('resource-warning', event);
    });

    this.resourceMonitor.on('warning', (event) => {
      this.eventEmitter.emit('resource-warning', event);
    });
  }

  /**
   * Execute code within an isolated-vm context with comprehensive monitoring.
   *
   * Orchestrates the complete execution lifecycle including compilation, execution,
   * timeout management, resource monitoring, and error handling. Generates a unique
   * execution ID for tracking and emits lifecycle events.
   *
   * @template T - Expected return type of executed code
   * @param code - Source code to compile and execute
   * @param isolate - Isolated-vm isolate instance
   * @param context - Execution context with globals and injected APIs
   * @param options - Execution configuration (timeouts, limits)
   * @returns ExecutionResult containing value, timing, and resource stats
   * @example
   * ```typescript
   * const result = await engine.execute(
   *   'const x = 1 + 1; x',
   *   isolate,
   *   context,
   *   { timeout: 5000, cpuTimeLimit: 3000, memoryLimit: 128 * 1024 * 1024, strictTimeout: true }
   * );
   * console.log(result.value); // 2
   * ```
   */
  async execute<T = any>(
    code: string,
    isolate: Isolate,
    context: Context,
    options: ExecuteOptions
  ): Promise<ExecutionResult<T>> {
    const executionId = ExecutionContext.generateId();
    const timer = new Timer().start();

    // Log start
    logger.debug(
      `[${executionId}] Running code (timeout=${options.timeout}ms)`
    );

    this.eventEmitter.emit('execution:start', {
      id: executionId,
      timeout: options.timeout,
      filename: options.filename,
      timestamp: Date.now(),
    });

    // Start strict timeout
    this.timeoutManager.startTimeout(
      isolate,
      options.timeout,
      executionId
    );

    // Start resource monitoring
    const resourceId = this.resourceMonitor.startMonitoring(
      isolate,
      executionId,
      options.cpuTimeLimit,
      options.memoryLimit
    );

    try {
      // Compile
      // MAJOR FIX: Use ivm's built-in timeout for compilation to avoid external promise race issues
      const script = await isolate.compileScript(code, {
        filename: options.filename || 'script',
        timeout: options.timeout,
      });

      // Run
      // Use ivm's built-in timeout for execution
      const result = await script.run(context, {
        timeout: options.timeout,
        promise: true,
      });

      const duration = timer.stop();

      // Cleanup monitoring
      this.timeoutManager.clearTimeout(executionId);
      const resourceStats = this.resourceMonitor.stopMonitoring(resourceId);

      const finalResult = this.transferResult<T>(result);

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
      // Cleanup on error
      this.timeoutManager.clearTimeout(executionId);

      let resourceStats: ResourceStats | undefined;
      try {
        resourceStats = this.resourceMonitor.stopMonitoring(resourceId);
      } catch {
        // Ignore if already stopped
      }

      const duration = timer.stop();
      const sanitizedError = this.errorSanitizer.sanitize(error, code);

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
   * Execute a pre-compiled script within an isolated-vm context.
   *
   * Extracts source code from the compiled script and delegates to the standard
   * execute method. Useful when script compilation is separated from execution.
   *
   * @template T - Expected return type of executed code
   * @param compiled - Pre-compiled script instance
   * @param isolate - Isolated-vm isolate instance
   * @param context - Execution context
   * @param options - Execution configuration
   * @returns ExecutionResult containing value, timing, and resource stats
   */
  async executeScript<T = any>(
    compiled: CompiledScript,
    isolate: Isolate, // CRITICAL FIX: Added isolate to signature
    context: Context,
    options: ExecuteOptions
  ): Promise<ExecutionResult<T>> {
    const code = compiled.getSource();
    // The isolate must be passed explicitly to executeScript, as a Context does not
    // necessarily hold a reference to its parent Isolate.
    return this.execute(code, isolate, context, options);
  }

  /**
   * Transfer execution result from isolate to host environment.
   *
   * Handles isolated-vm Reference objects by calling their copy() method to transfer
   * primitive values across the isolation boundary. Falls back to returning the value
   * directly if transfer fails.
   *
   * @template T - Expected result type
   * @param result - Raw result from isolate execution
   * @returns Transferred result value
   */
  private transferResult<T>(result: any): T {
    if (result === null || result === undefined) {
      return result;
    }

    // Handle isolated-vm references
    if (typeof result.copy === 'function') {
      try {
        return result.copy() as T;
      } catch (err) {
        return result;
      }
    }

    return result as T;
  }

  /**
   * Create a fresh execution context within an isolate.
   *
   * Initializes a new synchronous context for code execution. Context setup
   * is performed synchronously to avoid race conditions during initialization.
   *
   * @param isolate - Isolated-vm isolate instance
   * @param _options - Execution options (currently unused)
   * @returns New execution context
   * @throws {Error} If context creation fails
   */
  setupExecutionContext(isolate: Isolate, _options: ExecuteOptions): Context {
    try {
      return isolate.createContextSync();
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(`Context setup failed: ${err.message}`);
      throw err;
    }
  }

  /**
   * Register an event listener for execution lifecycle events.
   *
   * @param event - Event name ('execution:start', 'execution:complete', 'execution:error', 'timeout', 'resource-warning')
   * @param handler - Event handler function
   */
  on(event: string, handler: (...args: any[]) => void): void {
    this.eventEmitter.on(event, handler);
  }

  /**
   * Remove an event listener.
   *
   * @param event - Event name
   * @param handler - Event handler to remove
   */
  off(event: string, handler: (...args: any[]) => void): void {
    this.eventEmitter.off(event, handler);
  }

  /**
   * Get the timeout manager instance.
   *
   * @returns TimeoutManager instance
   */
  getTimeoutManager(): TimeoutManager {
    return this.timeoutManager;
  }

  /**
   * Get the resource monitor instance.
   *
   * @returns ResourceMonitor instance
   */
  getResourceMonitor(): ResourceMonitor {
    return this.resourceMonitor;
  }

  /**
   * Get the error sanitizer instance.
   *
   * @returns ErrorSanitizer instance
   */
  getErrorSanitizer(): ErrorSanitizer {
    return this.errorSanitizer;
  }

  /**
   * Clean up all resources and stop monitoring.
   *
   * Clears all active timeouts, stops resource monitoring, and removes all event listeners.
   * Should be called when the engine is no longer needed.
   */
  dispose(): void {
    this.timeoutManager.clearAll();
    this.resourceMonitor.stopAll();
    this.eventEmitter.removeAllListeners();
  }
}
