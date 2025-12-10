import { AsyncQueue } from '../../../src/utils/AsyncQueue';

describe('AsyncQueue', () => {
  let queue: AsyncQueue;

  beforeEach(() => {
    queue = new AsyncQueue(2); // Limit 2
  });

  describe('Concurrency', () => {
    it('should limit concurrent operations', async () => {
      let activeCount = 0;
      let maxActive = 0;

      const task = async () => {
        activeCount++;
        maxActive = Math.max(maxActive, activeCount);
        await new Promise(resolve => setTimeout(resolve, 10));
        activeCount--;
      };

      const tasks = [
        queue.add(task),
        queue.add(task),
        queue.add(task),
        queue.add(task),
      ];

      await Promise.all(tasks);

      expect(maxActive).toBe(2);
    });

    it('should process all tasks', async () => {
      const results = await Promise.all([
        queue.add(async () => 1),
        queue.add(async () => 2),
        queue.add(async () => 3),
      ]);

      expect(results).toEqual([1, 2, 3]);
    });
  });

  describe('Queue Management', () => {
    it('should return correct metrics', async () => {
      expect(queue.size()).toBe(0);
      expect(queue.pending()).toBe(0);
      expect(queue.getActive()).toBe(0);

      // Add long running task
      const p1 = queue.add(() => new Promise(r => setTimeout(r, 100)));

      // Should be active immediately (since queue empty and limit > 0)
      // Actually tryProcess is async recursive, but the first one starts synchronously in the sense that
      // the promise is created. But tryProcess awaits.

      // Let's verify state
      // Since `tryProcess` is async but not awaited in `add`, we need to wait a tick
      await Promise.resolve();

      expect(queue.getActive()).toBe(1);

      // Add more tasks to fill concurrency
      const p2 = queue.add(() => new Promise(r => setTimeout(r, 100)));
      const p3 = queue.add(() => new Promise(r => setTimeout(r, 100)));

      await Promise.resolve();

      expect(queue.getActive()).toBe(2); // Limit reached
      expect(queue.size()).toBe(1); // One waiting
      expect(queue.pending()).toBe(3); // Total pending
    });

    it('should clear queue', async () => {
      const task = () => new Promise(r => setTimeout(r, 100));
      queue.add(task); // Active 1
      queue.add(task); // Active 2
      const p3 = queue.add(task); // Queued

      await Promise.resolve();

      const errorSpy = jest.fn();
      p3.catch(errorSpy);

      queue.clear();

      // Wait for rejection
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(errorSpy).toHaveBeenCalledWith(expect.objectContaining({ message: 'Queue cleared' }));
      expect(queue.size()).toBe(0);
    });
  });

  describe('Validation', () => {
    it('should throw on invalid concurrency', () => {
      expect(() => new AsyncQueue(0)).toThrow('Concurrency must be at least 1');
    });
  });

  describe('Error Handling', () => {
    it('should propagate errors', async () => {
      const p = queue.add(async () => {
        throw new Error('Task failed');
      });

      await expect(p).rejects.toThrow('Task failed');
    });

    it('should continue processing after error', async () => {
      await expect(queue.add(async () => { throw new Error('Fail'); })).rejects.toThrow();

      const result = await queue.add(async () => 'Success');
      expect(result).toBe('Success');
    });
  });
});
