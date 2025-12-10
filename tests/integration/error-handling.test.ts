import { IsoBox } from '../../src/core/IsoBox';

describe('Error Handling Integration', () => {
  let isobox: IsoBox;

  beforeEach(() => {
    isobox = new IsoBox({
        console: { allowTimers: true } // Enable timers for async tests
    });
  });

  afterEach(async () => {
    await isobox.dispose();
  });

  it('should propagate syntax errors', async () => {
    await expect(isobox.run('if (true {')).rejects.toThrow('SyntaxError');
  }, 30000);

  it('should propagate runtime errors', async () => {
    await expect(isobox.run('throw new Error("Boom")')).rejects.toThrow('Boom');
  }, 30000);

  it('should sanitize stack traces', async () => {
    try {
      await isobox.run('throw new Error("Trace")');
    } catch (error: any) {
      expect(error.stack).toBeDefined();
      expect(error.stack).not.toContain('/src/core/IsoBox.ts'); // Host path
      expect(error.stack).toContain('[sandbox]'); // Sanitized path
    }
  }, 30000);

  it('should handle async errors', async () => {
    const code = `
      async function fail() {
        // Simple async delay loop without using host timers if possible,
        // but test setup allows timers.
        // Using Promise.resolve().then(...) to simulate async tick
        await Promise.resolve();
        throw new Error("Async Boom");
      }
      fail();
    `;

    await expect(isobox.run(code)).rejects.toThrow('Async Boom');
  }, 30000);

  it('should handle non-error throws', async () => {
    await expect(isobox.run('throw "string error"')).rejects.toThrow('string error');
    await expect(isobox.run('throw 123')).rejects.toThrow('123');
  }, 10000);
});
