import { PoolStatsTracker } from '../../src/isolate/PoolStats';

describe('PoolStats', () => {
  let stats: PoolStatsTracker;

  beforeEach(() => {
    stats = new PoolStatsTracker();
  });

  it('should track created isolates', () => {
    stats.incrementCreated();
    expect(stats.getStats().created).toBe(1);
  });

  it('should track active isolates', () => {
    stats.setActive(1);
    expect(stats.getStats().active).toBe(1);
    stats.setActive(0);
    expect(stats.getStats().active).toBe(0);
  });
});
