import * as GeneratorHandler from '../../src/streaming/GeneratorHandler';

describe('GeneratorHandler', () => {
    // It exports functions, not a class named GeneratorHandler
  it('should be defined', () => {
      expect(GeneratorHandler).toBeDefined();
  });

  it('should detect generators', () => {
      function* gen() { yield 1; }
      expect(GeneratorHandler.isGenerator(gen())).toBe(true);
  });
});
