/**
 * @fileoverview Object utilities for value transfer between contexts
 */

/**
 * Check if value is transferable
 * @param value Value to check
 * @returns True if can be transferred
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
 * Copy a value (deep clone)
 * @param value Value to copy
 * @returns Deep copy of value
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
 * Serialize value for transfer
 * @param value Value to serialize
 * @returns Serialized string
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
 * @param obj Object to wrap
 * @returns Proxy with access restrictions
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
