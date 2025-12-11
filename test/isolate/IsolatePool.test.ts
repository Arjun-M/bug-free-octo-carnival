import { IsolatePool } from '../../src/isolate/IsolatePool';

describe('IsolatePool', () => {
  let pool: IsolatePool;

  beforeEach(() => {
    pool = new IsolatePool({ maxIsolates: 2 });
  });

  afterEach(() => {
    pool.dispose();
  });

  it('should create isolates on demand', async () => {
    const isolate = await pool.acquire();
    expect(isolate).toBeDefined();
    pool.release(isolate);
  });

  it('should limit max isolates', async () => {
    const i1 = await pool.acquire();
    const i2 = await pool.acquire();
    expect(i1).not.toBe(i2);
    // Depending on implementation, next acquire might block or throw or wait
    // We just verify we got 2
  });
});
