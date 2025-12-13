/**
 * @file src/metrics/MemoryTracker.ts
 * @description Tracks memory usage over time with leak detection and growth analysis
 * @since 1.0.0
 * @copyright Copyright (c) 2025 Arjun-M. This source code is licensed under the MIT license.
 * @note This tracks HOST process memory, not isolated-vm memory directly. For VM memory, use ResourceMonitor.
 */

import { logger } from '../utils/Logger.js';

/**
 * Memory snapshot at a point in time
 */
export interface MemorySnapshot {
  timestamp: number;
  heapUsed: number;
  heapTotal: number;
  external: number;
  arrayBuffers?: number;
}

/**
 * Statistical analysis of memory usage
 */
export interface MemoryStats {
  min: number;
  max: number;
  avg: number;
  delta: number;
  peakUsage: number;
  snapshots: number;
}

/**
 * @class MemoryTracker
 * Tracks memory usage over time with periodic snapshots.
 * Provides memory statistics, leak detection, and growth rate analysis.
 *
 * @example
 * ```typescript
 * // Create tracker and start monitoring
 * const tracker = new MemoryTracker(100); // snapshot every 100ms
 * tracker.start();
 *
 * // Run some code...
 * await doWork();
 *
 * // Get statistics
 * const stats = tracker.getStats();
 * console.log(`Peak memory: ${stats.peakUsage} bytes`);
 * console.log(`Growth rate: ${tracker.getGrowthRate()} bytes/sec`);
 *
 * // Check for memory leaks
 * if (tracker.detectLeak()) {
 *   console.warn('Possible memory leak detected!');
 * }
 *
 * tracker.stop();
 * ```
 */
export class MemoryTracker {
  private snapshots: MemorySnapshot[] = [];
  private interval: NodeJS.Timeout | null = null;
  private intervalMs: number = 100;
  private maxSnapshots: number = 1000;
  private baseMemory: number = 0;

  /**
   * Create a new memory tracker
   * @param intervalMs - Snapshot interval in milliseconds (default: 100)
   */
  constructor(intervalMs: number = 100) {
    this.intervalMs = intervalMs;
    this.baseMemory = this.captureMemory().heapUsed;

    logger.debug(`MemoryTracker ready (interval: ${intervalMs}ms)`);
  }

  private captureMemory(): MemorySnapshot {
    let heapUsed = 0;
    let heapTotal = 0;
    let external = 0;
    let arrayBuffers = 0;

    if (typeof process !== 'undefined' && process.memoryUsage) {
      const memUsage = process.memoryUsage();
      heapUsed = memUsage.heapUsed;
      heapTotal = memUsage.heapTotal;
      external = memUsage.external;
      arrayBuffers = memUsage.arrayBuffers;
    }

    return {
      timestamp: Date.now(),
      heapUsed,
      heapTotal,
      external,
      arrayBuffers,
    };
  }

  /**
   * Start tracking memory usage
   * Takes periodic snapshots at the configured interval
   */
  start(): void {
    if (this.interval) {
      return;
    }

    this.snapshots = [];
    this.baseMemory = this.captureMemory().heapUsed;

    this.interval = setInterval(() => {
      const snapshot = this.captureMemory();
      this.snapshots.push(snapshot);

      if (this.snapshots.length > this.maxSnapshots) {
        this.snapshots.shift();
      }
    }, this.intervalMs);

    logger.debug('Memory tracking started');
  }

  /**
   * Stop tracking memory usage
   */
  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
      logger.debug('Memory tracking stopped');
    }
  }

  /**
   * Get current memory usage
   * @returns Current heap usage in bytes
   */
  getCurrentMemory(): number {
    return this.captureMemory().heapUsed;
  }

  /**
   * Get memory change since tracking started
   * @returns Memory delta in bytes (can be negative)
   */
  getMemoryDelta(): number {
    return this.getCurrentMemory() - this.baseMemory;
  }

  /**
   * Get memory usage statistics
   * @returns Statistics including min, max, average, and peak usage
   */
  getStats(): MemoryStats {
    if (this.snapshots.length === 0) {
      return {
        min: 0,
        max: 0,
        avg: 0,
        delta: 0,
        peakUsage: 0,
        snapshots: 0,
      };
    }

    const heapUsages = this.snapshots.map((s) => s.heapUsed);
    const min = Math.min(...heapUsages);
    const max = Math.max(...heapUsages);
    const avg = heapUsages.reduce((a, b) => a + b, 0) / heapUsages.length;
    const delta = heapUsages[heapUsages.length - 1] - heapUsages[0];

    return {
      min,
      max,
      avg,
      delta,
      peakUsage: max,
      snapshots: this.snapshots.length,
    };
  }

  getSnapshots(): MemorySnapshot[] {
    return [...this.snapshots];
  }

  getSnapshot(index: number): MemorySnapshot | undefined {
    return this.snapshots[index];
  }

  getLatestSnapshot(): MemorySnapshot | undefined {
    return this.snapshots[this.snapshots.length - 1];
  }

  /**
   * Calculate memory growth rate
   * @returns Growth rate in bytes per second (can be negative)
   */
  getGrowthRate(): number {
    if (this.snapshots.length < 2) return 0;

    const first = this.snapshots[0];
    const last = this.snapshots[this.snapshots.length - 1];
    const timeMs = last.timestamp - first.timestamp;
    const memoryDelta = last.heapUsed - first.heapUsed;

    if (timeMs === 0) return 0;
    return (memoryDelta / timeMs) * 1000;
  }

  /**
   * Detect potential memory leaks based on growth patterns
   * @returns True if leak indicators are present
   */
  detectLeak(): boolean {
    const stats = this.getStats();
    const growthRate = this.getGrowthRate();
    const totalDelta = stats.delta;
    const avgMemory = stats.avg;

    return totalDelta > avgMemory * 0.1 && growthRate > 0;
  }

  getHeapUsagePercent(): number {
    const latest = this.getLatestSnapshot();
    if (!latest || latest.heapTotal === 0) return 0;
    return (latest.heapUsed / latest.heapTotal) * 100;
  }

  /**
   * Reset all snapshots and baseline memory
   */
  reset(): void {
    this.snapshots = [];
    this.baseMemory = this.captureMemory().heapUsed;
    logger.debug('Memory tracking reset');
  }

  toString(): string {
    const stats = this.getStats();
    const growthRate = this.getGrowthRate();
    const heapPercent = this.getHeapUsagePercent();
    const hasLeak = this.detectLeak();

    return (
      `Memory Stats:\n` +
      `  Min: ${this.formatBytes(stats.min)}\n` +
      `  Max: ${this.formatBytes(stats.max)}\n` +
      `  Avg: ${this.formatBytes(stats.avg)}\n` +
      `  Delta: ${this.formatBytes(stats.delta)}\n` +
      `  Growth Rate: ${growthRate.toFixed(2)} B/s\n` +
      `  Heap Usage: ${heapPercent.toFixed(2)}%\n` +
      `  Snapshots: ${stats.snapshots}\n` +
      `  Leak Detected: ${hasLeak ? 'YES' : 'NO'}`
    );
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}
