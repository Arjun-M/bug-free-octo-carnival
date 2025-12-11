import { PooledIsolate } from '../../src/isolate/PooledIsolate';

describe('PooledIsolate', () => {
  let pooled: PooledIsolate;

  afterEach(() => {
    if (pooled) pooled.dispose();
  });

  it('should initialize correctly', () => {
    // memoryLimit is in bytes, constructor converts to MB. Min 8MB for ivm.
    const memoryLimit = 8 * 1024 * 1024;
    pooled = new PooledIsolate('1', memoryLimit);
    expect(pooled.getId()).toBe('1');
    expect(pooled.getIsHealthy()).toBe(true);
  });

  it('should track usage', () => {
    const memoryLimit = 8 * 1024 * 1024;
    pooled = new PooledIsolate('1', memoryLimit);
    pooled.markUsed();
    expect(pooled.getExecutionCount()).toBe(1);
    expect(pooled.getLastUsedAt()).toBeLessThanOrEqual(Date.now());
  });
});
