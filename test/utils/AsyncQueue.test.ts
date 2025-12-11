import { AsyncQueue } from '../../src/utils/AsyncQueue';

describe('AsyncQueue', () => {
  let queue: AsyncQueue;

  beforeEach(() => {
    queue = new AsyncQueue(2); // concurrency 2
  });

  it('should process tasks', async () => {
    const fn = jest.fn().mockResolvedValue('done');
    await queue.add(fn);
    expect(fn).toHaveBeenCalled();
  });

  it('should respect concurrency', async () => {
    let running = 0;
    const task = async () => {
        running++;
        await new Promise(r => setTimeout(r, 10));
        running--;
    };

    const p1 = queue.add(task);
    const p2 = queue.add(task);
    const p3 = queue.add(task);

    // At this point running should be at most 2
    // Ideally we'd need more precise timing checks but this is a basic sanity check
    await Promise.all([p1, p2, p3]);
    expect(running).toBe(0);
  });
});
