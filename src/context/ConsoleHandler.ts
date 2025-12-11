/**
 * Handles console output from the sandbox.
 */

import { logger } from '../utils/Logger.js';

export type OutputCallback = (type: string, message: string) => void;
export type ConsoleMode = 'inherit' | 'redirect' | 'off';

/**
 * Manages how console.log/error/warn are handled.
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

  handleOutput(type: string, args: any[]): void {
    const message = args.map((arg) => this.stringify(arg)).join(' ');

    if (this.mode === 'inherit') {
      if (type === 'error') console.error(message);
      else if (type === 'warn') console.warn(message);
      else console.log(message);
    } else if (this.mode === 'redirect') {
      this.onOutput?.(type, message);
      this.buffer.push({ type, message });
    }
  }

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

  getMode(): ConsoleMode {
    return this.mode;
  }

  getBuffer(): Array<{ type: string; message: string }> {
    return [...this.buffer];
  }

  clear(): void {
    this.buffer = [];
  }

  setOutputCallback(callback: OutputCallback): void {
    this.onOutput = callback;
  }
}
