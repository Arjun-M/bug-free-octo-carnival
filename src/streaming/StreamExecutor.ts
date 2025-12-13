/**
 * @file src/streaming/StreamExecutor.ts
 * @description Streaming execution with yield support for async generators
 * @since 1.0.0
 * @copyright Copyright (c) 2025 Arjun-M. This source code is licensed under the MIT license.
 */

import { logger } from '../utils/Logger.js';
import {
  getIterator,
  withTimeout,
} from './GeneratorHandler.js';

/**
 * @class StreamExecutor
 * Executes code with streaming results, supporting async generators and iterables.
 * Handles timeout enforcement and converts sync iterators to async.
 *
 * @example
 * ```typescript
 * // Create executor
 * const executor = new StreamExecutor({ timeout: 5000 });
 *
 * // Execute code that yields values
 * const code = `
 *   async function* generate() {
 *     for (let i = 0; i < 5; i++) {
 *       yield i;
 *       await new Promise(r => setTimeout(r, 100));
 *     }
 *   }
 *   return generate();
 * `;
 *
 * // Consume stream
 * for await (const value of executor.execute(code, context)) {
 *   console.log('Received:', value);
 * }
 * ```
 */
export class StreamExecutor {
  private defaultTimeout: number;

  /**
   * Create stream executor
   * @param options - Configuration options
   * @param options.timeout - Default timeout in milliseconds (default: 30000)
   */
  constructor(options: {
    timeout?: number;
  } = {}) {
    this.defaultTimeout = options.timeout ?? 30000;
  }

  /**
   * Execute code as async generator
   * @param code - Code to execute
   * @param context - Execution context with globals
   * @param options - Execution options
   * @param options.timeout - Timeout in milliseconds (overrides default)
   * @param options.yielding - Enable yielding behavior (default: true)
   * @returns Async iterable of results
   *
   * @example
   * ```typescript
   * for await (const item of executor.execute(code, ctx, { timeout: 10000 })) {
   *   console.log(item);
   * }
   * ```
   */
  async *execute(
    code: string,
    context: any,
    options: {
      timeout?: number;
      yielding?: boolean;
    } = {}
  ): AsyncIterable<any> {
    const timeout = options.timeout ?? this.defaultTimeout;
    const shouldYield = options.yielding !== false;

    logger.debug('Starting stream execution');

    if (!shouldYield) {
      // No yielding - execute as normal and return result once
      const result = await this.executeSync(code, context);
      yield result;
      return;
    }

    // Execute code
    let result: any;
    try {
      result = await this.executeSync(code, context);
    } catch (error) {
      logger.error('Stream execution error:', error);
      throw error;
    }

    // Check if result is iterable
    if (!result) {
      return;
    }

    const iterator = getIterator(result);
    if (!iterator) {
      // Not iterable - just yield the result
      yield result;
      return;
    }

    // Consume iterator with timeout
    try {
      // Ensure iterator is AsyncIterable
      const asyncIterable: AsyncIterable<any> = {
        [Symbol.asyncIterator]() {
          if (Symbol.asyncIterator in iterator) {
             return (iterator as AsyncIterable<any>)[Symbol.asyncIterator]();
          }
          const syncIter = (iterator as Iterable<any>)[Symbol.iterator]();
          return {
            next: async () => syncIter.next(),
          };
        }
      };

      for await (const item of withTimeout(asyncIterable, timeout)) {
        logger.debug('Yielding stream item');
        yield item;
      }
    } catch (error) {
      logger.error('Stream iteration error:', error);
      throw error;
    }

    logger.debug('Stream execution completed');
  }

  /**
   * Execute code synchronously
   * @param code Code to execute
   * @param context Execution context
   * @returns Result
   */
  private async executeSync(code: string, context: any): Promise<any> {
    // Create function from code
    const fn = new Function(
      'Object',
      'Array',
      'String',
      'Number',
      'Boolean',
      'Date',
      'Math',
      'JSON',
      'Promise',
      'Set',
      'Map',
      'Error',
      'TypeError',
      'RangeError',
      'console',
      '$fs',
      '$env',
      'require',
      code
    );

    // Get globals from context
    const globals = context._globals || {};

    // Execute with context globals
    const result = await fn(
      globals.Object,
      globals.Array,
      globals.String,
      globals.Number,
      globals.Boolean,
      globals.Date,
      globals.Math,
      globals.JSON,
      globals.Promise,
      globals.Set,
      globals.Map,
      globals.Error,
      globals.TypeError,
      globals.RangeError,
      globals.console,
      globals.$fs,
      globals.$env,
      globals.require
    );

    return result;
  }

  /**
   * Set default timeout
   * @param timeout - Timeout in milliseconds
   */
  setDefaultTimeout(timeout: number): void {
    this.defaultTimeout = timeout;
  }

  /**
   * Get default timeout
   */
  getDefaultTimeout(): number {
    return this.defaultTimeout;
  }
}
