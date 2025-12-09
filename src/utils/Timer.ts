/**
 * @fileoverview High-resolution timer utility using process.hrtime
 */

/**
 * High-resolution timer for nanosecond precision timing
 */
export class Timer {
  private startTime: bigint = 0n;
  private pausedTime: bigint = 0n;
  private isPaused: boolean = false;

  /**
   * Start the timer
   * @returns This timer instance for chaining
   */
  start(): Timer {
    this.startTime = process.hrtime.bigint();
    this.pausedTime = 0n;
    this.isPaused = false;
    return this;
  }

  /**
   * Stop the timer and return elapsed time
   * @returns Elapsed time in milliseconds
   */
  stop(): number {
    if (this.startTime === 0n) {
      return 0;
    }
    const elapsed = this.elapsed();
    this.startTime = 0n;
    return elapsed;
  }

  /**
   * Get elapsed time without stopping
   * @returns Elapsed time in milliseconds
   */
  elapsed(): number {
    if (this.startTime === 0n) {
      return 0;
    }

    if (this.isPaused) {
      return Number(this.pausedTime) / 1_000_000;
    }

    const currentTime = process.hrtime.bigint();
    const elapsed = currentTime - this.startTime;
    return Number(elapsed) / 1_000_000;
  }

  /**
   * Get elapsed time in nanoseconds for high precision
   * @returns Elapsed time in nanoseconds
   */
  elapsedNanos(): bigint {
    if (this.startTime === 0n) {
      return 0n;
    }

    if (this.isPaused) {
      return this.pausedTime;
    }

    const currentTime = process.hrtime.bigint();
    return currentTime - this.startTime;
  }

  /**
   * Pause the timer
   * @returns This timer instance for chaining
   */
  pause(): Timer {
    if (!this.isPaused && this.startTime !== 0n) {
      this.pausedTime = this.elapsedNanos();
      this.isPaused = true;
    }
    return this;
  }

  /**
   * Resume the timer
   * @returns This timer instance for chaining
   */
  resume(): Timer {
    if (this.isPaused) {
      this.startTime = process.hrtime.bigint() - this.pausedTime;
      this.isPaused = false;
    }
    return this;
  }

  /**
   * Reset the timer
   * @returns This timer instance for chaining
   */
  reset(): Timer {
    this.startTime = 0n;
    this.pausedTime = 0n;
    this.isPaused = false;
    return this;
  }

  /**
   * Check if timer is running
   * @returns True if timer is running
   */
  isRunning(): boolean {
    return this.startTime !== 0n && !this.isPaused;
  }
}
