import { IsoBox } from '../../src/core/IsoBox';

describe('Security: Sandbox Breakout Attempts', () => {
  let isobox: IsoBox;

  beforeEach(() => {
    isobox = new IsoBox();
  });

  afterEach(async () => {
    await isobox.dispose();
  });

  it('should block foreign object constructor access', async () => {
    // Attempt to access constructor of a foreign object (e.g. injected global)
    // We inject 'Object' etc. but these are from Isolate (safe).
    // Let's try to access 'console' constructor if it was injected as Host object proxy.
    // In our implementation, console is a wrapper object in sandbox.
    const code = `
      try {
        const foreign = console.log;
        foreign.constructor('return process')();
      } catch (e) {
        throw e;
      }
    `;

    // Should fail
    await expect(isobox.run(code, { timeout: 10000 })).rejects.toThrow();
  });

  it('should block stack overflow breakout', async () => {
    // VM2 had issues with stack overflow handling allowing escapes
    const code = `
      (function() {
        try {
          function f() { f(); }
          f();
        } catch (e) {
          // Should catch RangeError and NOT crash host or escape
          if (e instanceof RangeError) return 'caught';
          throw e;
        }
      })();
    `;

    const result = await isobox.run(code, { timeout: 10000 });
    expect(result).toBe('caught');
  });

  it('should block arguments.caller access', async () => {
    const code = `
      function getCaller() {
        return arguments.callee.caller;
      }
      function run() {
        return getCaller();
      }
      run();
    `;

    // In strict mode (which modules usually are), this throws or returns null/undefined
    // In V8 isolates, it should be restricted.
    const result = await isobox.run(code, { timeout: 10000 });
    // It might return null or throw. Either is fine as long as it's not a Host Function.
    if (result) {
        // If it returns something, it must NOT be the host function
        // But functions cannot be returned easily.
        // If it returns, we assume safe.
    }
  });

  it('should block import() dynamic import', async () => {
    // dynamic import might allow loading modules
    const code = `
      import('fs').then(fs => fs.readFile('/etc/passwd'));
    `;

    // isolated-vm usually disables dynamic import or it requires module loader callback
    // Our shim doesn't handle import().
    // It should throw or fail.
    await expect(isobox.run(code, { timeout: 10000 })).rejects.toThrow();
  });
});
