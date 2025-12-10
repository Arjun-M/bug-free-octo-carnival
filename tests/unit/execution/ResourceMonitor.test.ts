import { ResourceMonitor } from '../../../src/execution/ResourceMonitor';

describe('ResourceMonitor', () => {
  let resourceMonitor: ResourceMonitor;
  let mockIsolate: any;

  beforeEach(() => {
    resourceMonitor = new ResourceMonitor();
    mockIsolate = {
      cpuTime: 0,
      getHeapStatisticsSync: jest.fn().mockReturnValue({
        used_heap_size: 1024 * 1024, // 1MB
        heap_size_limit: 128 * 1024 * 1024 // 128MB
      })
    };
    jest.useFakeTimers();
  });

  afterEach(() => {
    resourceMonitor.stopAll();
    jest.useRealTimers();
  });

  describe('Monitoring', () => {
    it('should start and stop monitoring', () => {
      const resourceId = 'test-resource';
      resourceMonitor.startMonitoring(mockIsolate, resourceId);

      expect(resourceMonitor.isMonitoring(resourceId)).toBe(true);

      // Advance time so samples are collected
      jest.advanceTimersByTime(20);

      const stats = resourceMonitor.stopMonitoring(resourceId);

      expect(resourceMonitor.isMonitoring(resourceId)).toBe(false);
      expect(stats.peakHeapUsed).toBeGreaterThan(0);
    });

    it('should throw error when monitoring duplicate id', () => {
      const resourceId = 'test-resource';
      resourceMonitor.startMonitoring(mockIsolate, resourceId);

      expect(() => resourceMonitor.startMonitoring(mockIsolate, resourceId))
        .toThrow(`Monitoring already active for ${resourceId}`);
    });

    it('should throw error when stopping non-existent monitoring', () => {
      expect(() => resourceMonitor.stopMonitoring('non-existent'))
        .toThrow('No active monitoring for non-existent');
    });
  });

  describe('Warnings', () => {
    it('should emit CPU warnings', () => {
      const resourceId = 'test-resource';
      const warningSpy = jest.fn();
      resourceMonitor.on('warning', warningSpy);

      resourceMonitor.startMonitoring(mockIsolate, resourceId, 100);

      // Simulate 80% CPU usage
      mockIsolate.cpuTime = 80 * 1000;
      jest.advanceTimersByTime(20);

      expect(warningSpy).toHaveBeenCalledWith(expect.objectContaining({
        type: 'cpu-warning-80'
      }));

      // Simulate 95% CPU usage
      mockIsolate.cpuTime = 95 * 1000;
      jest.advanceTimersByTime(20);

      expect(warningSpy).toHaveBeenCalledWith(expect.objectContaining({
        type: 'cpu-warning-95'
      }));
    });

    it('should emit memory warnings', () => {
      const resourceId = 'test-resource';
      const warningSpy = jest.fn();
      resourceMonitor.on('warning', warningSpy);

      const limit = 100 * 1024 * 1024;
      resourceMonitor.startMonitoring(mockIsolate, resourceId, undefined, limit);

      // Simulate 80% memory usage
      mockIsolate.getHeapStatisticsSync.mockReturnValue({
        used_heap_size: limit * 0.81,
        heap_size_limit: limit
      });
      jest.advanceTimersByTime(20);

      expect(warningSpy).toHaveBeenCalledWith(expect.objectContaining({
        type: 'memory-warning-80'
      }));
    });
  });

  describe('Usage Checks', () => {
    it('should check limits correctly', () => {
      const usage: any = {
        cpuTime: 50,
        totalMemory: 100
      };

      expect(resourceMonitor.checkLimits(usage, 100, 200)).toBe(true);
      expect(resourceMonitor.checkLimits(usage, 40, 200)).toBe(false);
      expect(resourceMonitor.checkLimits(usage, 100, 50)).toBe(false);
    });
  });

  describe('Active Monitoring', () => {
    it('should list active monitoring sessions', () => {
      resourceMonitor.startMonitoring(mockIsolate, 'id1');
      resourceMonitor.startMonitoring(mockIsolate, 'id2');

      const active = resourceMonitor.getActiveMonitoring();
      expect(active).toHaveLength(2);
      expect(active).toContain('id1');
      expect(active).toContain('id2');
    });
  });
});
