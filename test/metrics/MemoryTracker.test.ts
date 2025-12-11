import { MemoryTracker } from '../../src/metrics/MemoryTracker';

describe('MemoryTracker', () => {
  let tracker: MemoryTracker;

  beforeEach(() => {
    tracker = new MemoryTracker();
  });

  afterEach(() => {
    tracker.stop();
  });

  it('should measure heap usage', () => {
    const usage = tracker.getCurrentMemory();
    expect(typeof usage).toBe('number');
    expect(usage).toBeGreaterThan(0);
  });

  it('should track peak usage', () => {
    tracker.start();
    // simulate some allocation
    const arr = new Array(1000).fill('x');
    // wait for snapshot
    jest.advanceTimersByTime?.(200);
    const stats = tracker.getStats();
    expect(stats.peakUsage).toBeGreaterThanOrEqual(0);
  });

  it('should reset stats', () => {
      tracker.start();
      tracker.reset();
      expect(tracker.getSnapshots().length).toBe(0);
  });
});
