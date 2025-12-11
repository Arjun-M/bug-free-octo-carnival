
import { GlobalsInjector } from '../../src/context/GlobalsInjector';

describe('GlobalsInjector', () => {
  it('should return empty safe globals by default', () => {
    const injector = new GlobalsInjector(false);
    expect(injector.getSafeGlobals()).toEqual({});
  });

  it('should include timers if enabled', () => {
    const injector = new GlobalsInjector(true);
    const globals = injector.getAllGlobals();
    expect(globals.setTimeout).toBeDefined();
    expect(globals.clearTimeout).toBeDefined();
    expect(globals.setInterval).toBeDefined();
    expect(globals.clearInterval).toBeDefined();
  });

  it('should identify unsafe globals', () => {
    const injector = new GlobalsInjector(false);
    expect(injector.isSafe('process')).toBe(false);
    expect(injector.isSafe('require')).toBe(false);
    expect(injector.isSafe('fs')).toBe(false);
    expect(injector.isSafe('Object')).toBe(true);
  });

  it('should create safe proxy', () => {
    const injector = new GlobalsInjector(false);
    const target = { safe: 1, process: 2 };
    const proxy = injector.createSafeProxy(target);

    expect(proxy.safe).toBe(1);
    expect(() => proxy.process).toThrow(/process is not defined/);
  });
});
