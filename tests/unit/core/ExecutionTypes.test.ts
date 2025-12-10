import { TimeoutReason } from '../../../src/core/ExecutionTypes';

describe('ExecutionTypes', () => {
  describe('TimeoutReason', () => {
    it('should have correct values', () => {
      expect(TimeoutReason.WALL_CLOCK).toBe('timeout');
      expect(TimeoutReason.INFINITE_LOOP).toBe('infinite-loop');
      expect(TimeoutReason.CPU_LIMIT).toBe('cpu-limit');
      expect(TimeoutReason.MEMORY_LIMIT).toBe('memory-limit');
    });
  });
});
