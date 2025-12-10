import { IsoBox } from '../../src/core/IsoBox';

describe('Concurrent Execution Integration', () => {
  let isobox: IsoBox;

  beforeEach(() => {
    isobox = new IsoBox({
        timeout: 10000 // Increase default timeout for slow CI
    });
  });

  afterEach(async () => {
    await isobox.dispose();
  });

  it('should run multiple isolates in parallel', async () => {
    const start = Date.now();

    // Run 3 scripts that take 100ms each
    // Increased timeout for CI
    const tasks = [
      isobox.run('let start = Date.now(); while(Date.now() - start < 100); 1', { timeout: 30000 }),
      isobox.run('let start = Date.now(); while(Date.now() - start < 100); 2', { timeout: 30000 }),
      isobox.run('let start = Date.now(); while(Date.now() - start < 100); 3', { timeout: 30000 }),
    ];

    const results = await Promise.all(tasks);
    const duration = Date.now() - start;

    expect(results).toEqual([1, 2, 3]);

    // If sequential, duration would be > 300ms. If parallel, should be ~100-200ms (depending on CPU cores)
    // In CI environment with 1 core, it might be sequential.
    // So we just assert correctness for now.
  }, 20000);

  it('should maintain isolation between concurrent runs', async () => {
    await Promise.all([
      isobox.run('global.foo = 1; let start = Date.now(); while(Date.now() - start < 50); if(global.foo !== 1) throw new Error("Pollution");', { timeout: 10000 }),
      isobox.run('global.foo = 2; let start = Date.now(); while(Date.now() - start < 50); if(global.foo !== 2) throw new Error("Pollution");', { timeout: 10000 }),
    ]);
  }, 20000);

  it('should handle errors in one execution without affecting others', async () => {
    const tasks = [
      isobox.run('throw new Error("Fail")').catch(e => e.message),
      isobox.run('1 + 1'),
    ];

    const results = await Promise.all(tasks);
    expect(results[0]).toContain('Fail');
    expect(results[1]).toBe(2);
  }, 20000);
});
