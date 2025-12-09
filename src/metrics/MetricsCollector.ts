/**
 * @fileoverview Metrics collection and aggregation
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
 * Collects execution metrics
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

  constructor() {
    this.eventEmitter = new EventEmitter();
    logger.debug('MetricsCollector initialized');
  }

  /**
   * Record execution metrics
   * @param metrics Execution metrics
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
   * Get current metrics
   * @returns Global metrics
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
   * @param limit Number of recent executions to return
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
   * Reset metrics
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
  on(event: string, handler: Function): void {
    this.eventEmitter.on(event, handler as any);
  }

  /**
   * Remove event listener
   * @param event Event name
   * @param handler Handler function
   */
  off(event: string, handler: Function): void {
    this.eventEmitter.off(event, handler as any);
  }
}
