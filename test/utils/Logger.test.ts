
import { logger } from '../../src/utils/Logger';

describe('Logger', () => {
  let originalLevel: any;
  let consoleSpy: any;

  beforeEach(() => {
    originalLevel = logger.getLevel();
    jest.resetModules();
  });

  afterEach(() => {
    logger.setLevel(originalLevel);
    jest.restoreAllMocks();
  });

  it('should respect setLevel', () => {
    logger.setLevel('warn');
    expect(logger.getLevel()).toBe('warn');
  });

  it('should log debug messages when level is debug', () => {
    logger.setLevel('debug');
    consoleSpy = jest.spyOn(console, 'debug').mockImplementation();
    logger.debug('test message');
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[IsoBox]:DEBUG'), 'test message');
  });

  it('should not log debug messages when level is info', () => {
    logger.setLevel('info');
    consoleSpy = jest.spyOn(console, 'debug').mockImplementation();
    logger.debug('test message');
    expect(consoleSpy).not.toHaveBeenCalled();
  });

  it('should log info messages when level is info', () => {
    logger.setLevel('info');
    consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    logger.info('test message');
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[IsoBox]:INFO'), 'test message');
  });

  it('should log warn messages when level is warn', () => {
    logger.setLevel('warn');
    consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
    logger.warn('test message');
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[IsoBox]:WARN'), 'test message');
  });

  it('should log error messages when level is error', () => {
    logger.setLevel('error');
    consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    logger.error('test message');
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[IsoBox]:ERROR'), 'test message');
  });

  it('should log nothing when level is none', () => {
    logger.setLevel('none');
    const spyDebug = jest.spyOn(console, 'debug').mockImplementation();
    const spyLog = jest.spyOn(console, 'log').mockImplementation();
    const spyWarn = jest.spyOn(console, 'warn').mockImplementation();
    const spyError = jest.spyOn(console, 'error').mockImplementation();

    logger.debug('test');
    logger.info('test');
    logger.warn('test');
    logger.error('test');

    expect(spyDebug).not.toHaveBeenCalled();
    expect(spyLog).not.toHaveBeenCalled();
    expect(spyWarn).not.toHaveBeenCalled();
    expect(spyError).not.toHaveBeenCalled();
  });
});
