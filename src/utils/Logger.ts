/**
 * @file src/utils/Logger.ts
 * @description Internal logging utility with environment-based level control
 * @since 1.0.0
 * @copyright Copyright (c) 2025 Arjun-M. This source code is licensed under the MIT license.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'none';

/**
 * @class Logger
 * Internal logger for IsoBox with environment-based level control.
 * Supports ISOBOX_LOG_LEVEL environment variable and DEBUG flag.
 *
 * @example
 * ```typescript
 * // Usage (logger is exported as singleton)
 * logger.debug('Debug message');
 * logger.info('Info message');
 * logger.warn('Warning message');
 * logger.error('Error message');
 *
 * // Change log level
 * logger.setLevel('debug');
 *
 * // Environment variables
 * // ISOBOX_LOG_LEVEL=debug node app.js
 * // DEBUG=isobox node app.js
 * ```
 */
class Logger {
  private level: LogLevel = this.getInitialLevel();
  private readonly prefix = '[IsoBox]';

  /**
   * Get initial log level from environment or default
   */
  private getInitialLevel(): LogLevel {
    const env = process.env.ISOBOX_LOG_LEVEL?.toLowerCase();
    switch (env) {
      case 'debug':
        return 'debug';
      case 'info':
        return 'info';
      case 'warn':
        return 'warn';
      case 'error':
        return 'error';
      case 'none':
        return 'none';
      default:
        return process.env.DEBUG?.includes('isobox') ? 'debug' : 'info';
    }
  }

  /**
   * Convert log level to numeric value for comparison
   */
  private levelToNumber(level: LogLevel): number {
    const levels: Record<LogLevel, number> = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3,
      none: 4,
    };
    return levels[level];
  }

  /**
   * Check if a message should be logged at given level
   */
  private shouldLog(level: LogLevel): boolean {
    return this.levelToNumber(level) >= this.levelToNumber(this.level);
  }

  /**
   * Log debug message
   * @param message - Message to log
   * @param args - Additional arguments
   */
  debug(message: string, ...args: any[]): void {
    if (this.shouldLog('debug')) {
      console.debug(`${this.prefix}:DEBUG`, message, ...args);
    }
  }

  /**
   * Log info message
   * @param message Message to log
   * @param args Additional arguments
   */
  info(message: string, ...args: any[]): void {
    if (this.shouldLog('info')) {
      console.log(`${this.prefix}:INFO`, message, ...args);
    }
  }

  /**
   * Log warning message
   * @param message Message to log
   * @param args Additional arguments
   */
  warn(message: string, ...args: any[]): void {
    if (this.shouldLog('warn')) {
      console.warn(`${this.prefix}:WARN`, message, ...args);
    }
  }

  /**
   * Log error message
   * @param message Message to log
   * @param args Additional arguments
   */
  error(message: string, ...args: any[]): void {
    if (this.shouldLog('error')) {
      console.error(`${this.prefix}:ERROR`, message, ...args);
    }
  }

  /**
   * Set log level
   * @param level - New log level
   */
  setLevel(level: LogLevel): void {
    this.level = level;
  }

  /**
   * Get current log level
   */
  getLevel(): LogLevel {
    return this.level;
  }
}

// Export singleton instance
export const logger = new Logger();
