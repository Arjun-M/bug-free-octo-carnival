import { GlobalsInjector } from '../../../src/context/GlobalsInjector';

describe('GlobalsInjector', () => {
  let injector: GlobalsInjector;

  beforeEach(() => {
    injector = new GlobalsInjector();
  });

  describe('Safe Globals', () => {
    it('should provide standard built-ins', () => {
      const globals = injector.getSafeGlobals();

      expect(globals.Object).toBe(Object);
      expect(globals.Array).toBe(Array);
      expect(globals.Promise).toBe(Promise);
      expect(globals.JSON).toBe(JSON);
      expect(globals.Math).toBe(Math);
    });

    it('should not include unsafe globals by default', () => {
      const globals = injector.getSafeGlobals();

      expect(globals).not.toHaveProperty('process');
      expect(globals).not.toHaveProperty('require');
      expect(globals).not.toHaveProperty('Buffer');
    });
  });

  describe('Timers', () => {
    it('should not include timers by default', () => {
      const globals = injector.getAllGlobals();
      expect(globals).not.toHaveProperty('setTimeout');
    });

    it('should include timers when enabled', () => {
      const injectorWithTimers = new GlobalsInjector(true);
      const globals = injectorWithTimers.getAllGlobals();

      expect(globals.setTimeout).toBeDefined();
      expect(globals.setInterval).toBeDefined();
    });
  });

  describe('Safety Checks', () => {
    it('should identify unsafe identifiers', () => {
      expect(injector.isSafe('process')).toBe(false);
      expect(injector.isSafe('require')).toBe(false);
      expect(injector.isSafe('eval')).toBe(false);
      expect(injector.isSafe('Array')).toBe(true);
    });
  });

  describe('Safe Proxy', () => {
    it('should allow access to safe properties', () => {
      const target = { safe: 'value', process: 'unsafe' };
      const proxy = injector.createSafeProxy(target);

      expect(proxy.safe).toBe('value');
    });

    it('should block access to unsafe properties', () => {
      const target = { process: 'unsafe' };
      const proxy = injector.createSafeProxy(target);

      expect(() => proxy.process).toThrow('process is not defined');
    });

    it('should hide unsafe properties from "in" operator', () => {
      const target = { process: 'unsafe', safe: 'value' };
      const proxy = injector.createSafeProxy(target);

      expect('process' in proxy).toBe(false);
      expect('safe' in proxy).toBe(true);
    });

    it('should filter unsafe keys', () => {
      const target = { process: 'unsafe', safe: 'value' };
      const proxy = injector.createSafeProxy(target);

      expect(Object.keys(proxy)).toEqual(['safe']);
    });
  });
});
