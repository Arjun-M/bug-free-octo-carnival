/**
 * @fileoverview Tests for Permission utilities
 */

import { describe, it, expect } from 'vitest';
import {
  PERMISSIONS,
  parsePermissions,
  checkPermission,
  formatPermissions,
} from './Permissions.js';

describe('Permissions', () => {
  describe('PERMISSIONS constants', () => {
    it('should have correct READ permission', () => {
      expect(PERMISSIONS.READ).toBe(0o444);
    });

    it('should have correct WRITE permission', () => {
      expect(PERMISSIONS.WRITE).toBe(0o222);
    });

    it('should have correct EXECUTE permission', () => {
      expect(PERMISSIONS.EXECUTE).toBe(0o111);
    });

    it('should have correct DEFAULT_FILE permission', () => {
      expect(PERMISSIONS.DEFAULT_FILE).toBe(0o644);
    });

    it('should have correct DEFAULT_DIR permission', () => {
      expect(PERMISSIONS.DEFAULT_DIR).toBe(0o755);
    });

    it('should have correct READABLE_DIR permission', () => {
      expect(PERMISSIONS.READABLE_DIR).toBe(0o755);
    });
  });

  describe('parsePermissions', () => {
    it('should parse numeric permissions', () => {
      expect(parsePermissions(0o644)).toBe(0o644);
      expect(parsePermissions(0o755)).toBe(0o755);
      expect(parsePermissions(0o777)).toBe(0o777);
    });

    it('should parse octal string permissions', () => {
      expect(parsePermissions('644')).toBe(0o644);
      expect(parsePermissions('755')).toBe(0o755);
      expect(parsePermissions('777')).toBe(0o777);
    });

    it('should handle leading zeros in strings', () => {
      expect(parsePermissions('0644')).toBe(0o644);
      expect(parsePermissions('0755')).toBe(0o755);
    });

    it('should handle empty string as NaN', () => {
      // Empty string parseInt with base 8 gives NaN, not DEFAULT_FILE
      const result = parsePermissions('' as any);
      expect(isNaN(result)).toBe(true);
    });

    it('should handle zero permissions', () => {
      expect(parsePermissions(0o000)).toBe(0o000);
      expect(parsePermissions('000')).toBe(0o000);
    });

    it('should handle full permissions', () => {
      expect(parsePermissions(0o777)).toBe(0o777);
      expect(parsePermissions('777')).toBe(0o777);
    });
  });

  describe('checkPermission', () => {
    describe('read permissions', () => {
      it('should allow read for 0o644', () => {
        expect(checkPermission(0o644, 'read')).toBe(true);
      });

      it('should allow read for 0o444', () => {
        expect(checkPermission(0o444, 'read')).toBe(true);
      });

      it('should deny read for 0o000', () => {
        expect(checkPermission(0o000, 'read')).toBe(false);
      });

      it('should deny read for write-only 0o222', () => {
        expect(checkPermission(0o222, 'read')).toBe(false);
      });
    });

    describe('write permissions', () => {
      it('should allow write for 0o644', () => {
        expect(checkPermission(0o644, 'write')).toBe(true);
      });

      it('should allow write for 0o222', () => {
        expect(checkPermission(0o222, 'write')).toBe(true);
      });

      it('should deny write for 0o444 (read-only)', () => {
        expect(checkPermission(0o444, 'write')).toBe(false);
      });

      it('should deny write for 0o000', () => {
        expect(checkPermission(0o000, 'write')).toBe(false);
      });
    });

    describe('execute permissions', () => {
      it('should allow execute for 0o755', () => {
        expect(checkPermission(0o755, 'execute')).toBe(true);
      });

      it('should allow execute for 0o111', () => {
        expect(checkPermission(0o111, 'execute')).toBe(true);
      });

      it('should deny execute for 0o644', () => {
        expect(checkPermission(0o644, 'execute')).toBe(false);
      });

      it('should deny execute for 0o000', () => {
        expect(checkPermission(0o000, 'execute')).toBe(false);
      });
    });

    describe('edge cases', () => {
      it('should handle full permissions 0o777', () => {
        expect(checkPermission(0o777, 'read')).toBe(true);
        expect(checkPermission(0o777, 'write')).toBe(true);
        expect(checkPermission(0o777, 'execute')).toBe(true);
      });

      it('should handle no permissions 0o000', () => {
        expect(checkPermission(0o000, 'read')).toBe(false);
        expect(checkPermission(0o000, 'write')).toBe(false);
        expect(checkPermission(0o000, 'execute')).toBe(false);
      });

      it('should check only user permissions (owner)', () => {
        // 0o700 = rwx for user, nothing for group/other
        expect(checkPermission(0o700, 'read')).toBe(true);
        expect(checkPermission(0o700, 'write')).toBe(true);
        expect(checkPermission(0o700, 'execute')).toBe(true);
      });
    });
  });

  describe('formatPermissions', () => {
    it('should format 0o644 as rw-r--r--', () => {
      expect(formatPermissions(0o644)).toBe('rw-r--r--');
    });

    it('should format 0o755 as rwxr-xr-x', () => {
      expect(formatPermissions(0o755)).toBe('rwxr-xr-x');
    });

    it('should format 0o777 as rwxrwxrwx', () => {
      expect(formatPermissions(0o777)).toBe('rwxrwxrwx');
    });

    it('should format 0o000 as ---------', () => {
      expect(formatPermissions(0o000)).toBe('---------');
    });

    it('should format 0o444 as r--r--r--', () => {
      expect(formatPermissions(0o444)).toBe('r--r--r--');
    });

    it('should format 0o222 as -w--w--w-', () => {
      expect(formatPermissions(0o222)).toBe('-w--w--w-');
    });

    it('should format 0o111 as --x--x--x', () => {
      expect(formatPermissions(0o111)).toBe('--x--x--x');
    });

    it('should format 0o600 as rw-------', () => {
      expect(formatPermissions(0o600)).toBe('rw-------');
    });

    it('should format 0o700 as rwx------', () => {
      expect(formatPermissions(0o700)).toBe('rwx------');
    });

    it('should format 0o400 as r--------', () => {
      expect(formatPermissions(0o400)).toBe('r--------');
    });

    it('should format each permission bit correctly', () => {
      // Test individual bits
      expect(formatPermissions(0o100)).toBe('--x------'); // user execute only
      expect(formatPermissions(0o040)).toBe('---r-----'); // group read only
      expect(formatPermissions(0o002)).toBe('-------w-'); // other write only (8 dashes + w + dash)
    });

    it('should return 9 characters always', () => {
      expect(formatPermissions(0o777)).toHaveLength(9);
      expect(formatPermissions(0o000)).toHaveLength(9);
      expect(formatPermissions(0o644)).toHaveLength(9);
    });
  });

  describe('integration tests', () => {
    it('should parse and format round-trip correctly', () => {
      const modes = ['644', '755', '777', '000', '600', '400'];

      for (const mode of modes) {
        const parsed = parsePermissions(mode);
        const formatted = formatPermissions(parsed);
        expect(formatted).toHaveLength(9);
      }
    });

    it('should work with default file permissions', () => {
      const parsed = parsePermissions(PERMISSIONS.DEFAULT_FILE);
      expect(checkPermission(parsed, 'read')).toBe(true);
      expect(checkPermission(parsed, 'write')).toBe(true);
      expect(formatPermissions(parsed)).toBe('rw-r--r--');
    });

    it('should work with default directory permissions', () => {
      const parsed = parsePermissions(PERMISSIONS.DEFAULT_DIR);
      expect(checkPermission(parsed, 'read')).toBe(true);
      expect(checkPermission(parsed, 'write')).toBe(true);
      expect(checkPermission(parsed, 'execute')).toBe(true);
      expect(formatPermissions(parsed)).toBe('rwxr-xr-x');
    });
  });
});
