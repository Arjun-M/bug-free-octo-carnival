/**
 * @file src/metrics/PerformanceMetrics.ts
 * @description Performance metrics tracking and analysis with threshold monitoring
 * @since 1.0.0
 * @copyright Copyright (c) 2025 Arjun-M. This source code is licensed under the MIT license.
 */

import { logger } from '../utils/Logger.js';

/**
 * Performance metrics for an execution
 */
export interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  timestamp: number;
  context?: Record<string, any>;
}

/**
 * Performance thresholds
 */
export interface PerformanceThresholds {
  executionTime?: number;
  memory?: number;
  cpuUsage?: number;
  gcTime?: number;
}

/**
 * @class PerformanceMetrics
 * Tracks performance metrics during execution with configurable thresholds.
 * Records custom metrics and provides statistical analysis.
 *
 * @example
 * ```typescript
 * // Create with custom thresholds
 * const metrics = new PerformanceMetrics({
 *   executionTime: 5000,  // 5 second limit
 *   memory: 64 * 1024 * 1024,  // 64MB limit
 *   cpuUsage: 90  // 90% CPU limit
 * });
 *
 * // Start tracking
 * metrics.start();
 *
 * // Record custom metrics
 * metrics.recordMetric('api_calls', 42, 'count');
 * metrics.recordMetric('response_time', 150, 'ms');
 *
 * // Get statistics
 * const stats = metrics.getMetricStats('response_time');
 * console.log(`Avg response: ${stats.avg}ms`);
 *
 * // Export results
 * console.log(metrics.toString());
 * ```
 */
export class PerformanceMetrics {
  private metrics: Map<string, PerformanceMetric[]> = new Map();
  private thresholds: PerformanceThresholds;
  private startTime: number = 0;
  private startMemory: number = 0;

  /**
   * Create a new performance metrics tracker
   * @param thresholds - Performance thresholds for warnings (optional)
   */
  constructor(thresholds: PerformanceThresholds = {}) {
    this.thresholds = {
      executionTime: thresholds.executionTime ?? 30000,
      memory: thresholds.memory ?? 128 * 1024 * 1024,
      cpuUsage: thresholds.cpuUsage ?? 100,
      gcTime: thresholds.gcTime ?? 5000,
    };

    logger.debug('PerformanceMetrics initialized');
  }

  /**
   * Start performance tracking
   */
  start(): void {
    this.startTime = Date.now();
    this.startMemory = this.getCurrentMemory();

    logger.debug('Performance tracking started');
  }

  /**
   * Record a performance metric
   * @param name - Metric name
   * @param value - Metric value
   * @param unit - Metric unit (e.g., 'ms', 'bytes', 'count')
   * @param context - Optional context information
   *
   * @example
   * ```typescript
   * metrics.recordMetric('database_query', 45, 'ms', { query: 'SELECT * FROM users' });
   * ```
   */
  recordMetric(
    name: string,
    value: number,
    unit: string,
    context?: Record<string, any>
  ): void {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }

    const metric: PerformanceMetric = {
      name,
      value,
      unit,
      timestamp: Date.now(),
      context,
    };

    this.metrics.get(name)!.push(metric);

    // Check thresholds
    this.checkThreshold(name, value);

    logger.debug(`Recorded metric: ${name} = ${value}${unit}`);
  }

  /**
   * Get current memory usage
   * @returns Memory in bytes
   */
  private getCurrentMemory(): number {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      return process.memoryUsage().heapUsed;
    }
    return 0;
  }

  /**
   * Get elapsed time
   * @returns Time in milliseconds
   */
  getElapsedTime(): number {
    return Date.now() - this.startTime;
  }

  /**
   * Get memory delta
   * @returns Memory change in bytes
   */
  getMemoryDelta(): number {
    return this.getCurrentMemory() - this.startMemory;
  }

  /**
   * Get metric values
   * @param name Metric name
   * @returns Array of metric values
   */
  getMetricValues(name: string): number[] {
    return (this.metrics.get(name) ?? []).map((m) => m.value);
  }

  /**
   * Get metric statistics
   * @param name - Metric name
   * @returns Statistics object with min, max, avg, and count, or null if metric not found
   */
  getMetricStats(name: string): {
    min: number;
    max: number;
    avg: number;
    count: number;
  } | null {
    const values = this.getMetricValues(name);

    if (values.length === 0) {
      return null;
    }

    return {
      min: Math.min(...values),
      max: Math.max(...values),
      avg: values.reduce((a, b) => a + b, 0) / values.length,
      count: values.length,
    };
  }

  /**
   * Get all metrics
   * @returns Map of all metrics
   */
  getAllMetrics(): Map<string, PerformanceMetric[]> {
    return new Map(this.metrics);
  }

  /**
   * Get metric names
   * @returns Array of metric names
   */
  getMetricNames(): string[] {
    return Array.from(this.metrics.keys());
  }

  /**
   * Check if metric exceeds threshold
   * @param name Metric name
   * @param value Metric value
   */
  private checkThreshold(name: string, value: number): void {
    let threshold: number | undefined;

    switch (name) {
      case 'executionTime':
        threshold = this.thresholds.executionTime;
        break;
      case 'memory':
        threshold = this.thresholds.memory;
        break;
      case 'cpuUsage':
        threshold = this.thresholds.cpuUsage;
        break;
      case 'gcTime':
        threshold = this.thresholds.gcTime;
        break;
    }

    if (threshold && value > threshold) {
      logger.warn(
        `Metric ${name} exceeded threshold: ${value} > ${threshold}`
      );
    }
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.metrics.clear();
    this.startTime = 0;
    this.startMemory = 0;

    logger.debug('Performance metrics reset');
  }

  /**
   * Export metrics as JSON
   * @returns JSON object containing all metrics and statistics
   */
  toJSON(): Record<string, any> {
    const result: Record<string, any> = {};

    for (const [name, metrics] of this.metrics.entries()) {
      result[name] = {
        values: metrics.map((m) => m.value),
        unit: metrics[0]?.unit,
        count: metrics.length,
        stats: this.getMetricStats(name),
      };
    }

    return result;
  }

  /**
   * Export metrics as human-readable string
   * @returns Formatted string
   */
  toString(): string {
    const lines: string[] = ['=== Performance Metrics ==='];

    for (const name of this.getMetricNames()) {
      const stats = this.getMetricStats(name);
      if (stats) {
        lines.push(
          `${name}: min=${stats.min}, max=${stats.max}, avg=${stats.avg.toFixed(2)}, count=${stats.count}`
        );
      }
    }

    return lines.join('\n');
  }
}
