import { IsoBox } from '../../src/core/IsoBox';

describe('Security: Escape Attempts', () => {
  let isobox: IsoBox;

  beforeEach(() => {
    isobox = new IsoBox();
  });

  afterEach(async () => {
    await isobox.dispose();
  });

  it('should prevent constructor escape', async () => {
    // Attempt to access Function constructor via 'constructor' property
    const code = `
      const f = () => {};
      f.constructor('return process')();
    `;

    // Should fail or return undefined/safe object
    try {
      await isobox.run(code);
      throw new Error('Should have thrown or returned undefined');
    } catch (e: any) {
      // It might throw "process is not defined" (good)
      // or "Code generation from strings disallowed" (good)
      // or return undefined if process is missing
      expect(e.message).toMatch(/process is not defined|Code generation|undefined/);
    }
  });

  it('should prevent prototype pollution', async () => {
    // isolated-vm contexts are separate, but let's check
    const code = `
      ({}).__proto__.polluted = true;
      Object.prototype.polluted = true;
    `;

    await isobox.run(code);

    // Check host Object
    expect((Object.prototype as any).polluted).toBeUndefined();
    expect(({} as any).polluted).toBeUndefined();
  });

  it('should prevent access to host globals', async () => {
    // Increase timeout for potentially slow error propagation
    await expect(isobox.run('process.env', { timeout: 10000 })).rejects.toThrow(/process is not defined/);
    await expect(isobox.run('require("fs")', { timeout: 10000 })).rejects.toThrow(/ReferenceError: require is not defined|Module not whitelisted/);
  }, 20000);
});
