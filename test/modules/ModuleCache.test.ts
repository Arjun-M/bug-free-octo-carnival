import { ModuleCache } from '../../src/modules/ModuleCache';

describe('ModuleCache', () => {
  let cache: ModuleCache;

  beforeEach(() => {
    cache = new ModuleCache();
  });

  it('should store and retrieve modules', () => {
    const module = { exports: { foo: 'bar' } };
    cache.set('test-module', module);
    expect(cache.get('test-module')).toBe(module);
  });

  it('should return undefined for missing modules', () => {
    expect(cache.get('non-existent')).toBeUndefined();
  });

  it('should check if module exists', () => {
    cache.set('test-module', { exports: {} });
    expect(cache.has('test-module')).toBe(true);
    expect(cache.has('other-module')).toBe(false);
  });

  it('should clear cache', () => {
    cache.set('test-module', { exports: {} });
    cache.clear();
    expect(cache.has('test-module')).toBe(false);
  });
});
