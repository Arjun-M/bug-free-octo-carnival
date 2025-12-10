import { Timer } from '../../../src/utils/Timer';

describe('Timer', () => {
  let timer: Timer;

  beforeEach(() => {
    timer = new Timer();
  });

  describe('Timing', () => {
    it('should measure time', async () => {
      timer.start();
      await new Promise(resolve => setTimeout(resolve, 10));
      const elapsed = timer.stop();
      expect(elapsed).toBeGreaterThanOrEqual(10);
    });

    it('should return 0 if not started', () => {
      expect(timer.stop()).toBe(0);
      expect(timer.elapsed()).toBe(0);
    });

    it('should get elapsed without stopping', async () => {
      timer.start();
      await new Promise(resolve => setTimeout(resolve, 15)); // Increased wait
      expect(timer.elapsed()).toBeGreaterThanOrEqual(10);
      expect(timer.isRunning()).toBe(true);
    });
  });

  describe('Pausing', () => {
    it('should pause and resume', async () => {
      timer.start();
      await new Promise(resolve => setTimeout(resolve, 10));
      timer.pause();

      const pausedElapsed = timer.elapsed();
      await new Promise(resolve => setTimeout(resolve, 20));

      expect(timer.elapsed()).toBeCloseTo(pausedElapsed, 1);

      timer.resume();
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(timer.elapsed()).toBeGreaterThan(pausedElapsed + 9);
    });

    it('should handle multiple pause/resume calls', () => {
      timer.start();
      timer.pause();
      timer.pause(); // Should be no-op
      expect(timer.isRunning()).toBe(false);

      timer.resume();
      timer.resume(); // Should be no-op
      expect(timer.isRunning()).toBe(true);
    });
  });

  describe('Reset', () => {
    it('should reset timer', () => {
      timer.start();
      timer.reset();
      expect(timer.elapsed()).toBe(0);
      expect(timer.isRunning()).toBe(false);
    });
  });

  describe('Nanoseconds', () => {
    it('should return nanoseconds', () => {
      timer.start();
      const nanos = timer.elapsedNanos();
      expect(typeof nanos).toBe('bigint');
    });
  });
});
