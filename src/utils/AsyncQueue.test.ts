/**
 * @fileoverview Tests for AsyncQueue utility
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AsyncQueue } from './AsyncQueue.js';

describe('AsyncQueue', () => {
  let queue: AsyncQueue;

  beforeEach(() => {
    queue = new AsyncQueue(2);
  });

  describe('constructor', () => {
    it('should create queue with specified concurrency', () => {
      const q = new AsyncQueue(5);
      expect(q.getConcurrency()).toBe(5);
    });

    it('should throw error for concurrency < 1', () => {
      expect(() => new AsyncQueue(0)).toThrow('Concurrency must be at least 1');
      expect(() => new AsyncQueue(-1)).toThrow('Concurrency must be at least 1');
    });

    it('should default to concurrency of 5', () => {
      const q = new AsyncQueue();
      expect(q.getConcurrency()).toBe(5);
    });
  });

  describe('add', () => {
    it('should execute single async operation', async () => {
      const result = await queue.add(async () => 'hello');
      expect(result).toBe('hello');
    });

    it('should execute multiple operations in order', async () => {
      const results: number[] = [];
      const ops = [1, 2, 3].map((n) =>
        queue.add(async () => {
          await new Promise((r) => setTimeout(r, 10));
          results.push(n);
          return n;
        })
      );

      await Promise.all(ops);
      expect(results).toEqual([1, 2, 3]);
    });

    it('should respect concurrency limit', async () => {
      let concurrent = 0;
      let maxConcurrent = 0;

      const ops = Array.from({ length: 5 }, (_, i) =>
        queue.add(async () => {
          concurrent++;
          maxConcurrent = Math.max(maxConcurrent, concurrent);
          await new Promise((r) => setTimeout(r, 50));
          concurrent--;
          return i;
        })
      );

      await Promise.all(ops);
      expect(maxConcurrent).toBe(2); // concurrency limit is 2
    });

    it('should handle async function errors', async () => {
      const error = new Error('Test error');
      await expect(
        queue.add(async () => {
          throw error;
        })
      ).rejects.toThrow('Test error');
    });

    it('should convert non-Error rejections to Error', async () => {
      await expect(
        queue.add(async () => {
          throw 'string error';
        })
      ).rejects.toThrow('string error');
    });

    it('should continue processing after error', async () => {
      const results: number[] = [];

      // First operation throws
      const op1 = queue.add(async () => {
        throw new Error('Error');
      });

      // Second operation succeeds
      const op2 = queue.add(async () => {
        results.push(1);
        return 1;
      });

      await expect(op1).rejects.toThrow();
      await expect(op2).resolves.toBe(1);
      expect(results).toEqual([1]);
    });
  });

  describe('size', () => {
    it('should return 0 for empty queue', () => {
      expect(queue.size()).toBe(0);
    });

    it('should return correct queue size', async () => {
      const blocker = new Promise((r) => setTimeout(r, 100));

      // Add 4 operations to queue with concurrency 2
      queue.add(async () => blocker);
      queue.add(async () => blocker);
      queue.add(async () => blocker);
      queue.add(async () => blocker);

      // Wait a bit for first 2 to start
      await new Promise((r) => setTimeout(r, 10));

      // Should have 2 in queue (2 are active)
      expect(queue.size()).toBe(2);
    });
  });

  describe('pending', () => {
    it('should return 0 when no operations', () => {
      expect(queue.pending()).toBe(0);
    });

    it('should return total pending (queue + active)', async () => {
      const blocker = new Promise((r) => setTimeout(r, 100));

      queue.add(async () => blocker);
      queue.add(async () => blocker);
      queue.add(async () => blocker);
      queue.add(async () => blocker);

      await new Promise((r) => setTimeout(r, 10));

      // 2 active + 2 in queue = 4 pending
      expect(queue.pending()).toBe(4);
    });
  });

  describe('clear', () => {
    it('should clear empty queue without error', () => {
      expect(() => queue.clear()).not.toThrow();
    });

    it('should reject all pending operations', async () => {
      const blocker = new Promise((r) => setTimeout(r, 100));

      queue.add(async () => blocker);
      queue.add(async () => blocker);
      const op3 = queue.add(async () => 'value');
      const op4 = queue.add(async () => 'value');

      await new Promise((r) => setTimeout(r, 10));

      queue.clear();

      // Operations in queue should be rejected
      await expect(op3).rejects.toThrow('Queue cleared');
      await expect(op4).rejects.toThrow('Queue cleared');

      expect(queue.size()).toBe(0);
    });
  });

  describe('getActive', () => {
    it('should return 0 when no active operations', () => {
      expect(queue.getActive()).toBe(0);
    });

    it('should return correct active count', async () => {
      const blocker = new Promise((r) => setTimeout(r, 100));

      queue.add(async () => blocker);
      queue.add(async () => blocker);
      queue.add(async () => blocker);

      await new Promise((r) => setTimeout(r, 10));

      expect(queue.getActive()).toBe(2); // concurrency is 2
    });
  });

  describe('edge cases', () => {
    it('should handle rapid successive adds', async () => {
      const results: number[] = [];
      const ops = Array.from({ length: 100 }, (_, i) =>
        queue.add(async () => {
          results.push(i);
          return i;
        })
      );

      await Promise.all(ops);
      expect(results).toHaveLength(100);
    });

    it('should handle operations that return undefined', async () => {
      const result = await queue.add(async () => {
        return undefined;
      });
      expect(result).toBeUndefined();
    });

    it('should handle operations that return null', async () => {
      const result = await queue.add(async () => {
        return null;
      });
      expect(result).toBeNull();
    });

    it('should handle operations returning complex objects', async () => {
      const obj = { a: 1, b: { c: 2 } };
      const result = await queue.add(async () => obj);
      expect(result).toEqual(obj);
    });

    it('should maintain correct state after many operations', async () => {
      for (let i = 0; i < 50; i++) {
        await queue.add(async () => i);
      }

      expect(queue.size()).toBe(0);
      expect(queue.pending()).toBe(0);
      expect(queue.getActive()).toBe(0);
    });
  });

  describe('concurrency control', () => {
    it('should process operations with concurrency 1 sequentially', async () => {
      const q = new AsyncQueue(1);
      const order: number[] = [];

      const ops = [1, 2, 3].map((n) =>
        q.add(async () => {
          order.push(n);
          await new Promise((r) => setTimeout(r, 10));
          return n;
        })
      );

      await Promise.all(ops);
      expect(order).toEqual([1, 2, 3]);
    });

    it('should handle high concurrency', async () => {
      const q = new AsyncQueue(50);
      const results = await Promise.all(
        Array.from({ length: 100 }, (_, i) => q.add(async () => i))
      );

      expect(results).toHaveLength(100);
    });
  });
});
