import * as Permissions from '../../src/filesystem/Permissions';

describe('Permissions', () => {
  it('should parse permissions', () => {
    expect(Permissions.parsePermissions('644')).toBe(0o644);
    expect(Permissions.parsePermissions(0o755)).toBe(0o755);
  });

  it('should check permissions', () => {
    // 644 = rw-r--r-- (User read/write, Group read, Other read)
    // Actually our mask check logic:
    // READ = 0o444 (Everyone read)
    // WRITE = 0o222 (Everyone write)
    // EXECUTE = 0o111 (Everyone execute)
    // If we want to check strict POSIX, we need context (user vs group vs other).
    // The implementation: `return (permissions & mask) !== 0;`
    // 0o644 & 0o444 = 0o444 (Non-zero, so readable)
    // 0o644 & 0o222 = (0o600 | 0o040 | 0o004) & 0o222 = (0o400|0o200|0o040|0o004) & (0o200|0o020|0o002)
    // 0o644 = 420 decimal
    // 0o222 = 146 decimal
    // 0o644 has user write (0o200). 0o222 has user write (0o200).
    // So 0o644 & 0o222 includes 0o200 bit.
    expect(Permissions.checkPermission(0o644, 'read')).toBe(true);
    expect(Permissions.checkPermission(0o644, 'write')).toBe(true);
    expect(Permissions.checkPermission(0o444, 'write')).toBe(false);
  });

  it('should format permissions', () => {
      expect(Permissions.formatPermissions(0o755)).toBe('rwxr-xr-x');
  });
});
