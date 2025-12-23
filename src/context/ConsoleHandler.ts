/**
 * @file src/context/ConsoleHandler.ts
 * @description Console output handler for sandboxed code. Manages console.log/error/warn routing with support for inheritance, redirection, or suppression modes.
 * @since 1.0.0
 * @copyright Copyright (c) 2025 Arjun-M. This source code is licensed under the MIT license.
 */

import { logger } from '../utils/Logger.js';

/**
 * Callback function type for console output.
 *
 * @callback OutputCallback
 * @param type - Output type ('log', 'error', 'warn', 'info', 'debug')
 * @param message - Formatted message string
 * @param args - Original arguments passed to console method
 */
export type OutputCallback = (type: string, message: string, args?: any[]) => void;

/**
 * Console handling modes.
 *
 * - inherit: Pass through to host console
 * - redirect: Capture and forward to callback
 * - off: Suppress all output
 */
export type ConsoleMode = 'inherit' | 'redirect' | 'off';

/**
 * Manages console output from sandboxed code.
 *
 * Provides three modes for handling console calls:
 * - inherit: Outputs directly to host console
 * - redirect: Captures output and forwards to callback with buffering
 * - off: Suppresses all console output
 *
 * @class ConsoleHandler
 * @example
 * ```typescript
 * const handler = new ConsoleHandler('redirect', (type, msg) => {
 *   console.log(`[${type}] ${msg}`);
 * });
 *
 * handler.handleOutput('log', ['Hello', 'world']);
 * const buffer = handler.getBuffer();
 * ```
 */
export class ConsoleHandler {
  private mode: ConsoleMode;
  private onOutput?: OutputCallback;
  private buffer: Array<{ type: string; message: string }> = [];

  constructor(mode: ConsoleMode = 'inherit', onOutput?: OutputCallback) {
    this.mode = mode;
    this.onOutput = onOutput;

    // Silence unused logger warning by logging initialization in debug
    logger.debug(`ConsoleHandler ready (mode=${mode})`);
  }

  /**
   * Handle console output from sandbox.
   *
   * Stringifies arguments and routes output according to configured mode.
   *
   * @param type - Output type ('log', 'error', 'warn', etc.)
   * @param args - Arguments passed to console method
   */
  handleOutput(type: string, args: any[]): void {
    const message = args.map((arg) => this.stringify(arg)).join(' ');

    if (this.mode === 'inherit') {
      if (type === 'error') console.error(message);
      else if (type === 'warn') console.warn(message);
      else console.log(message);
    } else if (this.mode === 'redirect') {
      this.onOutput?.(type, message, args);
      this.buffer.push({ type, message });
    }
  }

  /**
   * Convert a value to string for console output.
   *
   * @param value - Value to stringify
   * @returns String representation
   */
  private stringify(value: any): string {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (typeof value === 'string') return value;

    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  /**
   * Get the current console mode.
   *
   * @returns Current ConsoleMode
   */
  getMode(): ConsoleMode {
    return this.mode;
  }

  /**
   * Get captured console output buffer (redirect mode only).
   *
   * @returns Array of buffered output entries
   */
  getBuffer(): Array<{ type: string; message: string }> {
    return [...this.buffer];
  }

  /**
   * Clear the console output buffer.
   */
  clear(): void {
    this.buffer = [];
  }

  /**
   * Set or update the output callback for redirect mode.
   *
   * @param callback - New output callback function
   */
  setOutputCallback(callback: OutputCallback): void {
    this.onOutput = callback;
  }
}
