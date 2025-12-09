/**
 * @fileoverview Console output handler
 */

import { logger } from './Logger.js';

/**
 * Console output callback
 */
export type OutputCallback = (type: string, message: string) => void;

/**
 * Console modes
 */
export type ConsoleMode = 'inherit' | 'redirect' | 'off';

/**
 * Handles console output in sandbox
 */
export class ConsoleHandler {
  private mode: ConsoleMode;
  private onOutput?: OutputCallback;
  private buffer: Array<{ type: string; message: string }> = [];

  /**
   * Create console handler
   * @param mode Output mode
   * @param onOutput Output callback (for redirect mode)
   */
  constructor(mode: ConsoleMode = 'inherit', onOutput?: OutputCallback) {
    this.mode = mode;
    this.onOutput = onOutput;
  }

  /**
   * Handle console output
   * @param type Log level (log, error, warn, info, debug)
   * @param args Arguments to log
   */
  handleOutput(type: string, args: any[]): void {
    const message = args.map((arg) => this.stringify(arg)).join(' ');

    switch (this.mode) {
      case 'inherit':
        // Pass to host console
        if (type === 'error') {
          console.error(message);
        } else if (type === 'warn') {
          console.warn(message);
        } else {
          console.log(message);
        }
        break;

      case 'redirect':
        // Call callback
        if (this.onOutput) {
          this.onOutput(type, message);
        }
        this.buffer.push({ type, message });
        break;

      case 'off':
        // No-op
        break;
    }
  }

  /**
   * Convert value to string
   * @param value Value to stringify
   * @returns String representation
   */
  private stringify(value: any): string {
    if (value === null) {
      return 'null';
    }

    if (value === undefined) {
      return 'undefined';
    }

    const type = typeof value;

    if (type === 'string') {
      return value;
    }

    if (type === 'object') {
      try {
        return JSON.stringify(value);
      } catch {
        return Object.prototype.toString.call(value);
      }
    }

    return String(value);
  }

  /**
   * Get mode
   */
  getMode(): ConsoleMode {
    return this.mode;
  }

  /**
   * Get output buffer
   */
  getBuffer(): Array<{ type: string; message: string }> {
    return [...this.buffer];
  }

  /**
   * Clear output buffer
   */
  clear(): void {
    this.buffer = [];
  }

  /**
   * Set output callback
   * @param callback New callback
   */
  setOutputCallback(callback: OutputCallback): void {
    this.onOutput = callback;
  }
}
