/**
 * @file src/filesystem/Permissions.ts
 * @description Unix-style permission utilities and constants for virtual filesystem. Provides permission checking, parsing, and formatting functions.
 * @since 1.0.0
 * @copyright Copyright (c) 2025 Arjun-M. This source code is licensed under the MIT license.
 */

/**
 * Unix-style permission constants for files and directories.
 *
 * @enum {number}
 */
export const PERMISSIONS = {
  READ: 0o444,
  WRITE: 0o222,
  EXECUTE: 0o111,
  DEFAULT_FILE: 0o644,
  DEFAULT_DIR: 0o755,
  READABLE_DIR: 0o755,
} as const;

/**
 * Parse permission mode from string or number
 * @param mode Permission mode as octal string ('644', '755') or number (0o644, 0o755)
 * @returns Numeric permission mode
 */
export function parsePermissions(mode: string | number): number {
  if (typeof mode === 'number') {
    return mode;
  }

  // Parse octal string (e.g., '644' -> 0o644)
  if (typeof mode === 'string') {
    return parseInt(mode, 8);
  }

  return PERMISSIONS.DEFAULT_FILE;
}

/**
 * Check if permissions allow a specific operation
 * @param permissions File permissions (octal mode)
 * @param type Operation type: 'read', 'write', or 'execute'
 * @returns True if operation is allowed
 */
export function checkPermission(
  permissions: number,
  type: 'read' | 'write' | 'execute'
): boolean {
  const mask =
    type === 'read'
      ? PERMISSIONS.READ
      : type === 'write'
        ? PERMISSIONS.WRITE
        : PERMISSIONS.EXECUTE;

  return (permissions & mask) !== 0;
}

/**
 * Convert permission number to readable string
 * @param mode Permission mode (octal)
 * @returns String representation (e.g., 'rw-r--r--')
 */
export function formatPermissions(mode: number): string {
  const user = {
    read: (mode & 0o400) !== 0,
    write: (mode & 0o200) !== 0,
    execute: (mode & 0o100) !== 0,
  };

  const group = {
    read: (mode & 0o040) !== 0,
    write: (mode & 0o020) !== 0,
    execute: (mode & 0o010) !== 0,
  };

  const other = {
    read: (mode & 0o004) !== 0,
    write: (mode & 0o002) !== 0,
    execute: (mode & 0o001) !== 0,
  };

  const formatPerm = (perm: { read: boolean; write: boolean; execute: boolean }) =>
    `${perm.read ? 'r' : '-'}${perm.write ? 'w' : '-'}${perm.execute ? 'x' : '-'}`;

  return formatPerm(user) + formatPerm(group) + formatPerm(other);
}
