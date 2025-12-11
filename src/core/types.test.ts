/**
 * @fileoverview Tests for core types and custom error classes
 */

import { describe, it, expect } from 'vitest';
import {
  SandboxError,
  TimeoutError,
  MemoryLimitError,
  CPULimitError,
} from './types.js';

describe('Core Types', () => {
  describe('SandboxError', () => {
    it('should create error with message', () => {
      const error = new SandboxError('Test error');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(SandboxError);
      expect(error.message).toBe('Test error');
      expect(error.name).toBe('SandboxError');
      expect(error.code).toBe('SANDBOX_ERROR');
    });

    it('should create error with custom code', () => {
      const error = new SandboxError('Test error', 'CUSTOM_CODE');

      expect(error.code).toBe('CUSTOM_CODE');
    });

    it('should create error with context', () => {
      const context = { foo: 'bar', value: 42 };
      const error = new SandboxError('Test error', 'TEST_CODE', context);

      expect(error.context).toEqual(context);
    });

    it('should create error without context', () => {
      const error = new SandboxError('Test error', 'TEST_CODE');

      expect(error.context).toBeUndefined();
    });

    it('should have stack trace', () => {
      const error = new SandboxError('Test error');

      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('SandboxError');
      expect(error.stack).toContain('Test error');
    });

    it('should be catchable as Error', () => {
      try {
        throw new SandboxError('Test error');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect(error).toBeInstanceOf(SandboxError);
      }
    });

    it('should maintain prototype chain', () => {
      const error = new SandboxError('Test');

      expect(Object.getPrototypeOf(error)).toBe(SandboxError.prototype);
    });

    it('should support instanceof checks', () => {
      const error = new SandboxError('Test');

      expect(error instanceof SandboxError).toBe(true);
      expect(error instanceof Error).toBe(true);
    });
  });

  describe('TimeoutError', () => {
    it('should create error with default message', () => {
      const error = new TimeoutError();

      expect(error).toBeInstanceOf(TimeoutError);
      expect(error).toBeInstanceOf(SandboxError);
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe('Execution timeout exceeded');
      expect(error.name).toBe('TimeoutError');
      expect(error.code).toBe('TIMEOUT_ERROR');
      expect(error.timeout).toBe(0);
    });

    it('should create error with custom message', () => {
      const error = new TimeoutError('Custom timeout message');

      expect(error.message).toBe('Custom timeout message');
    });

    it('should store timeout value', () => {
      const error = new TimeoutError('Timeout', 5000);

      expect(error.timeout).toBe(5000);
    });

    it('should create error with context', () => {
      const context = { executionId: '123' };
      const error = new TimeoutError('Timeout', 1000, context);

      expect(error.context).toEqual(context);
      expect(error.timeout).toBe(1000);
    });

    it('should maintain prototype chain', () => {
      const error = new TimeoutError();

      expect(Object.getPrototypeOf(error)).toBe(TimeoutError.prototype);
      expect(error instanceof TimeoutError).toBe(true);
      expect(error instanceof SandboxError).toBe(true);
      expect(error instanceof Error).toBe(true);
    });

    it('should have correct code', () => {
      const error = new TimeoutError('Test', 100);

      expect(error.code).toBe('TIMEOUT_ERROR');
    });
  });

  describe('MemoryLimitError', () => {
    it('should create error with default message', () => {
      const error = new MemoryLimitError();

      expect(error).toBeInstanceOf(MemoryLimitError);
      expect(error).toBeInstanceOf(SandboxError);
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe('Memory limit exceeded');
      expect(error.name).toBe('MemoryLimitError');
      expect(error.code).toBe('MEMORY_LIMIT_ERROR');
      expect(error.limit).toBe(0);
    });

    it('should create error with custom message', () => {
      const error = new MemoryLimitError('Custom memory message');

      expect(error.message).toBe('Custom memory message');
    });

    it('should store memory limit value', () => {
      const error = new MemoryLimitError('Memory exceeded', 128 * 1024 * 1024);

      expect(error.limit).toBe(128 * 1024 * 1024);
    });

    it('should create error with context', () => {
      const context = { current: 150 * 1024 * 1024 };
      const error = new MemoryLimitError('Exceeded', 128 * 1024 * 1024, context);

      expect(error.context).toEqual(context);
      expect(error.limit).toBe(128 * 1024 * 1024);
    });

    it('should maintain prototype chain', () => {
      const error = new MemoryLimitError();

      expect(Object.getPrototypeOf(error)).toBe(MemoryLimitError.prototype);
      expect(error instanceof MemoryLimitError).toBe(true);
      expect(error instanceof SandboxError).toBe(true);
      expect(error instanceof Error).toBe(true);
    });

    it('should have correct code', () => {
      const error = new MemoryLimitError('Test', 1024);

      expect(error.code).toBe('MEMORY_LIMIT_ERROR');
    });
  });

  describe('CPULimitError', () => {
    it('should create error with default message', () => {
      const error = new CPULimitError();

      expect(error).toBeInstanceOf(CPULimitError);
      expect(error).toBeInstanceOf(SandboxError);
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe('CPU time limit exceeded');
      expect(error.name).toBe('CPULimitError');
      expect(error.code).toBe('CPU_LIMIT_ERROR');
      expect(error.limit).toBe(0);
    });

    it('should create error with custom message', () => {
      const error = new CPULimitError('Custom CPU message');

      expect(error.message).toBe('Custom CPU message');
    });

    it('should store CPU limit value', () => {
      const error = new CPULimitError('CPU exceeded', 10000);

      expect(error.limit).toBe(10000);
    });

    it('should create error with context', () => {
      const context = { executionTime: 12000 };
      const error = new CPULimitError('Exceeded', 10000, context);

      expect(error.context).toEqual(context);
      expect(error.limit).toBe(10000);
    });

    it('should maintain prototype chain', () => {
      const error = new CPULimitError();

      expect(Object.getPrototypeOf(error)).toBe(CPULimitError.prototype);
      expect(error instanceof CPULimitError).toBe(true);
      expect(error instanceof SandboxError).toBe(true);
      expect(error instanceof Error).toBe(true);
    });

    it('should have correct code', () => {
      const error = new CPULimitError('Test', 5000);

      expect(error.code).toBe('CPU_LIMIT_ERROR');
    });
  });

  describe('Error hierarchy', () => {
    it('should differentiate error types via instanceof', () => {
      const sandboxError = new SandboxError('Test');
      const timeoutError = new TimeoutError();
      const memoryError = new MemoryLimitError();
      const cpuError = new CPULimitError();

      // All are SandboxErrors
      expect(sandboxError instanceof SandboxError).toBe(true);
      expect(timeoutError instanceof SandboxError).toBe(true);
      expect(memoryError instanceof SandboxError).toBe(true);
      expect(cpuError instanceof SandboxError).toBe(true);

      // But only specific types match their own class
      expect(timeoutError instanceof TimeoutError).toBe(true);
      expect(timeoutError instanceof MemoryLimitError).toBe(false);
      expect(timeoutError instanceof CPULimitError).toBe(false);

      expect(memoryError instanceof TimeoutError).toBe(false);
      expect(memoryError instanceof MemoryLimitError).toBe(true);
      expect(memoryError instanceof CPULimitError).toBe(false);

      expect(cpuError instanceof TimeoutError).toBe(false);
      expect(cpuError instanceof MemoryLimitError).toBe(false);
      expect(cpuError instanceof CPULimitError).toBe(true);
    });

    it('should allow catching specific error types', () => {
      const throwTimeout = () => {
        throw new TimeoutError('Timeout', 1000);
      };

      try {
        throwTimeout();
        expect.fail('Should have thrown');
      } catch (error) {
        if (error instanceof TimeoutError) {
          expect(error.timeout).toBe(1000);
        } else {
          expect.fail('Wrong error type');
        }
      }
    });

    it('should allow catching as SandboxError', () => {
      const errors = [
        new TimeoutError('Timeout', 1000),
        new MemoryLimitError('Memory', 128 * 1024 * 1024),
        new CPULimitError('CPU', 5000),
      ];

      for (const error of errors) {
        try {
          throw error;
        } catch (e) {
          expect(e).toBeInstanceOf(SandboxError);
          expect(e).toBeInstanceOf(Error);
        }
      }
    });
  });

  describe('Edge cases', () => {
    it('should handle empty error message', () => {
      const error = new SandboxError('');

      expect(error.message).toBe('');
      expect(error.code).toBe('SANDBOX_ERROR');
    });

    it('should handle very long error messages', () => {
      const longMessage = 'Error '.repeat(1000);
      const error = new SandboxError(longMessage);

      expect(error.message).toBe(longMessage);
    });

    it('should handle special characters in message', () => {
      const message = 'Error: 特殊文字 \n\t\r\0';
      const error = new SandboxError(message);

      expect(error.message).toBe(message);
    });

    it('should handle negative limit values', () => {
      const timeoutError = new TimeoutError('Test', -1000);
      const memoryError = new MemoryLimitError('Test', -1024);
      const cpuError = new CPULimitError('Test', -5000);

      expect(timeoutError.timeout).toBe(-1000);
      expect(memoryError.limit).toBe(-1024);
      expect(cpuError.limit).toBe(-5000);
    });

    it('should handle very large limit values', () => {
      const largeLimit = Number.MAX_SAFE_INTEGER;
      const error = new MemoryLimitError('Test', largeLimit);

      expect(error.limit).toBe(largeLimit);
    });

    it('should handle complex context objects', () => {
      const context = {
        nested: {
          deeply: {
            object: true,
          },
        },
        array: [1, 2, 3],
        null: null,
        undefined: undefined,
      };

      const error = new SandboxError('Test', 'CODE', context);

      expect(error.context).toEqual(context);
    });

    it('should have accessible properties for serialization', () => {
      const error = new SandboxError('Test error', 'TEST_CODE', { foo: 'bar' });

      // Error objects don't serialize message by default in JSON.stringify
      // But we can access the properties directly
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_CODE');
      expect(error.context?.foo).toBe('bar');

      // Manual serialization works
      const serialized = {
        message: error.message,
        code: error.code,
        context: error.context,
        name: error.name,
      };
      expect(serialized.message).toBe('Test error');
      expect(serialized.code).toBe('TEST_CODE');
    });
  });
});
