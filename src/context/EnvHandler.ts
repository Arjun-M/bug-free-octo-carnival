/**
 * @fileoverview Environment variables handler
 */

/**
 * Provides access to environment variables in sandbox
 */
export class EnvHandler {
  private env: Record<string, string>;

  /**
   * Create environment handler
   * @param env Environment variables
   */
  constructor(env: Record<string, string> = {}) {
    this.env = { ...env };
  }

  /**
   * Get environment variable
   * @param key Variable name
   * @returns Variable value or undefined
   */
  get(key: string): string | undefined {
    return this.env[key];
  }

  /**
   * Set environment variable
   * @param key Variable name
   * @param value Variable value
   */
  set(key: string, value: string): void {
    this.env[key] = value;
  }

  /**
   * Check if variable exists
   * @param key Variable name
   * @returns True if exists
   */
  has(key: string): boolean {
    return key in this.env;
  }

  /**
   * Delete environment variable
   * @param key Variable name
   */
  delete(key: string): void {
    delete this.env[key];
  }

  /**
   * Get all environment variables as object
   * @returns Object with all variables
   */
  toObject(): Record<string, string> {
    return { ...this.env };
  }

  /**
   * Clear all variables
   */
  clear(): void {
    this.env = {};
  }

  /**
   * Get variable count
   */
  size(): number {
    return Object.keys(this.env).length;
  }

  /**
   * Get all variable names
   */
  keys(): string[] {
    return Object.keys(this.env);
  }
}
