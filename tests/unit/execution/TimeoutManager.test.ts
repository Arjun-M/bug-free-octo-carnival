import { TimeoutManager } from '../../../src/execution/TimeoutManager';

describe('TimeoutManager', () => {
  let timeoutManager: TimeoutManager;
  let mockIsolate: any;

  beforeEach(() => {
    timeoutManager = new TimeoutManager();
    mockIsolate = {
      dispose: jest.fn(),
      cpuTime: 0 // Mock cpuTime property
    };
    jest.useFakeTimers();
  });

  afterEach(() => {
    timeoutManager.clearAll();
    jest.useRealTimers();
  });

  describe('Timeout Enforcement', () => {
    it('should kill isolate when timeout exceeded', () => {
      const timeoutMs = 1000;
      const handle = timeoutManager.startTimeout(mockIsolate, timeoutMs);

      const timeoutEventSpy = jest.fn();
      timeoutManager.on('timeout', timeoutEventSpy);

      // Advance time beyond timeout
      jest.advanceTimersByTime(timeoutMs + 100);

      expect(mockIsolate.dispose).toHaveBeenCalled();
      expect(handle.triggered).toBe(true);
      expect(handle.reason).toBe('timeout');
      expect(timeoutEventSpy).toHaveBeenCalledWith(expect.objectContaining({
        reason: 'timeout'
      }));
    });

    it('should clear timeout correctly', () => {
      const timeoutMs = 1000;
      const handle = timeoutManager.startTimeout(mockIsolate, timeoutMs);

      timeoutManager.clearTimeout('non-existent'); // Should be safe

      // Get ID from handle since it's internal
      const id = Array.from(timeoutManager.getActiveTimeouts())[0];
      timeoutManager.clearTimeout(id);

      jest.advanceTimersByTime(timeoutMs + 100);

      expect(mockIsolate.dispose).not.toHaveBeenCalled();
    });
  });

  describe('CPU Monitoring', () => {
    it('should kill isolate when CPU limit exceeded', () => {
      const cpuLimitMs = 100;
      const handle = timeoutManager.startCpuMonitoring(mockIsolate, cpuLimitMs);

      const timeoutEventSpy = jest.fn();
      timeoutManager.on('timeout', timeoutEventSpy);

      // Mock high CPU usage (microseconds)
      mockIsolate.cpuTime = (cpuLimitMs + 10) * 1000;

      jest.advanceTimersByTime(100); // Wait for monitoring interval

      expect(mockIsolate.dispose).toHaveBeenCalled();
      expect(handle.triggered).toBe(true);
      expect(handle.reason).toBe('cpu-limit');
    });

    it('should emit warning when approaching CPU limit', () => {
      const cpuLimitMs = 100;
      timeoutManager.startCpuMonitoring(mockIsolate, cpuLimitMs);

      const warningSpy = jest.fn();
      timeoutManager.on('warning', warningSpy);

      // Mock 85% CPU usage
      mockIsolate.cpuTime = (cpuLimitMs * 0.85) * 1000;

      jest.advanceTimersByTime(100);

      expect(warningSpy).toHaveBeenCalled();
      expect(mockIsolate.dispose).not.toHaveBeenCalled();
    });
  });

  describe('Infinite Loop Detection', () => {
    it('should detect infinite loop', () => {
      const timeoutMs = 1000;
      timeoutManager.startTimeout(mockIsolate, timeoutMs);

      // Simulate wall clock = CPU time (infinite loop characteristic)
      const elapsed = 200;
      mockIsolate.cpuTime = elapsed * 1000; // 100% CPU usage

      jest.advanceTimersByTime(elapsed);

      expect(mockIsolate.dispose).toHaveBeenCalled();
    });

    it('should allow configuration of thresholds', () => {
      timeoutManager.setInfiniteLoopThreshold(0.5);
      timeoutManager.setMinDetectionTime(50);

      expect(() => timeoutManager.setInfiniteLoopThreshold(1.5)).toThrow();
      expect(() => timeoutManager.setMinDetectionTime(-1)).toThrow();
    });
  });

  describe('Stats', () => {
    it('should return correct stats', () => {
      timeoutManager.startTimeout(mockIsolate, 1000);
      timeoutManager.startTimeout(mockIsolate, 1000);

      const stats = timeoutManager.getStats();
      expect(stats.activeTimeouts).toBe(2);
      expect(stats.triggeredTimeouts).toBe(0);
    });
  });
});
