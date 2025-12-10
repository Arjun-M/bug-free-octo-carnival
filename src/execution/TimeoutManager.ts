/**
 * @fileoverview Strict timeout enforcement with infinite loop detection
 */

import { EventEmitter } from 'events';
import type { Isolate } from 'isolated-vm';
import { TimeoutError } from '../core/types.js';
import { logger } from '../utils/Logger.js';

/**
 * Handle for an active timeout
 */
export interface TimeoutHandle {
  /** Interval ID for the monitoring loop */
  intervalId: NodeJS.Timeout;
  /** Isolate being monitored */
  isolate: Isolate;
  /** Start time of timeout */
  startTime: number;
  /** Timeout duration in milliseconds */
  timeoutMs: number;
  /** Whether timeout has been triggered */
  triggered: boolean;
  /** Reason for timeout if triggered */
  reason?: string;
}

/**
 * Manages strict execution timeouts with infinite loop detection
 *
 * Key behavior:
 * - Hard timeout: isolate.dispose() is called immediately when timeout exceeded
 * - Infinite loop detection: if CPU time ≈ wall-clock time (>95%), likely infinite loop
 * - Monitoring interval: 10ms for responsive timeout enforcement
 * - Strict kill: no graceful shutdown, direct disposal
 */
export class TimeoutManager {
  private timeouts: Map<string, TimeoutHandle> = new Map();
  private eventEmitter: EventEmitter = new EventEmitter();
  private monitoringInterval: number = 10; // 10ms monitoring interval
  private infiniteLoopThreshold: number = 0.95; // 95% CPU usage = likely infinite loop
  private minDetectionTime: number = 100; // Require 100ms before declaring infinite loop

  /**
   * Start a timeout for an isolate with strict enforcement
   * @param isolate The isolate to monitor
   * @param timeoutMs Timeout duration in milliseconds
   * @param strictKill Whether to force immediate disposal (true) or graceful shutdown (false)
   * @param timeoutId Optional ID for the timeout (generated if not provided)
   * @returns Handle for managing the timeout
   */
  startTimeout(
    isolate: Isolate,
    timeoutMs: number,
    strictKill: boolean = true,
    timeoutId?: string
  ): TimeoutHandle {
    const id = timeoutId || `timeout-${Date.now()}-${Math.random()}`;

    if (this.timeouts.has(id)) {
      throw new Error(`Timeout ${id} already exists`);
    }

    const startTime = Date.now();
    let lastCpuTime = 0;

    logger.debug(`Starting timeout for ${timeoutMs}ms (strict=${strictKill})`);

    // Monitor loop: check timeout and infinite loops every 10ms
    const intervalId = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const cpuTimeMs = this.getCpuTimeMs(isolate);
      const handle = this.timeouts.get(id);

      if (!handle || handle.triggered) {
        clearInterval(intervalId);
        return;
      }

      // Check 1: Wall-clock timeout exceeded
      if (elapsed >= timeoutMs) {
        logger.warn(`Timeout exceeded after ${elapsed}ms, killing isolate`);
        this.killIsolate(isolate, id, 'timeout');
        return;
      }

      // Check 2: Infinite loop detection (CPU time ≈ wall-clock time)
      const cpuPercent = elapsed > 0 ? cpuTimeMs / elapsed : 0;

      if (
        cpuPercent >= this.infiniteLoopThreshold &&
        elapsed >= this.minDetectionTime
      ) {
        logger.warn(
          `Infinite loop detected (${(cpuPercent * 100).toFixed(1)}% CPU after ${elapsed}ms), killing isolate`
        );
        this.killIsolate(isolate, id, 'infinite-loop');
        return;
      }

      // Check 3: Gradual timeout warning at 80% of timeout
      if (elapsed >= timeoutMs * 0.8 && lastCpuTime < timeoutMs * 0.8) {
        logger.debug(`Approaching timeout (${elapsed}ms / ${timeoutMs}ms)`);
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
    };

    this.timeouts.set(id, handle);
    return handle;
  }

  /**
   * Start CPU time monitoring for a specific limit
   * @param isolate The isolate to monitor
   * @param cpuLimitMs CPU time limit in milliseconds
   * @param timeoutId Optional ID for the timeout
   * @returns Handle for managing the timeout
   */
  startCpuMonitoring(
    isolate: Isolate,
    cpuLimitMs: number,
    timeoutId?: string
  ): TimeoutHandle {
    const id = timeoutId || `cpu-monitor-${Date.now()}-${Math.random()}`;

    if (this.timeouts.has(id)) {
      throw new Error(`Timeout ${id} already exists`);
    }

    const startTime = Date.now();

    logger.debug(`Starting CPU monitoring with limit ${cpuLimitMs}ms`);

    const intervalId = setInterval(() => {
      const cpuTimeMs = this.getCpuTimeMs(isolate);
      const handle = this.timeouts.get(id);

      if (!handle || handle.triggered) {
        clearInterval(intervalId);
        return;
      }

      // CPU time exceeded limit
      if (cpuTimeMs >= cpuLimitMs) {
        logger.warn(`CPU limit exceeded (${cpuTimeMs}ms / ${cpuLimitMs}ms), killing isolate`);
        this.killIsolate(isolate, id, 'cpu-limit');
        return;
      }

      // Warning at 80% of CPU limit
      if (cpuTimeMs >= cpuLimitMs * 0.8) {
        this.eventEmitter.emit('warning', {
          id,
          cpuTime: cpuTimeMs,
          cpuLimit: cpuLimitMs,
          severity: 'high',
        });
      }
    }, this.monitoringInterval);

    const handle: TimeoutHandle = {
      intervalId,
      isolate,
      startTime,
      timeoutMs: cpuLimitMs,
      triggered: false,
    };

    this.timeouts.set(id, handle);
    return handle;
  }

  /**
   * Detect if an isolate is likely in an infinite loop
   * @param isolate Isolate to check
   * @param wallTimeMs Wall-clock time elapsed
   * @returns True if likely infinite loop
   */
  detectInfiniteLoop(isolate: Isolate, wallTimeMs: number = 0): boolean {
    if (wallTimeMs < this.minDetectionTime) {
      return false;
    }

    const cpuTimeMs = this.getCpuTimeMs(isolate);
    const cpuPercent = wallTimeMs > 0 ? cpuTimeMs / wallTimeMs : 0;

    return cpuPercent >= this.infiniteLoopThreshold;
  }

  /**
   * Kill an isolate with immediate disposal
   * @param isolate Isolate to kill
   * @param timeoutId Timeout ID
   * @param reason Reason for killing
   */
  private killIsolate(isolate: Isolate, timeoutId: string, reason: string): void {
    const handle = this.timeouts.get(timeoutId);

    if (handle) {
      handle.triggered = true;
      handle.reason = reason;
      clearInterval(handle.intervalId);
    }

    try {
      // Hard kill: immediate disposal with no cleanup
      (isolate as any).dispose?.();
    } catch (err) {
      logger.debug(`Error disposing isolate: ${err instanceof Error ? err.message : String(err)}`);
    }

    this.timeouts.delete(timeoutId);

    logger.info(`Isolate killed (reason: ${reason})`);
    this.eventEmitter.emit('timeout', {
      id: timeoutId,
      reason,
      timestamp: Date.now(),
    });
  }

  /**
   * Clear a timeout without killing the isolate
   * @param timeoutId Timeout ID to clear
   */
  clearTimeout(timeoutId: string): void {
    const handle = this.timeouts.get(timeoutId);

    if (handle) {
      clearInterval(handle.intervalId);
      this.timeouts.delete(timeoutId);
      logger.debug(`Timeout cleared for ${timeoutId}`);
    }
  }

  /**
   * Get CPU time from an isolate in milliseconds
   * @param isolate Isolate to get CPU time from
   * @returns CPU time in milliseconds
   */
  private getCpuTimeMs(isolate: Isolate): number {
    try {
      // isolated-vm exposes cpuTime in microseconds
      const cpuTimeUs = (isolate as any).cpuTime || 0;
      return cpuTimeUs / 1000; // Convert to milliseconds
    } catch {
      return 0;
    }
  }

  /**
   * Register event listener
   * @param event Event name
   * @param handler Handler function
   */
  on(event: string, handler: (...args: any[]) => void): void {
    this.eventEmitter.on(event, handler);
  }

  /**
   * Remove event listener
   * @param event Event name
   * @param handler Handler function
   */
  off(event: string, handler: (...args: any[]) => void): void {
    this.eventEmitter.off(event, handler);
  }

  /**
   * Get all active timeouts
   * @returns Array of timeout IDs
   */
  getActiveTimeouts(): string[] {
    return Array.from(this.timeouts.keys());
  }

  /**
   * Clear all timeouts
   */
  clearAll(): void {
    for (const id of this.timeouts.keys()) {
      this.clearTimeout(id);
    }
  }

  /**
   * Get timeout statistics
   * @returns Statistics object
   */
  getStats(): {
    activeTimeouts: number;
    triggeredTimeouts: number;
  } {
    const triggered = Array.from(this.timeouts.values()).filter(
      (h) => h.triggered
    ).length;

    return {
      activeTimeouts: this.timeouts.size - triggered,
      triggeredTimeouts: triggered,
    };
  }

  /**
   * Set infinite loop detection threshold
   * @param percent CPU percent (0-1) above which to trigger
   */
  setInfiniteLoopThreshold(percent: number): void {
    if (percent < 0 || percent > 1) {
      throw new Error('Threshold must be between 0 and 1');
    }
    this.infiniteLoopThreshold = percent;
  }

  /**
   * Set minimum time before infinite loop detection
   * @param ms Minimum elapsed time in milliseconds
   */
  setMinDetectionTime(ms: number): void {
    if (ms < 0) {
      throw new Error('Detection time must be non-negative');
    }
    this.minDetectionTime = ms;
  }
}
