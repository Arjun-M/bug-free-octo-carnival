/**
 * @file src/streaming/GeneratorHandler.ts
 * @description Generator handling utilities for sync and async iterators
 * @since 1.0.0
 * @copyright Copyright (c) 2025 Arjun-M. This source code is licensed under the MIT license.
 */

/**
 * Check if value is a generator or async generator
 * @param value - Value to check
 * @returns True if value has iterator protocol
 *
 * @example
 * ```typescript
 * function* gen() { yield 1; }
 * isGenerator(gen()); // true
 * isGenerator([1, 2, 3]); // true
 * isGenerator(42); // false
 * ```
 */
export function isGenerator(value: any): boolean {
  if (!value) return false;

  const proto = Object.getPrototypeOf(value);
  if (!proto) return false;

  return (
    proto[Symbol.iterator] !== undefined ||
    proto[Symbol.asyncIterator] !== undefined
  );
}

/**
 * Get iterator from value
 * @param value - Value to get iterator from
 * @returns AsyncIterable, Iterable, or null if not iterable
 *
 * @example
 * ```typescript
 * const arr = [1, 2, 3];
 * const iter = getIterator(arr);
 * for (const item of iter) {
 *   console.log(item);
 * }
 * ```
 */
export function getIterator(value: any): AsyncIterable<any> | Iterable<any> | null {
  if (!value) return null;

  // Check for async iterator
  if (typeof value[Symbol.asyncIterator] === 'function') {
    return value;
  }

  // Check for sync iterator
  if (typeof value[Symbol.iterator] === 'function') {
    return value;
  }

  return null;
}

/**
 * Convert sync iterator to async iterator
 * @param iterable - Iterable to convert
 * @returns Async iterable
 *
 * @example
 * ```typescript
 * const syncArray = [1, 2, 3];
 * for await (const item of asyncIterator(syncArray)) {
 *   console.log(item);
 * }
 * ```
 */
export async function* asyncIterator<T>(
  iterable: Iterable<T>
): AsyncIterable<T> {
  for (const item of iterable) {
    yield item;
  }
}

/**
 * Consume async iterator with timeout
 * @param asyncIter - Async iterator to wrap
 * @param timeout - Timeout in milliseconds
 * @returns Async iterable that throws on timeout
 * @throws {Error} If timeout is exceeded
 *
 * @example
 * ```typescript
 * async function* slowGenerator() {
 *   for (let i = 0; i < 10; i++) {
 *     await new Promise(r => setTimeout(r, 1000));
 *     yield i;
 *   }
 * }
 *
 * try {
 *   for await (const item of withTimeout(slowGenerator(), 3000)) {
 *     console.log(item);
 *   }
 * } catch (e) {
 *   console.error('Timeout!');
 * }
 * ```
 */
export async function* withTimeout<T>(
  asyncIter: AsyncIterable<T>,
  timeout: number
): AsyncIterable<T> {
  const startTime = Date.now();

  for await (const item of asyncIter) {
    const elapsed = Date.now() - startTime;
    if (elapsed > timeout) {
      throw new Error(`Generator timeout exceeded: ${timeout}ms`);
    }
    yield item;
  }
}

/**
 * Limit async iterator to N items
 * @param asyncIter - Async iterator to limit
 * @param limit - Maximum items to yield
 * @returns Limited async iterable
 *
 * @example
 * ```typescript
 * async function* infinite() {
 *   let i = 0;
 *   while (true) yield i++;
 * }
 *
 * for await (const item of limit(infinite(), 5)) {
 *   console.log(item); // Only prints 0-4
 * }
 * ```
 */
export async function* limit<T>(
  asyncIter: AsyncIterable<T>,
  limit: number
): AsyncIterable<T> {
  let count = 0;
  for await (const item of asyncIter) {
    if (count >= limit) break;
    yield item;
    count++;
  }
}

/**
 * Buffer async iterator items
 * @param asyncIter - Async iterator to buffer
 * @param bufferSize - Size of buffer (default: 10)
 * @returns Buffered async iterable yielding arrays
 *
 * @example
 * ```typescript
 * async function* numbers() {
 *   for (let i = 0; i < 25; i++) yield i;
 * }
 *
 * for await (const batch of buffer(numbers(), 10)) {
 *   console.log('Batch:', batch); // [0..9], [10..19], [20..24]
 * }
 * ```
 */
export async function* buffer<T>(
  asyncIter: AsyncIterable<T>,
  bufferSize: number = 10
): AsyncIterable<T[]> {
  let buffer: T[] = [];

  for await (const item of asyncIter) {
    buffer.push(item);

    if (buffer.length >= bufferSize) {
      yield [...buffer];
      buffer = [];
    }
  }

  // Yield remaining
  if (buffer.length > 0) {
    yield buffer;
  }
}
