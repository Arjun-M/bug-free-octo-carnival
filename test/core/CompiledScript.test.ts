import { CompiledScript } from '../../src/core/CompiledScript';

describe('CompiledScript', () => {
    // This is hard to test without real isolated-vm, but we can try basic instantiation if it doesn't require native bindings immediately or mock it.
    // For now, we assume we can test basic logic or fail gracefully.
  it('should be defined', () => {
      expect(CompiledScript).toBeDefined();
  });
});
