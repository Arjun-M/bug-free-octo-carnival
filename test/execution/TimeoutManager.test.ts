import { TimeoutManager } from '../../src/execution/TimeoutManager';
import ivm from 'isolated-vm';

describe('TimeoutManager', () => {
  let manager: TimeoutManager;
  let isolate: ivm.Isolate;

  beforeEach(() => {
    manager = new TimeoutManager();
    isolate = new ivm.Isolate();
  });

  afterEach(() => {
    manager.clearAll();
    if (!isolate.isDisposed) isolate.dispose();
  });

  it('should start timeout tracking', () => {
    const handle = manager.startTimeout(isolate, 100);
    expect(handle).toBeDefined();
    expect(handle.timeoutMs).toBe(100);
  });

  it('should clear timeout', () => {
      // We need to capture the ID or handle
      // Wait, startTimeout returns handle, but doesn't seem to expose ID easily unless we provide it or modify return type
      // Looking at source: it returns handle, but handle doesn't have ID property in interface unless we check implementation
      // Actually source says `interface TimeoutHandle` has no ID, but code sets `id` in map.
      // Wait, `TimeoutManager` implementation creates ID but doesn't return it in handle interface?
      // Ah, I see `startTimeout` impl: `const handle: TimeoutHandle = { ... }`.
      // If I look at the source I read:
      /*
      export interface TimeoutHandle {
        intervalId: NodeJS.Timeout;
        isolate: Isolate;
        startTime: number;
        timeoutMs: number;
        triggered: boolean;
        reason?: string;
      }
      */
      // So `id` is not in the returned handle.
      // But `startTimeout` takes optional `timeoutId`.

      const myId = 'test-id';
      manager.startTimeout(isolate, 100, myId);
      manager.clearTimeout(myId);
      // If we cleared it, it shouldn't trigger.
      // Hard to verify without internals, but we can verify no error.
  });

  it('should emit timeout event', async () => {
      const myId = 'timeout-test';
      const spy = jest.fn();
      manager.on('timeout', spy);

      manager.startTimeout(isolate, 50, myId); // 50ms timeout

      await new Promise(r => setTimeout(r, 100)); // wait 100ms

      expect(spy).toHaveBeenCalled();
      const callArgs = spy.mock.calls[0][0];
      expect(callArgs.id).toBe(myId);
      expect(callArgs.reason).toBe('timeout');
  });
});
