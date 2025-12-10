import { ContextBuilder } from '../../../src/context/ContextBuilder';
import { MemFS } from '../../../src/filesystem/MemFS';
import { ModuleSystem } from '../../../src/modules/ModuleSystem';

describe('ContextBuilder', () => {
  let contextBuilder: ContextBuilder;
  let memfs: MemFS;
  let moduleSystem: ModuleSystem;

  beforeEach(() => {
    memfs = new MemFS();
    moduleSystem = new ModuleSystem({ memfs, whitelist: [] }, memfs);

    contextBuilder = new ContextBuilder({
      memfs,
      moduleSystem,
      console: { mode: 'inherit' },
      env: { TEST: 'true' },
      sandbox: { myVar: 123 },
      require: { external: true }
    });
  });

  describe('Build Context', () => {
    it('should build context with globals', async () => {
      const context = await contextBuilder.build('test-isolate');

      expect(context).toBeDefined();
      expect(context._globals).toBeDefined();
      expect(context._globals.Object).toBeDefined();
      expect(context._globals.Array).toBeDefined();
      // Should self-reference
      expect(context._globals.global).toBe(context._globals);
    });

    it('should inject console', async () => {
      const context = await contextBuilder.build('test-isolate');
      expect(context._globals.console).toBeDefined();
      expect(context._globals.console.log).toBeDefined();
    });

    it('should inject environment variables', async () => {
      const context = await contextBuilder.build('test-isolate');
      expect(context._globals.$env).toBeDefined();
      expect(context._globals.$env.TEST).toBe('true');
    });

    it('should inject filesystem', async () => {
      const context = await contextBuilder.build('test-isolate');
      expect(context._globals.$fs).toBeDefined();
      expect(context._globals.$fs.write).toBeDefined();
      expect(context._globals.$fs.read).toBeDefined();
    });

    it('should inject require hooks', async () => {
      const context = await contextBuilder.build('test-isolate');
      expect(context._globals.__iso_require_resolve).toBeDefined();
      expect(context._globals.__iso_require_load).toBeDefined();
    });

    it('should inject sandbox variables', async () => {
      const context = await contextBuilder.build('test-isolate');
      expect(context._globals.myVar).toBe(123);
    });
  });

  describe('Validation', () => {
    it('should validate complete context', async () => {
      const context = await contextBuilder.build('test-isolate');
      expect(() => contextBuilder.validateContext(context)).not.toThrow();
    });

    it('should throw on missing globals', () => {
      const incomplete = { _globals: {} };
      expect(() => contextBuilder.validateContext(incomplete)).toThrow('Missing required global');
    });
  });

  describe('Components', () => {
    it('should provide handlers', () => {
      expect(contextBuilder.getConsoleHandler()).toBeDefined();
      expect(contextBuilder.getEnvHandler()).toBeDefined();
    });
  });
});
