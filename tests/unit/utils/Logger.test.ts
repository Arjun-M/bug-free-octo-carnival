import { logger } from '../../../src/utils/Logger';

describe('Logger', () => {
  let consoleLogSpy: jest.SpyInstance;
  let consoleDebugSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleDebugSpy = jest.spyOn(console, 'debug').mockImplementation();
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

    // Reset to default level
    logger.setLevel('info');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Levels', () => {
    it('should log info by default', () => {
      logger.info('test');
      expect(consoleLogSpy).toHaveBeenCalledWith('[IsoBox]:INFO', 'test');
    });

    it('should not log debug by default', () => {
      logger.debug('test');
      expect(consoleDebugSpy).not.toHaveBeenCalled();
    });

    it('should log warn by default', () => {
      logger.warn('test');
      expect(consoleWarnSpy).toHaveBeenCalledWith('[IsoBox]:WARN', 'test');
    });

    it('should log error by default', () => {
      logger.error('test');
      expect(consoleErrorSpy).toHaveBeenCalledWith('[IsoBox]:ERROR', 'test');
    });
  });

  describe('Level Control', () => {
    it('should respect debug level', () => {
      logger.setLevel('debug');
      logger.debug('test');
      expect(consoleDebugSpy).toHaveBeenCalled();
    });

    it('should respect warn level', () => {
      logger.setLevel('warn');
      logger.info('test');
      expect(consoleLogSpy).not.toHaveBeenCalled();
      logger.warn('test');
      expect(consoleWarnSpy).toHaveBeenCalled();
    });

    it('should respect none level', () => {
      logger.setLevel('none');
      logger.error('test');
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });
  });

  describe('Initial Level', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      jest.resetModules();
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    // NOTE: Since logger is a singleton exported as const, we can't easily re-instantiate it
    // to test constructor logic reading env vars without more complex hacking or refactoring Logger to export class.
    // However, we can test getLevel() which should reflect current state.

    it('should return current level', () => {
      logger.setLevel('error');
      expect(logger.getLevel()).toBe('error');
    });
  });
});
