/**
 * Tracks memory usage over time.
 * Note: This tracks HOST process memory, not isolated-vm memory directly.
 * For VM memory, use ResourceMonitor.
 */

import { logger } from '../utils/Logger.js';

export interface MemorySnapshot {
  timestamp: number;
  heapUsed: number;
  heapTotal: number;
  external: number;
  arrayBuffers?: number;
}

export interface MemoryStats {
  min: number;
  max: number;
  avg: number;
  delta: number;
  peakUsage: number;
  snapshots: number;
}

export class MemoryTracker {
  private snapshots: MemorySnapshot[] = [];
  private interval: NodeJS.Timeout | null = null; 
  private intervalMs: number = 100;
  private maxSnapshots: number = 1000;
  private baseMemory: number = 0;

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

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
      logger.debug('Memory tracking stopped');
    }
  }

  getCurrentMemory(): number {
    return this.captureMemory().heapUsed;
  }

  getMemoryDelta(): number {
    return this.getCurrentMemory() - this.baseMemory;
  }

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

  getGrowthRate(): number {
    if (this.snapshots.length < 2) return 0;

    const first = this.snapshots[0];
    const last = this.snapshots[this.snapshots.length - 1];
    const timeMs = last.timestamp - first.timestamp;
    const memoryDelta = last.heapUsed - first.heapUsed;

    if (timeMs === 0) return 0;
    return (memoryDelta / timeMs) * 1000;
  }

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
