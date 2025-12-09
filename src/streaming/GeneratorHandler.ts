/**
 * @fileoverview Generator handling utilities
 */

/**
 * Check if value is a generator or async generator
 * @param value Value to check
 * @returns True if generator
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
 * @param value Value to get iterator from
 * @returns Iterator or null
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
 * @param iterable Iterable to convert
 * @returns Async iterable
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
 * @param asyncIter Async iterator
 * @param timeout Timeout in milliseconds
 * @returns Async iterable with timeout
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
 * @param asyncIter Async iterator
 * @param limit Maximum items to yield
 * @returns Limited async iterable
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
 * @param asyncIter Async iterator
 * @param bufferSize Size of buffer
 * @returns Buffered async iterable
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
