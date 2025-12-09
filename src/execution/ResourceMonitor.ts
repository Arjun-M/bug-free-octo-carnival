/**
 * @fileoverview Resource monitoring for CPU and memory usage
 */

import { EventEmitter } from 'events';
import type { Isolate } from 'isolated-vm';

/**
 * Current resource usage snapshot
 */
export interface ResourceUsage {
  /** CPU time consumed in milliseconds */
  cpuTime: number;
  /** Wall-clock duration in milliseconds */
  wallTime: number;
  /** Heap memory used in bytes */
  heapUsed: number;
  /** Heap memory limit in bytes */
  heapLimit: number;
  /** External memory in bytes */
  externalMemory: number;
  /** Total memory in bytes */
  totalMemory: number;
  /** CPU percentage (0-100) */
  cpuPercent: number;
  /** Memory percentage (0-100) */
  memoryPercent: number;
}

/**
 * Accumulated resource statistics
 */
export interface ResourceStats {
  /** Peak CPU time in milliseconds */
  peakCpuTime: number;
  /** Peak heap memory in bytes */
  peakHeapUsed: number;
  /** Peak total memory in bytes */
  peakTotalMemory: number;
  /** Final CPU time in milliseconds */
  finalCpuTime: number;
  /** Final memory usage */
  finalUsage: ResourceUsage;
  /** Average CPU percentage over monitoring period */
  avgCpuPercent: number;
  /** Total monitoring duration in milliseconds */
  duration: number;
}

/**
 * Handle for active monitoring session
 */
interface MonitorHandle {
  intervalId: NodeJS.Timeout;
  startTime: number;
  samples: ResourceUsage[];
  isolate: Isolate;
}

/**
 * Monitors CPU and memory resource usage during execution
 */
export class ResourceMonitor {
  private handles: Map<string, MonitorHandle> = new Map();
  private eventEmitter: EventEmitter = new EventEmitter();
  private monitoringInterval: number = 10; // Check every 10ms

  /**
   * Start monitoring a resource
   * @param isolate The isolate to monitor
   * @param resourceId Unique identifier for this monitoring session
   * @param cpuLimit CPU limit in milliseconds (for warnings)
   * @param memoryLimit Memory limit in bytes (for warnings)
   * @returns Handle for stopping monitoring
   */
  startMonitoring(
    isolate: Isolate,
    resourceId: string,
    cpuLimit?: number,
    memoryLimit?: number
  ): string {
    if (this.handles.has(resourceId)) {
      throw new Error(`Monitoring already active for ${resourceId}`);
    }

    const startTime = Date.now();
    const samples: ResourceUsage[] = [];

    const intervalId = setInterval(() => {
      try {
        const usage = this.getCurrentUsage(isolate, startTime);
        samples.push(usage);

        // Check if approaching limits
        if (cpuLimit && usage.cpuTime >= cpuLimit * 0.8) {
          this.eventEmitter.emit('warning', {
            type: 'cpu-warning-80',
            resourceId,
            usage,
            cpuLimit,
          });
        }

        if (memoryLimit && usage.totalMemory >= memoryLimit * 0.8) {
          this.eventEmitter.emit('warning', {
            type: 'memory-warning-80',
            resourceId,
            usage,
            memoryLimit,
          });
        }

        if (cpuLimit && usage.cpuTime >= cpuLimit * 0.95) {
          this.eventEmitter.emit('warning', {
            type: 'cpu-warning-95',
            resourceId,
            usage,
            cpuLimit,
          });
        }

        if (memoryLimit && usage.totalMemory >= memoryLimit * 0.95) {
          this.eventEmitter.emit('warning', {
            type: 'memory-warning-95',
            resourceId,
            usage,
            memoryLimit,
          });
        }
      } catch (err) {
        // Isolate may be disposed, silently ignore
      }
    }, this.monitoringInterval);

    this.handles.set(resourceId, {
      intervalId,
      startTime,
      samples,
      isolate,
    });

    return resourceId;
  }

  /**
   * Stop monitoring and get accumulated statistics
   * @param resourceId Monitoring session ID
   * @returns Resource statistics since monitoring started
   */
  stopMonitoring(resourceId: string): ResourceStats {
    const handle = this.handles.get(resourceId);
    if (!handle) {
      throw new Error(`No active monitoring for ${resourceId}`);
    }

    clearInterval(handle.intervalId);
    const duration = Date.now() - handle.startTime;

    const finalUsage = this.getCurrentUsage(handle.isolate, handle.startTime);
    const peakCpuTime = Math.max(...handle.samples.map((s) => s.cpuTime), 0);
    const peakHeapUsed = Math.max(...handle.samples.map((s) => s.heapUsed), 0);
    const peakTotalMemory = Math.max(...handle.samples.map((s) => s.totalMemory), 0);

    const avgCpuPercent =
      handle.samples.length > 0
        ? handle.samples.reduce((sum, s) => sum + s.cpuPercent, 0) /
          handle.samples.length
        : 0;

    this.handles.delete(resourceId);

    return {
      peakCpuTime,
      peakHeapUsed,
      peakTotalMemory,
      finalCpuTime: finalUsage.cpuTime,
      finalUsage,
      avgCpuPercent,
      duration,
    };
  }

  /**
   * Get current resource usage snapshot
   * @param isolate Isolate to get usage for
   * @param startTime Start time for computing wall time
   * @returns Current resource usage
   */
  getCurrentUsage(isolate: Isolate, startTime: number = Date.now()): ResourceUsage {
    const wallTime = Date.now() - startTime;

    let cpuTime = 0;
    let heapUsed = 0;
    let heapLimit = 0;
    let externalMemory = 0;

    try {
      // Get CPU time (in microseconds, convert to milliseconds)
      const cpuTimeUs = (isolate as any).cpuTime || 0;
      cpuTime = cpuTimeUs / 1000;

      // Get heap statistics if available
      try {
        const heapStats = (isolate as any).getHeapStatisticsSync?.();
        if (heapStats) {
          heapUsed = heapStats.used_heap_size || 0;
          heapLimit = heapStats.heap_size_limit || 0;
        }
      } catch {
        // Heap stats may not be available
      }

      // Get external memory if available
      try {
        const memStats = (isolate as any).getHeapSpaceStatisticsSync?.();
        if (memStats && Array.isArray(memStats)) {
          externalMemory = memStats.reduce(
            (sum, space: any) => sum + (space.external_memory_usage || 0),
            0
          );
        }
      } catch {
        // External memory stats may not be available
      }
    } catch (err) {
      // Isolate may be disposed or method unavailable
    }

    const totalMemory = heapUsed + externalMemory;
    const cpuPercent = wallTime > 0 ? Math.min(100, (cpuTime / wallTime) * 100) : 0;
    const memoryPercent = heapLimit > 0 ? (heapUsed / heapLimit) * 100 : 0;

    return {
      cpuTime,
      wallTime,
      heapUsed,
      heapLimit,
      externalMemory,
      totalMemory,
      cpuPercent,
      memoryPercent,
    };
  }

  /**
   * Check if usage is within limits
   * @param usage Current resource usage
   * @param cpuLimit CPU limit in milliseconds
   * @param memoryLimit Memory limit in bytes
   * @returns True if within limits
   */
  checkLimits(
    usage: ResourceUsage,
    cpuLimit?: number,
    memoryLimit?: number
  ): boolean {
    if (cpuLimit && usage.cpuTime > cpuLimit) {
      return false;
    }
    if (memoryLimit && usage.totalMemory > memoryLimit) {
      return false;
    }
    return true;
  }

  /**
   * Register event listener for resource warnings
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
   * Check if resource ID is currently being monitored
   * @param resourceId Resource identifier
   * @returns True if currently monitoring
   */
  isMonitoring(resourceId: string): boolean {
    return this.handles.has(resourceId);
  }

  /**
   * Get all active monitoring sessions
   * @returns Array of active resource IDs
   */
  getActiveMonitoring(): string[] {
    return Array.from(this.handles.keys());
  }

  /**
   * Stop all monitoring sessions
   */
  stopAll(): void {
    for (const resourceId of this.handles.keys()) {
      try {
        this.stopMonitoring(resourceId);
      } catch {
        // Ignore errors during cleanup
      }
    }
  }
}
