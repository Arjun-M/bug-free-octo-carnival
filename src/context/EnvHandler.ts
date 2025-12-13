/**
 * @file src/context/EnvHandler.ts
 * @description Environment variables handler for sandboxed code. Provides isolated environment variable storage and access without exposing host process.env.
 * @since 1.0.0
 * @copyright Copyright (c) 2025 Arjun-M. This source code is licensed under the MIT license.
 */

/**
 * Manages environment variables for sandboxed code.
 *
 * Provides an isolated environment variable store separate from host process.env.
 * Supports standard operations like get, set, has, and delete.
 *
 * @class EnvHandler
 * @example
 * ```typescript
 * const env = new EnvHandler({ NODE_ENV: 'production' });
 * env.set('API_KEY', 'secret');
 * console.log(env.get('NODE_ENV')); // 'production'
 * ```
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
