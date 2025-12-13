/**
 * Core execution engine.
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
   * Run code in the given isolate.
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
            timeout: options.timeout, // Use the full execution timeout for compilation
          });

      // Run
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
   * Run a pre-compiled script.
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
   * Move result from VM to Host.
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
   * Create a fresh context.
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

  on(event: string, handler: (...args: any[]) => void): void {
    this.eventEmitter.on(event, handler);
  }

  off(event: string, handler: (...args: any[]) => void): void {
    this.eventEmitter.off(event, handler);
  }

  getTimeoutManager(): TimeoutManager {
    return this.timeoutManager;
  }

  getResourceMonitor(): ResourceMonitor {
    return this.resourceMonitor;
  }

  getErrorSanitizer(): ErrorSanitizer {
    return this.errorSanitizer;
  }

  dispose(): void {
    this.timeoutManager.clearAll();
    this.resourceMonitor.stopAll();
    this.eventEmitter.removeAllListeners();
  }
}
