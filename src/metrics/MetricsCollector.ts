/**
 * @file src/metrics/MetricsCollector.ts
 * @description Metrics collection and aggregation for execution monitoring
 * @since 1.0.0
 * @copyright Copyright (c) 2025 Arjun-M. This source code is licensed under the MIT license.
 */

import { EventEmitter } from '../utils/EventEmitter.js';
import { logger } from '../utils/Logger.js';

/**
 * Execution metrics
 */
export interface ExecutionMetrics {
  duration: number;
  cpuTime: number;
  memory: {
    heap: number;
    external: number;
    rss: number;
  };
  success: boolean;
  error?: Error;
  timestamp: number;
}

/**
 * Global metrics summary
 */
export interface GlobalMetrics {
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  errorRate: number;
  avgExecutionTime: number;
  totalDuration: number;
  totalCpuTime: number;
  totalMemoryUsed: number;
  peakMemory: number;
  slowestExecution: ExecutionMetrics | null;
  fastestExecution: ExecutionMetrics | null;
  mostCommonError: string | null;
}

/**
 * @class MetricsCollector
 * Collects and aggregates execution metrics across multiple runs.
 * Tracks success rates, timing, memory usage, and error patterns.
 *
 * @example
 * ```typescript
 * // Create collector
 * const collector = new MetricsCollector();
 *
 * // Record execution
 * collector.recordExecution({
 *   duration: 150,
 *   cpuTime: 145,
 *   memory: { heap: 1024000, external: 512, rss: 2048000 },
 *   success: true,
 *   timestamp: Date.now()
 * });
 *
 * // Get metrics
 * const metrics = collector.getMetrics();
 * console.log(`Success rate: ${(1 - metrics.errorRate) * 100}%`);
 * console.log(`Avg execution time: ${metrics.avgExecutionTime}ms`);
 *
 * // Listen to events
 * collector.on('metrics:recorded', (metrics) => {
 *   console.log('New execution recorded:', metrics);
 * });
 * ```
 */
export class MetricsCollector {
  private totalExecutions = 0;
  private failedExecutions = 0;
  private totalDuration = 0;
  private totalCpuTime = 0;
  private totalMemory = 0;
  private peakMemory = 0;
  private executionHistory: ExecutionMetrics[] = [];
  private errorCounts: Map<string, number> = new Map();
  private eventEmitter: EventEmitter;

  /**
   * Create a new metrics collector
   */
  constructor() {
    this.eventEmitter = new EventEmitter();
    logger.debug('MetricsCollector initialized');
  }

  /**
   * Record execution metrics
   * @param metrics - Execution metrics to record
   *
   * @example
   * ```typescript
   * collector.recordExecution({
   *   duration: 100,
   *   cpuTime: 95,
   *   memory: { heap: 1000000, external: 0, rss: 2000000 },
   *   success: true,
   *   timestamp: Date.now()
   * });
   * ```
   */
  recordExecution(metrics: ExecutionMetrics): void {
    this.totalExecutions++;

    if (!metrics.success) {
      this.failedExecutions++;
      if (metrics.error) {
        const errorName = metrics.error.name || 'Unknown';
        this.errorCounts.set(
          errorName,
          (this.errorCounts.get(errorName) ?? 0) + 1
        );
      }
    }

    this.totalDuration += metrics.duration;
    this.totalCpuTime += metrics.cpuTime;
    this.totalMemory += metrics.memory.heap;

    // Track peak memory
    if (metrics.memory.heap > this.peakMemory) {
      this.peakMemory = metrics.memory.heap;
    }

    // Keep last 100 executions
    this.executionHistory.push(metrics);
    if (this.executionHistory.length > 100) {
      this.executionHistory.shift();
    }

    logger.debug(
      `Recorded execution: ${metrics.duration}ms, ${metrics.memory.heap}b`
    );
    this.eventEmitter.emit('metrics:recorded', metrics);
  }

  /**
   * Get current metrics summary
   * @returns Global metrics including totals, averages, and error analysis
   */
  getMetrics(): GlobalMetrics {
    const avgTime =
      this.totalExecutions > 0 ? this.totalDuration / this.totalExecutions : 0;
    const errorRate =
      this.totalExecutions > 0 ? this.failedExecutions / this.totalExecutions : 0;

    const slowest = this.getSlowestExecution();
    const fastest = this.getFastestExecution();
    const commonError = this.getMostCommonError();

    return {
      totalExecutions: this.totalExecutions,
      successfulExecutions: this.totalExecutions - this.failedExecutions,
      failedExecutions: this.failedExecutions,
      errorRate,
      avgExecutionTime: avgTime,
      totalDuration: this.totalDuration,
      totalCpuTime: this.totalCpuTime,
      totalMemoryUsed: this.totalMemory,
      peakMemory: this.peakMemory,
      slowestExecution: slowest,
      fastestExecution: fastest,
      mostCommonError: commonError,
    };
  }

  /**
   * Get execution history
   * @param limit - Number of recent executions to return (default: 10)
   * @returns Array of most recent execution metrics
   */
  getExecutionHistory(limit: number = 10): ExecutionMetrics[] {
    return this.executionHistory.slice(-limit);
  }

  /**
   * Get slowest execution
   */
  private getSlowestExecution(): ExecutionMetrics | null {
    if (this.executionHistory.length === 0) return null;

    return this.executionHistory.reduce((prev, current) =>
      current.duration > prev.duration ? current : prev
    );
  }

  /**
   * Get fastest execution
   */
  private getFastestExecution(): ExecutionMetrics | null {
    if (this.executionHistory.length === 0) return null;

    return this.executionHistory.reduce((prev, current) =>
      current.duration < prev.duration ? current : prev
    );
  }

  /**
   * Get most common error
   */
  private getMostCommonError(): string | null {
    if (this.errorCounts.size === 0) return null;

    let maxError = '';
    let maxCount = 0;

    for (const [error, count] of this.errorCounts.entries()) {
      if (count > maxCount) {
        maxCount = count;
        maxError = error;
      }
    }

    return maxError;
  }

  /**
   * Reset all metrics and history
   */
  reset(): void {
    this.totalExecutions = 0;
    this.failedExecutions = 0;
    this.totalDuration = 0;
    this.totalCpuTime = 0;
    this.totalMemory = 0;
    this.peakMemory = 0;
    this.executionHistory = [];
    this.errorCounts.clear();

    logger.debug('Metrics reset');
    this.eventEmitter.emit('metrics:reset');
  }

  /**
   * Listen to metrics events
   * @param event Event name
   * @param handler Handler function
   */
  // eslint-disable-next-line @typescript-eslint/ban-types
  on(event: string, handler: Function): void {
    this.eventEmitter.on(event, handler as any);
  }

  /**
   * Remove event listener
   * @param event Event name
   * @param handler Handler function
   */
  // eslint-disable-next-line @typescript-eslint/ban-types
  off(event: string, handler: Function): void {
    this.eventEmitter.off(event, handler as any);
  }
}
