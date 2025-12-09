/**
 * @fileoverview Pool statistics and tracking
 */

/**
 * Pool statistics
 */
export interface PoolStats {
  created: number;
  active: number;
  idle: number;
  waiting: number;
  totalExecutions: number;
  avgExecutionTime: number;
  peakActive: number;
  errors: number;
}

/**
 * Track pool statistics
 */
export class PoolStatsTracker {
  private stats: PoolStats = {
    created: 0,
    active: 0,
    idle: 0,
    waiting: 0,
    totalExecutions: 0,
    avgExecutionTime: 0,
    peakActive: 0,
    errors: 0,
  };

  private executionTimes: number[] = [];
  private readonly maxTimeSamples = 1000;

  /**
   * Record a successful execution
   * @param duration Execution time in milliseconds
   */
  recordExecution(duration: number): void {
    this.stats.totalExecutions++;
    this.executionTimes.push(duration);

    // Keep recent samples only
    if (this.executionTimes.length > this.maxTimeSamples) {
      this.executionTimes.shift();
    }

    // Calculate rolling average
    const sum = this.executionTimes.reduce((a, b) => a + b, 0);
    this.stats.avgExecutionTime = sum / this.executionTimes.length;
  }

  /**
   * Record an execution error
   */
  recordError(): void {
    this.stats.errors++;
  }

  /**
   * Update active isolate count
   * @param active Current active count
   */
  setActive(active: number): void {
    this.stats.active = active;
    this.stats.peakActive = Math.max(this.stats.peakActive, active);
  }

  /**
   * Update idle isolate count
   * @param idle Current idle count
   */
  setIdle(idle: number): void {
    this.stats.idle = idle;
  }

  /**
   * Update waiting queue size
   * @param waiting Current waiting count
   */
  setWaiting(waiting: number): void {
    this.stats.waiting = waiting;
  }

  /**
   * Increment created isolate count
   */
  incrementCreated(): void {
    this.stats.created++;
  }

  /**
   * Get current statistics
   * @returns Statistics object
   */
  getStats(): PoolStats {
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  reset(): void {
    this.stats = {
      created: 0,
      active: 0,
      idle: 0,
      waiting: 0,
      totalExecutions: 0,
      avgExecutionTime: 0,
      peakActive: 0,
      errors: 0,
    };
    this.executionTimes = [];
  }

  /**
   * Serialize statistics
   */
  toJSON(): PoolStats {
    return this.getStats();
  }
}
