import { EventEmitter } from '../../src/utils/EventEmitter';

describe('EventEmitter', () => {
  let emitter: EventEmitter;

  beforeEach(() => {
    emitter = new EventEmitter();
  });

  it('should emit and receive events', () => {
    const spy = jest.fn();
    emitter.on('test', spy);
    emitter.emit('test', 'data');
    expect(spy).toHaveBeenCalledWith('data');
  });

  it('should handle off', () => {
    const spy = jest.fn();
    emitter.on('test', spy);
    emitter.off('test', spy);
    emitter.emit('test', 'data');
    expect(spy).not.toHaveBeenCalled();
  });
});
