import { FSWatcher } from '../../../src/filesystem/FSWatcher';

describe('FSWatcher', () => {
  let watcher: FSWatcher;

  beforeEach(() => {
    watcher = new FSWatcher();
  });

  describe('Subscription', () => {
    it('should subscribe to a path', () => {
      const id = watcher.subscribe('/file', jest.fn());
      expect(id).toBeDefined();
      expect(watcher.count()).toBe(1);
    });

    it('should unsubscribe from a path', () => {
      const id = watcher.subscribe('/file', jest.fn());
      watcher.unsubscribe(id);
      expect(watcher.count()).toBe(0);
    });

    it('should handle duplicate path subscriptions', () => {
      const id1 = watcher.subscribe('/file', jest.fn());
      const id2 = watcher.subscribe('/file', jest.fn());

      expect(id1).not.toBe(id2);
      expect(watcher.getWatchers('/file')).toHaveLength(2);
    });
  });

  describe('Notification', () => {
    it('should notify watchers on event', () => {
      const spy = jest.fn();
      watcher.subscribe('/file', spy);

      watcher.notify('/file', 'modify');
      expect(spy).toHaveBeenCalledWith('modify', '/file');
    });

    it('should notify parent directory watchers', () => {
      const spy = jest.fn();
      watcher.subscribe('/dir', spy);

      watcher.notify('/dir/file', 'create');
      expect(spy).toHaveBeenCalledWith('create', '/dir/file');
    });

    it('should ignore errors in callbacks', () => {
      const callback = jest.fn().mockImplementation(() => {
        throw new Error('Callback failed');
      });

      watcher.subscribe('/file', callback);

      expect(() => watcher.notify('/file', 'modify')).not.toThrow();
      expect(callback).toHaveBeenCalled();
    });
  });

  describe('Management', () => {
    it('should clear all watchers', () => {
      watcher.subscribe('/file1', jest.fn());
      watcher.subscribe('/file2', jest.fn());

      watcher.clear();
      expect(watcher.count()).toBe(0);
      expect(watcher.getAllSubscriptions()).toHaveLength(0);
    });

    it('should get all subscriptions', () => {
      watcher.subscribe('/file', jest.fn());
      const subs = watcher.getAllSubscriptions();
      expect(subs).toHaveLength(1);
      expect(subs[0].path).toBe('/file');
    });
  });
});
