import { IsoBox } from '../../src/core/IsoBox';
import { Timer } from '../../src/utils/Timer';

describe('Performance Benchmarks', () => {
  let isobox: IsoBox;

  beforeEach(() => {
    isobox = new IsoBox();
  });

  afterEach(async () => {
    await isobox.dispose();
  });

  it('should have low overhead for simple execution', async () => {
    const timer = new Timer().start();
    await isobox.run('1 + 1');
    const duration = timer.stop();

    // First run includes isolate creation which is expensive
    console.log(`Cold start execution time: ${duration.toFixed(2)}ms`);
    expect(duration).toBeLessThan(5000); // Very generous limit for slow CI
  });

  it('should have efficient isolate reuse (simulation)', async () => {
      const count = 5; // Reduced count
      const start = Date.now();
      const tasks = [];
      for(let i=0; i<count; i++) {
          tasks.push(isobox.run('1+1', { timeout: 10000 }));
      }
      await Promise.all(tasks);
      const total = Date.now() - start;
      const avg = total / count;

      console.log(`Concurrent execution average time (${count} runs): ${avg.toFixed(2)}ms`);
      expect(avg).toBeLessThan(5000);
  }, 30000);

  it('should handle large data transfer', async () => {
      const size = 1024 * 1024; // 1MB string
      const code = `const s = 'a'.repeat(${size}); s.length`;

      const timer = new Timer().start();
      const result = await isobox.run(code, { timeout: 10000 });
      const duration = timer.stop();

      expect(result).toBe(size);
      console.log(`1MB string allocation execution time: ${duration.toFixed(2)}ms`);
      expect(duration).toBeLessThan(5000);
  });
});
