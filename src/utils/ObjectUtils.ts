/**
 * @file src/utils/ObjectUtils.ts
 * @description Object utilities for value transfer between contexts and safe proxies
 * @since 1.0.0
 * @copyright Copyright (c) 2025 Arjun-M. This source code is licensed under the MIT license.
 */

/**
 * Check if value is transferable between contexts
 * @param value - Value to check
 * @returns True if value can be safely transferred
 *
 * @example
 * ```typescript
 * isTransferable(42); // true (primitive)
 * isTransferable({ x: 1 }); // true (serializable object)
 * isTransferable(new WeakMap()); // false (not serializable)
 * ```
 */
export function isTransferable(value: any): boolean {
  if (value === null || value === undefined) {
    return true;
  }

  const type = typeof value;

  // Primitives are always transferable
  if (
    type === 'string' ||
    type === 'number' ||
    type === 'boolean' ||
    type === 'bigint'
  ) {
    return true;
  }

  // Functions may need Reference wrapping
  if (type === 'function') {
    return true;
  }

  // Objects and arrays need serialization
  if (type === 'object') {
    try {
      JSON.stringify(value);
      return true;
    } catch {
      return false;
    }
  }

  return false;
}

/**
 * Copy a value (deep clone) with circular reference detection
 * @param value - Value to copy
 * @param seen - WeakSet for tracking circular references (internal use)
 * @returns Deep copy of value
 *
 * @example
 * ```typescript
 * const original = { a: 1, b: { c: 2 } };
 * const copy = copyValue(original);
 * copy.b.c = 3;
 * console.log(original.b.c); // Still 2
 *
 * // Handles circular references
 * const circular: any = { x: 1 };
 * circular.self = circular;
 * const copied = copyValue(circular); // Returns with '[Circular]' for self
 * ```
 */
export function copyValue(value: any, seen: WeakSet<any> = new WeakSet()): any {
  if (value === null || value === undefined) {
    return value;
  }

  const type = typeof value;

  // Primitives
  if (
    type === 'string' ||
    type === 'number' ||
    type === 'boolean' ||
    type === 'bigint'
  ) {
    return value;
  }

  // Functions - keep reference
  if (type === 'function') {
    return value;
  }

  // Handle circular references
  if (type === 'object') {
    if (seen.has(value)) {
      return '[Circular]';
    }

    seen.add(value);

    // Arrays
    if (Array.isArray(value)) {
      return value.map((item) => copyValue(item, seen));
    }

    // Buffers
    if (Buffer.isBuffer(value)) {
      return Buffer.from(value);
    }

    // Dates
    if (value instanceof Date) {
      return new Date(value.getTime());
    }

    // Objects
    const copied: Record<string, any> = {};
    for (const key in value) {
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        copied[key] = copyValue(value[key], seen);
      }
    }
    return copied;
  }

  return value;
}

/**
 * Serialize value for transfer between contexts
 * Handles circular references, functions, and buffers
 * @param value - Value to serialize
 * @returns Serialized JSON string
 *
 * @example
 * ```typescript
 * const obj = {
 *   data: 'test',
 *   buffer: Buffer.from('hello'),
 *   fn: () => console.log('hi')
 * };
 * const serialized = serializeForTransfer(obj);
 * // Functions become '[Function]', buffers become base64
 * ```
 */
export function serializeForTransfer(value: any): string {
  const seen = new WeakSet();

  const replacer = (_key: string, val: any): any => {
    if (typeof val === 'object' && val !== null) {
      if (seen.has(val)) {
        return '[Circular]';
      }
      seen.add(val);
    }

    if (typeof val === 'function') {
      return '[Function]';
    }

    if (Buffer.isBuffer(val)) {
      return { _type: 'Buffer', data: val.toString('base64') };
    }

    return val;
  };

  return JSON.stringify(value, replacer);
}

/**
 * Create a safe proxy for object access
 * Blocks access to dangerous properties like __proto__, constructor, and prototype
 * @param obj - Object to wrap with safety layer
 * @returns Proxy with access restrictions
 *
 * @example
 * ```typescript
 * const unsafe = { data: 'test' };
 * const safe = createSafeProxy(unsafe);
 *
 * console.log(safe.data); // 'test'
 * console.log(safe.__proto__); // undefined (blocked)
 * console.log(safe.constructor); // undefined (blocked)
 *
 * safe.constructor = 'attack'; // Fails silently
 * console.log(safe.constructor); // Still undefined
 * ```
 */
export function createSafeProxy(obj: any): any {
  const blacklist = new Set(['constructor', '__proto__', 'prototype']);

  return new Proxy(obj, {
    get(target, prop) {
      if (typeof prop === 'string' && blacklist.has(prop)) {
        return undefined;
      }
      return Reflect.get(target, prop);
    },
    set(target, prop, value) {
      if (typeof prop === 'string' && blacklist.has(prop)) {
        return false;
      }
      return Reflect.set(target, prop, value);
    },
    has(target, prop) {
      if (typeof prop === 'string' && blacklist.has(prop)) {
        return false;
      }
      return Reflect.has(target, prop);
    },
    deleteProperty(target, prop) {
      if (typeof prop === 'string' && blacklist.has(prop)) {
        return false;
      }
      return Reflect.deleteProperty(target, prop);
    },
  });
}
