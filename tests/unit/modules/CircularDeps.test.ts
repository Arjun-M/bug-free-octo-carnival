import { CircularDeps } from '../../../src/modules/CircularDeps';

describe('CircularDeps', () => {
  let circularDeps: CircularDeps;

  beforeEach(() => {
    circularDeps = new CircularDeps();
  });

  describe('Stack Management', () => {
    it('should track loading modules', () => {
      circularDeps.startLoading('a');
      expect(circularDeps.isLoading()).toBe(true);
      expect(circularDeps.getStack()).toContain('a');

      circularDeps.finishLoading('a');
      expect(circularDeps.isLoading()).toBe(false);
      expect(circularDeps.getStack()).toHaveLength(0);
    });

    it('should prevent double loading', () => {
      expect(circularDeps.startLoading('a')).toBe(false);
      expect(circularDeps.startLoading('a')).toBe(true); // Already loading
    });

    it('should clear stack', () => {
      circularDeps.startLoading('a');
      circularDeps.clear();
      expect(circularDeps.isLoading()).toBe(false);
    });
  });

  describe('Detection', () => {
    it('should detect circular dependency', () => {
      const stack = ['a', 'b'];
      expect(circularDeps.detectCircular('a', stack)).toBe(true);
      expect(circularDeps.detectCircular('c', stack)).toBe(false);
    });

    it('should get circular path', () => {
      const stack = ['a', 'b', 'c'];
      // a -> b -> c -> a
      const path = circularDeps.getCircularPath('a', stack);
      expect(path).toEqual(['a', 'b', 'c', 'a']);
    });

    it('should return null for non-circular path', () => {
      const stack = ['a', 'b'];
      expect(circularDeps.getCircularPath('c', stack)).toBeNull();
    });
  });
});
