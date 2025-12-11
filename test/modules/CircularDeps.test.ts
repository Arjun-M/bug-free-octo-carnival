import { CircularDeps } from '../../src/modules/CircularDeps';

describe('CircularDeps', () => {
  let circularDeps: CircularDeps;

  beforeEach(() => {
    circularDeps = new CircularDeps();
  });

  it('should detect circular dependency', () => {
    circularDeps.startLoading('a');
    expect(circularDeps.startLoading('a')).toBe(true);
  });

  it('should not report circular dependency for linear chain', () => {
    circularDeps.startLoading('a');
    circularDeps.startLoading('b');
    expect(circularDeps.getStack()).toEqual(['a', 'b']);
    circularDeps.finishLoading('b');
    circularDeps.finishLoading('a');
    expect(circularDeps.isLoading()).toBe(false);
  });

  it('should clear dependencies', () => {
    circularDeps.startLoading('a');
    circularDeps.clear();
    expect(circularDeps.isLoading()).toBe(false);
  });
});
