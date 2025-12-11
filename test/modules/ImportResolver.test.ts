import { ImportResolver } from '../../src/modules/ImportResolver';
import { MemFS } from '../../src/filesystem/MemFS';

describe('ImportResolver', () => {
  let resolver: ImportResolver;
  let memfs: MemFS;

  beforeEach(() => {
    memfs = new MemFS();
    resolver = new ImportResolver(memfs);

    // Setup file system
    memfs.write('/baz.js', 'content');
    memfs.write('/foo/baz.js', 'content');
    memfs.mkdir('/foo/bar', true);
    memfs.write('/foo/bar/file.js', 'content');
  });

  it('should resolve absolute paths', () => {
    // If we try to resolve /baz, it will try /baz then /baz.js
    // Our setup has /baz.js
    expect(resolver.resolve('/baz')).toBe('/baz.js');
  });

  it('should resolve relative paths', () => {
    expect(resolver.resolve('./baz', '/foo/file.js')).toBe('/foo/baz.js');
  });

  it('should resolve parent paths', () => {
    memfs.write('/foo/qux.js', 'content');
    expect(resolver.resolve('../qux', '/foo/bar/file.js')).toBe('/foo/qux.js');
  });
});
