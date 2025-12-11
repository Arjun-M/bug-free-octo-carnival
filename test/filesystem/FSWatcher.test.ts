import { FSWatcher } from '../../src/filesystem/FSWatcher';

describe('FSWatcher', () => {
  let watcher: FSWatcher;

  beforeEach(() => {
    watcher = new FSWatcher();
  });

  it('should emit change events', () => {
    const spy = jest.fn();
    // Use subscribe instead of on
    watcher.subscribe('/path/to/file', spy);

    // notify params are (path, event) but implementation is (path, event)
    // Wait, notify impl: notify(path: string, event: 'create' | 'modify' | 'delete')
    // Test called: watcher.notify('change', '/path/to/file') -> Mismatch
    // Correct usage: watcher.notify('/path/to/file', 'modify')

    // Also the event is 'create', 'modify', 'delete'. 'change' is not valid in type.

    watcher.notify('/path/to/file', 'modify');
    expect(spy).toHaveBeenCalledWith('modify', '/path/to/file');
  });

  it('should support multiple listeners', () => {
     const spy1 = jest.fn();
     const spy2 = jest.fn();
     watcher.subscribe('file', spy1);
     watcher.subscribe('file', spy2);
     watcher.notify('file', 'modify');
     expect(spy1).toHaveBeenCalled();
     expect(spy2).toHaveBeenCalled();
  });
});
