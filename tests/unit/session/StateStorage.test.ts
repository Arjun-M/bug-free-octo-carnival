import { StateStorage } from '../../../src/session/StateStorage';

describe('StateStorage', () => {
  let storage: StateStorage;

  beforeEach(() => {
    storage = new StateStorage();
  });

  describe('CRUD Operations', () => {
    it('should save and load state', () => {
      const state = new Map([['key', 'value']]);
      storage.save('session-1', state);

      const loaded = storage.load('session-1');
      expect(loaded).toEqual(state);
      expect(loaded).not.toBe(state); // Should be a copy
    });

    it('should set and get individual values', () => {
      storage.set('session-1', 'key', 'value');
      expect(storage.get('session-1', 'key')).toBe('value');
    });

    it('should return undefined for missing session or key', () => {
      expect(storage.load('missing')).toBeUndefined();
      expect(storage.get('missing', 'key')).toBeUndefined();

      storage.set('session-1', 'key', 'value');
      expect(storage.get('session-1', 'missing')).toBeUndefined();
    });

    it('should delete session state', () => {
      storage.set('session-1', 'key', 'value');
      storage.delete('session-1');
      expect(storage.has('session-1')).toBe(false);
    });

    it('should clear session state', () => {
      storage.set('session-1', 'key', 'value');
      storage.clear('session-1');
      expect(storage.get('session-1', 'key')).toBeUndefined();
      expect(storage.has('session-1')).toBe(true); // Session exists but empty
    });
  });

  describe('Bulk Operations', () => {
    it('should clear all storage', () => {
      storage.set('s1', 'k', 'v');
      storage.set('s2', 'k', 'v');

      storage.clearAll();
      expect(storage.getSessionIds()).toHaveLength(0);
    });

    it('should get session IDs', () => {
      storage.set('s1', 'k', 'v');
      storage.set('s2', 'k', 'v');

      const ids = storage.getSessionIds();
      expect(ids).toHaveLength(2);
      expect(ids).toContain('s1');
      expect(ids).toContain('s2');
    });

    it('should convert to object', () => {
      storage.set('s1', 'k', 'v');
      const obj = storage.toObject('s1');
      expect(obj).toEqual({ k: 'v' });
    });

    it('should return empty object for missing session', () => {
      const obj = storage.toObject('missing');
      expect(obj).toEqual({});
    });
  });
});
