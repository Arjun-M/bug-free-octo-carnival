/**
 * @file src/execution/TimeoutManager.ts
 * @description Strict timeout enforcement with infinite loop detection for isolated-vm execution contexts. Monitors isolate execution and terminates when time limits or suspicious CPU patterns are detected.
 * @since 1.0.0
 * @copyright Copyright (c) 2025 Arjun-M. This source code is licensed under the MIT license.
 */

import { EventEmitter } from 'events';
import type { Isolate } from 'isolated-vm';
import { logger } from '../utils/Logger.js';

/**
 * Handle for an active timeout monitoring session.
 *
 * @interface TimeoutHandle
 */
export interface TimeoutHandle {
  /** Interval ID for the monitoring loop. */
  intervalId: NodeJS.Timeout;
  /** Isolate being monitored. */
  isolate: Isolate;
  /** Start time of timeout. */
  startTime: number;
  /** Timeout duration in milliseconds. */
  timeoutMs: number;
  /** Whether timeout has been triggered. */
  triggered: boolean;
  /** Whether a warning has been emitted. */
  warned: boolean; // MINOR FIX: Added flag to prevent duplicate warnings
  /** Reason for timeout if triggered. */
  reason?: string;
}

/**
 * Manages strict execution timeouts with infinite loop detection.
 *
 * Enforces execution limits through two mechanisms:
 * 1. Hard timeout: Terminates isolate immediately when execution time exceeds limit
 * 2. Infinite loop detection: Identifies suspicious CPU patterns (>95% usage) indicating stuck code
 *
 * The manager monitors isolates at regular intervals, tracks CPU time vs wall time,
 * and emits warnings when approaching timeout thresholds.
 *
 * @class TimeoutManager
 * @example
 * ```typescript
 * const manager = new TimeoutManager();
 * const handle = manager.startTimeout(isolate, 5000, 'execution-1');
 *
 * manager.on('warning', (event) => {
 *   console.log(`Execution nearing timeout: ${event.elapsed}ms`);
 * });
 *
 * manager.on('timeout', (event) => {
 *   console.log(`Execution terminated: ${event.reason}`);
 * });
 * ```
 */
export class TimeoutManager {
  private timeouts: Map<string, TimeoutHandle> = new Map();
  private eventEmitter: EventEmitter = new EventEmitter();
  private monitoringInterval: number = 10; // Check every 10ms
  private infiniteLoopThreshold: number = 0.95; // 95% CPU usage = suspicious
  private minDetectionTime: number = 100; // Wait 100ms before judging

  constructor() {
    // Silence unused logger warning
    logger.debug('TimeoutManager ready');
  }

  /**
   * Start monitoring an isolate for timeout violations.
   *
   * Creates a monitoring interval that checks execution time and CPU usage every 10ms.
   * Terminates the isolate if execution exceeds the timeout or infinite loop is detected.
   * Emits a warning event at 80% of timeout threshold.
   *
   * @param isolate - Isolated-vm isolate to monitor
   * @param timeoutMs - Maximum execution time in milliseconds
   * @param timeoutId - Unique identifier for this timeout session
   * @returns TimeoutHandle containing monitoring metadata
   * @throws {Error} If timeout ID already exists
   * @example
   * ```typescript
   * const handle = manager.startTimeout(isolate, 5000, 'exec-123');
   * // ... code executes ...
   * manager.clearTimeout('exec-123');
   * ```
   */
      startTimeout(
        isolate: Isolate,
        timeoutMs: number,
        timeoutId: string // CRITICAL FIX: timeoutId must be provided by the caller (ExecutionEngine)
      ): TimeoutHandle {
        const id = timeoutId;
    
        if (this.timeouts.has(id)) {
          throw new Error(`Timeout ${id} already exists`);
        }
    
        const startTime = Date.now();
    
        // Check every 10ms
        const intervalId = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const cpuTimeMs = this.getCpuTimeMs(isolate);
      const handle = this.timeouts.get(id);

      if (!handle || handle.triggered) {
        clearInterval(intervalId);
        return;
      }

      // 1. Time's up
      if (elapsed >= timeoutMs) {
        this.killIsolate(isolate, id, 'timeout');
        return;
      }

      // 2. Infinite loop?
      const cpuPercent = elapsed > 0 ? cpuTimeMs / elapsed : 0;

      if (
        cpuPercent >= this.infiniteLoopThreshold &&
        elapsed >= this.minDetectionTime
      ) {
        this.killIsolate(isolate, id, 'infinite-loop');
        return;
      }

          // 3. Heads up warning at 80%
          const warningThreshold = timeoutMs * 0.8;
          if (elapsed >= warningThreshold && !handle.warned) { // MINOR FIX: Check if warning was already sent
            handle.warned = true; // Mark as warned
            this.eventEmitter.emit('warning', {
              id,
              elapsed,
              timeout: timeoutMs,
              cpuTime: cpuTimeMs,
              severity: 'high',
            });
          }
        }, this.monitoringInterval);

    const handle: TimeoutHandle = {
      intervalId,
      isolate,
      startTime,
      timeoutMs,
      triggered: false,
      warned: false, // MINOR FIX: Initialize warned flag
    };

    this.timeouts.set(id, handle);
    return handle;
  }

  /**
   * Immediately terminate an isolate and clean up monitoring resources.
   *
   * Disposes the isolate, clears the monitoring interval, and emits a timeout event
   * with termination details.
   *
   * @param isolate - Isolate to terminate
   * @param timeoutId - Timeout session identifier
   * @param reason - Reason for termination ('timeout' or 'infinite-loop')
   */
  private killIsolate(isolate: Isolate, timeoutId: string, reason: string): void {
    const handle = this.timeouts.get(timeoutId);

    if (handle) {
      handle.triggered = true;
      handle.reason = reason;
      clearInterval(handle.intervalId);
    }

    try {
      isolate.dispose();
    } catch (err) {
      // Ignore errors if already disposed
    }

    this.timeouts.delete(timeoutId);

    this.eventEmitter.emit('timeout', {
      id: timeoutId,
      reason,
      timestamp: Date.now(),
    });
  }

  /**
   * Stop monitoring an isolate and remove the timeout session.
   *
   * Clears the monitoring interval and removes the timeout handle from tracking.
   * Safe to call multiple times or with non-existent IDs.
   *
   * @param timeoutId - Timeout session identifier to clear
   */
  clearTimeout(timeoutId: string): void {
    const handle = this.timeouts.get(timeoutId);

    if (handle) {
      clearInterval(handle.intervalId);
      this.timeouts.delete(timeoutId);
    }
  }

  /**
   * Safely retrieve CPU time from an isolate.
   *
   * Extracts CPU time from isolated-vm's internal cpuTime property (in nanoseconds)
   * and converts to milliseconds. Returns 0 if unable to read CPU time.
   *
   * @param isolate - Isolate to measure
   * @returns CPU time in milliseconds
   */
  private getCpuTimeMs(isolate: Isolate): number {
    try {
      // isolated-vm exposes cpuTime in nanoseconds as BigInt
      const cpuTimeNs = (isolate as any).cpuTime;
      const val = typeof cpuTimeNs === 'bigint' ? Number(cpuTimeNs) : (Number(cpuTimeNs) || 0);
      return val / 1e6; // Convert ns to ms
    } catch {
      return 0;
    }
  }

  /**
   * Register an event listener.
   *
   * @param event - Event name ('timeout', 'warning')
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
   * Clear all active timeout monitoring sessions.
   *
   * Stops monitoring all isolates and clears all timeout handles.
   * Useful for cleanup during shutdown.
   */
  clearAll(): void {
    for (const id of this.timeouts.keys()) {
      this.clearTimeout(id);
    }
  }
}
