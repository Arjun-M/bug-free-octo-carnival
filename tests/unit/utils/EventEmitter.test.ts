import { EventEmitter } from '../../../src/utils/EventEmitter';

describe('EventEmitter', () => {
  let emitter: EventEmitter;

  beforeEach(() => {
    emitter = new EventEmitter();
  });

  describe('Listeners', () => {
    it('should register and call listener', () => {
      const spy = jest.fn();
      emitter.on('test', spy);
      emitter.emit('test', 'arg');
      expect(spy).toHaveBeenCalledWith('arg');
    });

    it('should remove listener', () => {
      const spy = jest.fn();
      emitter.on('test', spy);
      emitter.off('test', spy);
      emitter.emit('test');
      expect(spy).not.toHaveBeenCalled();
    });

    it('should register one-time listener', () => {
      const spy = jest.fn();
      emitter.once('test', spy);

      emitter.emit('test');
      emitter.emit('test');

      expect(spy).toHaveBeenCalledTimes(1);
    });
  });

  describe('Multiple Listeners', () => {
    it('should call multiple listeners', () => {
      const spy1 = jest.fn();
      const spy2 = jest.fn();

      emitter.on('test', spy1);
      emitter.on('test', spy2);

      emitter.emit('test');

      expect(spy1).toHaveBeenCalled();
      expect(spy2).toHaveBeenCalled();
    });

    it('should handle errors in listeners gracefully', () => {
      const spy = jest.fn();
      const errorListener = () => { throw new Error('Fail'); };
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      emitter.on('test', errorListener);
      emitter.on('test', spy);

      expect(() => emitter.emit('test')).not.toThrow();
      expect(spy).toHaveBeenCalled(); // Should continue
      expect(consoleSpy).toHaveBeenCalled();
    });
  });

  describe('Management', () => {
    it('should remove all listeners', () => {
      emitter.on('test1', jest.fn());
      emitter.on('test2', jest.fn());

      emitter.removeAllListeners();
      expect(emitter.listenerCount('test1')).toBe(0);
      expect(emitter.listenerCount('test2')).toBe(0);
    });

    it('should remove listeners for specific event', () => {
      emitter.on('test1', jest.fn());
      emitter.on('test2', jest.fn());

      emitter.removeAllListeners('test1');
      expect(emitter.listenerCount('test1')).toBe(0);
      expect(emitter.listenerCount('test2')).toBe(1);
    });

    it('should list event names', () => {
      emitter.on('test1', jest.fn());
      emitter.on('test2', jest.fn());

      const names = emitter.eventNames();
      expect(names).toContain('test1');
      expect(names).toContain('test2');
    });
  });
});
