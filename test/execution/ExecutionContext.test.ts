import { ExecutionContext } from '../../src/execution/ExecutionContext';

describe('ExecutionContext', () => {
  it('should store context data', () => {
    // Assuming context creation logic
    const ctx = new ExecutionContext('id', {});
    expect(ctx.id).toBe('id');
  });
});
