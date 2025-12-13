/**
 * Strict timeout enforcement with infinite loop detection.
 */

import { EventEmitter } from 'events';
import type { Isolate } from 'isolated-vm';
import { logger } from '../utils/Logger.js';

/**
 * Handle for an active timeout.
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
 * Enforces limits by:
 * 1. Hard timeout: Kills isolate immediately when time is up.
 * 2. Infinite loop check: If CPU time is too close to wall time (>95%), it's likely stuck.
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
   * Start watching an isolate. Kills it if it runs too long.
   *
   * @param isolate Isolate to monitor
   * @param timeoutMs Max runtime in ms
   * @param timeoutId Custom ID (optional)
   */
  startTimeout(
    isolate: Isolate,
    timeoutMs: number,
    timeoutId?: string
  ): TimeoutHandle {
    const id = timeoutId || `timeout-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    if (this.timeouts.has(id)) {
      throw new Error(`Timeout ${id} already exists`);
    }

    const startTime = Date.now();
    let lastCpuTime = 0;

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

      lastCpuTime = cpuTimeMs;
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
   * Kill an isolate immediately.
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
   * Stop watching an isolate.
   */
  clearTimeout(timeoutId: string): void {
    const handle = this.timeouts.get(timeoutId);

    if (handle) {
      clearInterval(handle.intervalId);
      this.timeouts.delete(timeoutId);
    }
  }

  /**
   * Get CPU time in ms. safely.
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

  on(event: string, handler: (...args: any[]) => void): void {
    this.eventEmitter.on(event, handler);
  }

  off(event: string, handler: (...args: any[]) => void): void {
    this.eventEmitter.off(event, handler);
  }

  clearAll(): void {
    for (const id of this.timeouts.keys()) {
      this.clearTimeout(id);
    }
  }
}
