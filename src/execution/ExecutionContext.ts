/**
 * @fileoverview Execution context metadata and utilities
 */

/**
 * Metadata about an execution context
 */
export class ExecutionContext {
  readonly id: string;
  readonly startTime: number;
  readonly timeout: number;
  readonly cpuLimit: number;
  readonly memoryLimit: number;
  readonly code: string;
  readonly userId?: string;
  readonly metadata: Record<string, any>;

  /**
   * Create execution context
   * @param id Unique execution ID
   * @param code Source code being executed
   * @param timeout Execution timeout in milliseconds
   * @param cpuLimit CPU time limit in milliseconds
   * @param memoryLimit Memory limit in bytes
   * @param userId Optional user identifier
   * @param metadata Optional additional metadata
   */
  constructor(
    id: string,
    code: string,
    timeout: number,
    cpuLimit: number,
    memoryLimit: number,
    userId?: string,
    metadata: Record<string, any> = {}
  ) {
    this.id = id;
    this.startTime = Date.now();
    this.timeout = timeout;
    this.cpuLimit = cpuLimit;
    this.memoryLimit = memoryLimit;
    this.code = code;
    this.userId = userId;
    this.metadata = { ...metadata };
  }

  /**
   * Get elapsed wall-clock time since execution started
   * @returns Elapsed time in milliseconds
   */
  getElapsedTime(): number {
    return Date.now() - this.startTime;
  }

  /**
   * Get remaining time before timeout
   * @returns Remaining time in milliseconds, or 0 if timed out
   */
  getRemainingTime(): number {
    const remaining = this.timeout - this.getElapsedTime();
    return Math.max(0, remaining);
  }

  /**
   * Check if execution has exceeded timeout
   * @returns True if timeout has been exceeded
   */
  isTimedOut(): boolean {
    return this.getElapsedTime() >= this.timeout;
  }

  /**
   * Get progress percentage (0-100)
   * @returns Progress as percentage
   */
  getProgress(): number {
    const elapsed = this.getElapsedTime();
    return Math.min(100, Math.round((elapsed / this.timeout) * 100));
  }

  /**
   * Convert context to JSON-serializable object
   * @returns Object representation of context
   */
  toJSON(): Record<string, any> {
    return {
      id: this.id,
      startTime: this.startTime,
      elapsedTime: this.getElapsedTime(),
      remainingTime: this.getRemainingTime(),
      progress: this.getProgress(),
      timeout: this.timeout,
      cpuLimit: this.cpuLimit,
      memoryLimit: this.memoryLimit,
      userId: this.userId,
      codeLength: this.code.length,
      metadata: this.metadata,
    };
  }

  /**
   * Generate unique execution ID
   * @returns Unique ID string
   */
  static generateId(): string {
    return `exec-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  }
}
