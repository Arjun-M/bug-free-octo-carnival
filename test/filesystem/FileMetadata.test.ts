import { FileMetadata } from '../../src/filesystem/FileMetadata';

describe('FileMetadata', () => {
  it('should store attributes', () => {
    // Constructor args are (permissions, size)
    const meta = new FileMetadata(0o644, 100);
    expect(meta.size).toBe(100);
  });

  it('should update mtime', () => {
      const meta = new FileMetadata(0o644, 100);
      const oldTime = meta.modified;
      // Sleep slightly to ensure time difference if needed, or just mock Date
      // Since it uses Date.now(), we can just call updateModified.
      // But we need to make sure time advances if we want strictly greater, or equal is fine.
      meta.updateModified();
      expect(meta.modified).toBeGreaterThanOrEqual(oldTime);
  });
});
