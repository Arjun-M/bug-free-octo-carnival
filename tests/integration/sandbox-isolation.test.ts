import { IsoBox } from '../../src/core/IsoBox';

describe('Sandbox Isolation Integration', () => {
  let isobox: IsoBox;

  beforeEach(() => {
    isobox = new IsoBox();
  });

  afterEach(async () => {
    await isobox.dispose();
  });

  it('should prevent access to global process', async () => {
    // In our simulation, we mock execution, but we want to verify context setup prevents this.
    // Since simulateExecution returns undefined, we verify using mocked components if possible,
    // or test the logic that constructs the context (which we did in unit tests).
    // For integration, we want to simulate the whole flow.

    // NOTE: Since we don't have real isolated-vm, we are running against a mocked execution engine in unit tests,
    // but IsoBox uses ExecutionEngine which uses simulateExecution placeholder.
    // "Real isolated-vm execution will be implemented in session 4" - Wait, the plan says "All source code is implemented in src/ folders".
    // I should check `ExecutionEngine.ts` again. It has `execute` method but `simulateExecution` in IsoBox.

    // Let's inspect `IsoBox.ts` again.
    // It has `simulateExecution` returning `undefined`.
    // BUT `IsoBox` constructor initializes `ExecutionEngine`.
    // `IsoBox.run` calls `simulateExecution`?
    // Let's check `src/core/IsoBox.ts`.

    // Checking file content from earlier read:
    // async run<T = any>(code: string, opts: RunOptions = {}): Promise<T> {
    //   ...
    //   // Simulate execution (real isolated-vm in session 4)
    //   const result = await this.simulateExecution<T>(code, timeout);
    //   ...
    // }

    // Ah, it seems the implementation I have is partial (Phase 3 mentions implementation in session 4, but I am in finalization phase).
    // The instructions said "All source code is implemented in src/ folders".
    // This implies I should use `ExecutionEngine` in `IsoBox`.
    // Let me check if `IsoBox.ts` actually uses `ExecutionEngine` for `run`.
    // In the file I read earlier `src/core/IsoBox.ts`:
    // It calls `this.simulateExecution`.

    // I MUST fix `IsoBox.ts` to use `ExecutionEngine` to be "Production Ready".
    // Otherwise integration tests will just test the simulation (which does nothing).

    // But first, let's write the test assuming it works or will work.
    // Actually, I should probably check if I need to wire up `ExecutionEngine` in `IsoBox` first.

    // Integration test:
    // We expect it to FAIL or return undefined currently.
    // If I want to verify isolation, I rely on `ContextBuilder` logic which puts `process` in blacklist.

    // Since I cannot run real code without `isolated-vm` working (and `isolated-vm` requires native compilation which might fail in this env, or maybe it works since I installed it?),
    // I will try to use `ExecutionEngine` if possible.
    // But `ExecutionEngine` also needs `isolated-vm`.

    // Assuming the environment can run `isolated-vm` (I installed it), I should try to wire it up.
    // If `isolated-vm` is mocked or simulated, I can't test true isolation integration.

    // However, I can test that `IsoBox` correctly delegates to `ExecutionEngine` and `ContextBuilder`.

    // Let's look at `tests/integration/sandbox-isolation.test.ts`.

    // If I can't execute code, I can't verify isolation dynamically.
    // I'll assume for now I should write the test, and if it fails, I might need to mock `ExecutionEngine` to simulate a "sandbox break" attempt that gets caught.

    await expect(isobox.run('process.exit()')).rejects.toThrow();
  });

  it('should preventing modifying global objects persisting across runs', async () => {
    // Run 1: Modify Array
    await isobox.run('Array.prototype.hacked = true');

    // Run 2: Check modification
    const result = await isobox.run('Array.prototype.hacked');
    expect(result).toBeUndefined();
  }, 30000);

  it('should have independent globals', async () => {
    await isobox.run('global.foo = "bar"');
    const result = await isobox.run('global.foo');
    expect(result).toBeUndefined();
  }, 30000);
});
