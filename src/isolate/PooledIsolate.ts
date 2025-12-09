/**
 * @fileoverview Pooled isolate wrapper
 */

/**
 * Wrapper for isolate in connection pool
 */
export class PooledIsolate {
  private id: string;
  private createdAt: number;
  private lastUsedAt: number;
  private executionCount: number = 0;
  private isHealthy: boolean = true;
  private resetCode?: string;

  /**
   * Create pooled isolate
   * @param id Unique isolate identifier
   * @param resetCode Optional code to run on reset
   */
  constructor(id: string, resetCode?: string) {
    this.id = id;
    this.createdAt = Date.now();
    this.lastUsedAt = Date.now();
    this.resetCode = resetCode;
  }

  /**
   * Get isolate ID
   */
  getId(): string {
    return this.id;
  }

  /**
   * Check if isolate is healthy
   */
  getIsHealthy(): boolean {
    return this.isHealthy;
  }

  /**
   * Mark isolate as unhealthy
   */
  setUnhealthy(): void {
    this.isHealthy = false;
  }

  /**
   * Get creation timestamp
   */
  getCreatedAt(): number {
    return this.createdAt;
  }

  /**
   * Get last used timestamp
   */
  getLastUsedAt(): number {
    return this.lastUsedAt;
  }

  /**
   * Get execution count
   */
  getExecutionCount(): number {
    return this.executionCount;
  }

  /**
   * Mark isolate as used
   */
  markUsed(): void {
    this.lastUsedAt = Date.now();
    this.executionCount++;
  }

  /**
   * Get idle time in milliseconds
   */
  getIdleTime(): number {
    return Date.now() - this.lastUsedAt;
  }

  /**
   * Get age in milliseconds
   */
  getAge(): number {
    return Date.now() - this.createdAt;
  }

  /**
   * Reset isolate state
   * @returns Promise resolving when reset complete
   */
  async reset(): Promise<void> {
    // Clear execution count for new batch if desired
    // In real implementation, would clear isolate memory
    // For now, just reset counters
    this.isHealthy = true;
  }

  /**
   * Dispose of isolate
   * @returns Promise resolving when disposed
   */
  async dispose(): Promise<void> {
    this.isHealthy = false;
    // In real implementation, would dispose isolate resources
  }

  /**
   * Get isolate status
   */
  getStatus(): {
    id: string;
    healthy: boolean;
    age: number;
    idleTime: number;
    executionCount: number;
  } {
    return {
      id: this.id,
      healthy: this.isHealthy,
      age: this.getAge(),
      idleTime: this.getIdleTime(),
      executionCount: this.executionCount,
    };
  }
}
