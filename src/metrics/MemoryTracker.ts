/**
 * @fileoverview Memory usage tracking and profiling
 */

import { logger } from '../utils/Logger.js';

/**
 * Memory snapshot
 */
export interface MemorySnapshot {
  timestamp: number;
  heapUsed: number;
  heapTotal: number;
  external: number;
  arrayBuffers?: number;
}

/**
 * Memory statistics
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
 * Tracks memory usage over time
 */
export class MemoryTracker {
  private snapshots: MemorySnapshot[] = [];
  private interval: NodeJS.Timer | null = null;
  private intervalMs: number = 100;
  private maxSnapshots: number = 1000;
  private baseMemory: number = 0;

  constructor(intervalMs: number = 100) {
    this.intervalMs = intervalMs;
    this.baseMemory = this.captureMemory().heapUsed;

    logger.debug(`MemoryTracker initialized (interval: ${intervalMs}ms)`);
  }

  /**
   * Capture current memory snapshot
   * @returns Memory snapshot
   */
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
   * Start tracking memory
   */
  start(): void {
    if (this.interval) {
      logger.warn('Memory tracking already started');
      return;
    }

    this.snapshots = [];
    this.baseMemory = this.captureMemory().heapUsed;

    this.interval = setInterval(() => {
      const snapshot = this.captureMemory();
      this.snapshots.push(snapshot);

      // Keep only last N snapshots
      if (this.snapshots.length > this.maxSnapshots) {
        this.snapshots.shift();
      }
    }, this.intervalMs);

    logger.debug('Memory tracking started');
  }

  /**
   * Stop tracking memory
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
   * @returns Current memory in bytes
   */
  getCurrentMemory(): number {
    return this.captureMemory().heapUsed;
  }

  /**
   * Get memory delta from start
   * @returns Memory change in bytes
   */
  getMemoryDelta(): number {
    return this.getCurrentMemory() - this.baseMemory;
  }

  /**
   * Get memory statistics
   * @returns Memory statistics
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

  /**
   * Get all snapshots
   * @returns Array of memory snapshots
   */
  getSnapshots(): MemorySnapshot[] {
    return [...this.snapshots];
  }

  /**
   * Get snapshot at index
   * @param index Snapshot index
   * @returns Memory snapshot or undefined
   */
  getSnapshot(index: number): MemorySnapshot | undefined {
    return this.snapshots[index];
  }

  /**
   * Get latest snapshot
   * @returns Latest memory snapshot or undefined
   */
  getLatestSnapshot(): MemorySnapshot | undefined {
    return this.snapshots[this.snapshots.length - 1];
  }

  /**
   * Get memory growth rate (bytes per second)
   * @returns Growth rate
   */
  getGrowthRate(): number {
    if (this.snapshots.length < 2) {
      return 0;
    }

    const first = this.snapshots[0];
    const last = this.snapshots[this.snapshots.length - 1];
    const timeMs = last.timestamp - first.timestamp;
    const memoryDelta = last.heapUsed - first.heapUsed;

    if (timeMs === 0) {
      return 0;
    }

    // Return bytes per second
    return (memoryDelta / timeMs) * 1000;
  }

  /**
   * Detect memory leaks (heuristic)
   * @returns Potential leak detected
   */
  detectLeak(): boolean {
    const stats = this.getStats();
    const growthRate = this.getGrowthRate();

    // Heuristic: if consistently growing and delta > threshold
    const totalDelta = stats.delta;
    const avgMemory = stats.avg;

    // If delta is more than 10% of average and growth rate is positive
    return totalDelta > avgMemory * 0.1 && growthRate > 0;
  }

  /**
   * Get memory usage as percentage of heap
   * @returns Percentage (0-100)
   */
  getHeapUsagePercent(): number {
    const latest = this.getLatestSnapshot();
    if (!latest || latest.heapTotal === 0) {
      return 0;
    }

    return (latest.heapUsed / latest.heapTotal) * 100;
  }

  /**
   * Reset tracking
   */
  reset(): void {
    this.snapshots = [];
    this.baseMemory = this.captureMemory().heapUsed;

    logger.debug('Memory tracking reset');
  }

  /**
   * Get human-readable stats
   * @returns Formatted string
   */
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

  /**
   * Format bytes to human-readable format
   * @param bytes Bytes to format
   * @returns Formatted string
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}
