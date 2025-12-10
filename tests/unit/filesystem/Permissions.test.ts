import { PERMISSIONS, parsePermissions, checkPermission, formatPermissions } from '../../../src/filesystem/Permissions';

describe('Permissions', () => {
  describe('Constants', () => {
    it('should have correct default values', () => {
      expect(PERMISSIONS.READ).toBe(0o444);
      expect(PERMISSIONS.WRITE).toBe(0o222);
      expect(PERMISSIONS.EXECUTE).toBe(0o111);
      expect(PERMISSIONS.DEFAULT_FILE).toBe(0o644);
      expect(PERMISSIONS.DEFAULT_DIR).toBe(0o755);
    });
  });

  describe('parsePermissions', () => {
    it('should parse number permissions', () => {
      expect(parsePermissions(0o755)).toBe(0o755);
    });

    it('should parse string permissions', () => {
      expect(parsePermissions('755')).toBe(0o755);
      expect(parsePermissions('644')).toBe(0o644);
    });

    it('should return default for invalid input', () => {
      expect(parsePermissions(null as any)).toBe(PERMISSIONS.DEFAULT_FILE);
    });
  });

  describe('checkPermission', () => {
    it('should check read permission', () => {
      expect(checkPermission(0o400, 'read')).toBe(true); // User read
      expect(checkPermission(0o040, 'read')).toBe(true); // Group read
      expect(checkPermission(0o004, 'read')).toBe(true); // Other read
      expect(checkPermission(0o200, 'read')).toBe(false); // Only write
    });

    it('should check write permission', () => {
      expect(checkPermission(0o200, 'write')).toBe(true);
      expect(checkPermission(0o400, 'write')).toBe(false);
    });

    it('should check execute permission', () => {
      expect(checkPermission(0o100, 'execute')).toBe(true);
      expect(checkPermission(0o600, 'execute')).toBe(false);
    });
  });

  describe('formatPermissions', () => {
    it('should format permissions string', () => {
      expect(formatPermissions(0o755)).toBe('rwxr-xr-x');
      expect(formatPermissions(0o644)).toBe('rw-r--r--');
      expect(formatPermissions(0o000)).toBe('---------');
      expect(formatPermissions(0o777)).toBe('rwxrwxrwx');
    });
  });
});
