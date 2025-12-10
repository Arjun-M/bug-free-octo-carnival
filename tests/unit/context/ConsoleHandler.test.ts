import { ConsoleHandler } from '../../../src/context/ConsoleHandler';

describe('ConsoleHandler', () => {
  let consoleSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    warnSpy = jest.spyOn(console, 'warn').mockImplementation();
    errorSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Inherit Mode', () => {
    it('should log to console', () => {
      const handler = new ConsoleHandler('inherit');
      handler.handleOutput('log', ['test']);
      expect(consoleSpy).toHaveBeenCalledWith('test');
    });

    it('should warn to console', () => {
      const handler = new ConsoleHandler('inherit');
      handler.handleOutput('warn', ['test']);
      expect(warnSpy).toHaveBeenCalledWith('test');
    });

    it('should error to console', () => {
      const handler = new ConsoleHandler('inherit');
      handler.handleOutput('error', ['test']);
      expect(errorSpy).toHaveBeenCalledWith('test');
    });

    it('should format objects', () => {
      const handler = new ConsoleHandler('inherit');
      handler.handleOutput('log', [{ foo: 'bar' }]);
      expect(consoleSpy).toHaveBeenCalledWith('{"foo":"bar"}');
    });
  });

  describe('Redirect Mode', () => {
    it('should call callback', () => {
      const callback = jest.fn();
      const handler = new ConsoleHandler('redirect', callback);

      handler.handleOutput('log', ['test']);
      expect(callback).toHaveBeenCalledWith('log', 'test');
      expect(consoleSpy).not.toHaveBeenCalled();
    });

    it('should buffer output', () => {
      const handler = new ConsoleHandler('redirect');
      handler.handleOutput('log', ['test']);

      const buffer = handler.getBuffer();
      expect(buffer).toHaveLength(1);
      expect(buffer[0]).toEqual({ type: 'log', message: 'test' });
    });

    it('should clear buffer', () => {
      const handler = new ConsoleHandler('redirect');
      handler.handleOutput('log', ['test']);
      handler.clear();
      expect(handler.getBuffer()).toHaveLength(0);
    });
  });

  describe('Off Mode', () => {
    it('should swallow output', () => {
      const handler = new ConsoleHandler('off');
      handler.handleOutput('log', ['test']);

      expect(consoleSpy).not.toHaveBeenCalled();
      expect(handler.getBuffer()).toHaveLength(0);
    });
  });

  describe('Formatting', () => {
    it('should handle primitives', () => {
      const handler = new ConsoleHandler('inherit');
      handler.handleOutput('log', [1, true, null, undefined]);
      expect(consoleSpy).toHaveBeenCalledWith('1 true null undefined');
    });

    it('should handle circular references', () => {
      const handler = new ConsoleHandler('inherit');
      const obj: any = {};
      obj.self = obj;

      handler.handleOutput('log', [obj]);
      expect(consoleSpy).toHaveBeenCalledWith('[object Object]');
    });
  });
});
