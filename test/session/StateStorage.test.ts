import { StateStorage } from '../../src/session/StateStorage';

describe('StateStorage', () => {
  let storage: StateStorage;

  beforeEach(() => {
    storage = new StateStorage();
  });

  it('should store and retrieve state', () => {
    // Requires sessionId
    storage.set('sess1', 'key', 'value');
    expect(storage.get('sess1', 'key')).toBe('value');
  });

  it('should delete state', () => {
    storage.set('sess1', 'key', 'value');
    storage.delete('sess1');
    expect(storage.get('sess1', 'key')).toBeUndefined();
  });
});
