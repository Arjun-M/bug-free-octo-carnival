import { ExecutionContext } from '../../../src/execution/ExecutionContext';

describe('ExecutionContext', () => {
  describe('Constructor', () => {
    it('should initialize with correct values', () => {
      const id = 'test-id';
      const code = 'const a = 1;';
      const timeout = 1000;
      const cpuLimit = 500;
      const memoryLimit = 128;
      const userId = 'user-1';
      const metadata = { test: true };

      const context = new ExecutionContext(
        id,
        code,
        timeout,
        cpuLimit,
        memoryLimit,
        userId,
        metadata
      );

      expect(context.id).toBe(id);
      expect(context.code).toBe(code);
      expect(context.timeout).toBe(timeout);
      expect(context.cpuLimit).toBe(cpuLimit);
      expect(context.memoryLimit).toBe(memoryLimit);
      expect(context.userId).toBe(userId);
      expect(context.metadata).toEqual(metadata);
      expect(context.startTime).toBeLessThanOrEqual(Date.now());
    });
  });

  describe('Time Calculations', () => {
    let context: ExecutionContext;
    const timeout = 1000;

    beforeEach(() => {
      context = new ExecutionContext('id', 'code', timeout, 1000, 128);
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should calculate elapsed time', () => {
      jest.advanceTimersByTime(100);
      expect(context.getElapsedTime()).toBe(100);
    });

    it('should calculate remaining time', () => {
      jest.advanceTimersByTime(100);
      expect(context.getRemainingTime()).toBe(900);

      jest.advanceTimersByTime(1000);
      expect(context.getRemainingTime()).toBe(0);
    });

    it('should check timeout status', () => {
      expect(context.isTimedOut()).toBe(false);
      jest.advanceTimersByTime(timeout + 1);
      expect(context.isTimedOut()).toBe(true);
    });

    it('should calculate progress', () => {
      expect(context.getProgress()).toBe(0);

      jest.advanceTimersByTime(500);
      expect(context.getProgress()).toBe(50);

      jest.advanceTimersByTime(500);
      expect(context.getProgress()).toBe(100);

      jest.advanceTimersByTime(100);
      expect(context.getProgress()).toBe(100);
    });
  });

  describe('Serialization', () => {
    it('should convert to JSON', () => {
      const context = new ExecutionContext('id', 'code', 1000, 1000, 128);
      const json = context.toJSON();

      expect(json).toHaveProperty('id');
      expect(json).toHaveProperty('startTime');
      expect(json).toHaveProperty('elapsedTime');
      expect(json).toHaveProperty('remainingTime');
      expect(json).toHaveProperty('progress');
      expect(json.timeout).toBe(1000);
    });
  });

  describe('Utilities', () => {
    it('should generate unique IDs', () => {
      const id1 = ExecutionContext.generateId();
      const id2 = ExecutionContext.generateId();

      expect(id1).not.toBe(id2);
      expect(id1).toContain('exec-');
    });
  });
});
