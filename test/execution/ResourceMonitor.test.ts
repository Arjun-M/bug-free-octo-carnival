import { ResourceMonitor } from '../../src/execution/ResourceMonitor';
import ivm from 'isolated-vm';

describe('ResourceMonitor', () => {
  let monitor: ResourceMonitor;
  let isolate: ivm.Isolate;

  beforeEach(() => {
    monitor = new ResourceMonitor();
    isolate = new ivm.Isolate();
  });

  afterEach(() => {
    monitor.stopAll();
    if (!isolate.isDisposed) isolate.dispose();
  });

  it('should start and stop monitoring', () => {
    const id = monitor.startMonitoring(isolate, 'test');
    expect(monitor.isMonitoring('test')).toBe(true);

    monitor.stopMonitoring(id);
    expect(monitor.isMonitoring('test')).toBe(false);
  });

  it('should track usage', () => {
    monitor.startMonitoring(isolate, 'test');
    const usage = monitor.getCurrentUsage(isolate);
    expect(usage.cpuTime).toBeDefined();
    expect(usage.heapUsed).toBeDefined();
  });

  it('should check limits', () => {
      // Create a dummy usage object
      const usage = {
          cpuTime: 100,
          wallTime: 1000,
          heapUsed: 1000,
          heapLimit: 2000,
          externalMemory: 0,
          totalMemory: 1000,
          cpuPercent: 10,
          memoryPercent: 50
      };

      expect(monitor.checkLimits(usage, 200, 2000)).toBe(true);
      expect(monitor.checkLimits(usage, 50, 2000)).toBe(false);
  });
});
