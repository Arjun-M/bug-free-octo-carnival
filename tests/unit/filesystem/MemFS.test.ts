import { MemFS } from '../../../src/filesystem/MemFS';
import { PERMISSIONS } from '../../../src/filesystem/Permissions';

describe('MemFS', () => {
  let memfs: MemFS;

  beforeEach(() => {
    memfs = new MemFS({ maxSize: 1024 * 1024 }); // 1MB
  });

  describe('File Operations', () => {
    it('should write and read files', () => {
      const path = '/sandbox/file.txt';
      const content = 'hello world';
      memfs.write(path, content);

      const readContent = memfs.read(path);
      expect(readContent.toString()).toBe(content);
    });

    it('should overwrite files', () => {
      const path = '/sandbox/file.txt';
      memfs.write(path, 'v1');
      memfs.write(path, 'v2');
      expect(memfs.read(path).toString()).toBe('v2');
    });

    it('should throw when reading non-existent file', () => {
      expect(() => memfs.read('/sandbox/missing.txt')).toThrow('File not found');
    });

    it('should create directories recursively', () => {
      const path = '/a/b/c/file.txt';
      memfs.write(path, 'content');
      expect(memfs.exists(path)).toBe(true);
      expect(memfs.exists('/a/b/c')).toBe(true);
    });
  });

  describe('Directory Operations', () => {
    it('should create directory', () => {
      memfs.mkdir('/sandbox/dir');
      expect(memfs.exists('/sandbox/dir')).toBe(true);
      expect(memfs.stat('/sandbox/dir').isDirectory).toBe(true);
    });

    it('should list directory contents', () => {
      memfs.mkdir('/sandbox/dir');
      memfs.write('/sandbox/dir/f1.txt', 'c1');
      memfs.write('/sandbox/dir/f2.txt', 'c2');

      const entries = memfs.readdir('/sandbox/dir');
      expect(entries).toHaveLength(2);
      expect(entries).toContain('f1.txt');
      expect(entries).toContain('f2.txt');
    });

    it('should delete file', () => {
      memfs.write('/sandbox/file.txt', 'content');
      memfs.delete('/sandbox/file.txt');
      expect(memfs.exists('/sandbox/file.txt')).toBe(false);
    });

    it('should delete directory', () => {
      memfs.mkdir('/sandbox/dir');
      memfs.delete('/sandbox/dir');
      expect(memfs.exists('/sandbox/dir')).toBe(false);
    });

    it('should fail deleting non-empty directory without recursive', () => {
      memfs.write('/sandbox/dir/file.txt', 'content');
      expect(() => memfs.delete('/sandbox/dir')).toThrow('Directory not empty');
    });

    it('should recursively delete directory', () => {
      memfs.write('/sandbox/dir/file.txt', 'content');
      memfs.delete('/sandbox/dir', true);
      expect(memfs.exists('/sandbox/dir')).toBe(false);
    });
  });

  describe('Quota', () => {
    it('should enforce quota', () => {
      const smallFS = new MemFS({ maxSize: 100 });
      const content = Buffer.alloc(101);

      expect(() => smallFS.write('/file.bin', content)).toThrow('Quota exceeded');
    });

    it('should track usage correctly', () => {
      memfs.write('/file1', Buffer.alloc(100));
      expect(memfs.getQuotaUsage().used).toBe(100);

      memfs.write('/file2', Buffer.alloc(50));
      expect(memfs.getQuotaUsage().used).toBe(150);

      memfs.delete('/file1');
      expect(memfs.getQuotaUsage().used).toBe(50);
    });
  });

  describe('Permissions', () => {
    it('should update permissions', () => {
      const path = '/sandbox/file.txt';
      memfs.write(path, 'content');
      memfs.chmod(path, 0o400); // Read only

      const stats = memfs.stat(path);
      expect(stats.permissions).toBe(0o400);
    });

    it('should enforce read permission', () => {
        const path = '/sandbox/secret.txt';
        memfs.write(path, 'secret');
        memfs.chmod(path, 0o000); // No permissions

        expect(() => memfs.read(path)).toThrow('Permission denied');
    });
  });

  describe('Paths', () => {
    it('should normalize paths', () => {
      expect(memfs.normalizePath('/a/./b/../c')).toBe('/a/c');
    });

    it('should validate paths', () => {
      expect(() => memfs.write('relative.txt', 'content')).toThrow('Path must be absolute');
    });
  });

  describe('Watching', () => {
    it('should notify watchers', () => {
      const path = '/sandbox/watched.txt';
      const spy = jest.fn();

      memfs.watch(path, spy);
      memfs.write(path, 'change 1');

      expect(spy).toHaveBeenCalledWith('create', path);

      memfs.write(path, 'change 2');
      expect(spy).toHaveBeenCalledWith('modify', path);
    });
  });
});
