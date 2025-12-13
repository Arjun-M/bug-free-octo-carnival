/**
 * @file src/filesystem/FileMetadata.ts
 * @description File metadata tracking including timestamps, size, and permissions. Manages creation, modification, and access times for virtual filesystem entries.
 * @since 1.0.0
 * @copyright Copyright (c) 2025 Arjun-M. This source code is licensed under the MIT license.
 */

/**
 * Metadata interface for files and directories.
 *
 * @interface IFileMetadata
 */
export interface IFileMetadata {
  created: number;
  modified: number;
  accessed: number;
  size: number;
  permissions: number;
}

/**
 * Manages file and directory metadata with automatic timestamp tracking.
 *
 * Tracks creation, modification, and access times along with file size and permissions.
 * Provides convenience methods for updating timestamps during filesystem operations.
 *
 * @class FileMetadata
 */
export class FileMetadata implements IFileMetadata {
  created: number;
  modified: number;
  accessed: number;
  size: number;
  permissions: number;

  /**
   * Create file metadata
   * @param permissions File permissions (default: 0o644)
   * @param size Initial file size
   */
  constructor(permissions: number = 0o644, size: number = 0) {
    const now = Date.now();
    this.created = now;
    this.modified = now;
    this.accessed = now;
    this.size = size;
    this.permissions = permissions;
  }

  /**
   * Update accessed timestamp to current time
   */
  touch(): void {
    this.accessed = Date.now();
  }

  /**
   * Update modified timestamp and size
   * @param newSize New file size in bytes
   */
  updateModified(newSize?: number): void {
    this.modified = Date.now();
    if (newSize !== undefined) {
      this.size = newSize;
    }
  }

  /**
   * Update only the size without changing modified time
   * @param newSize New file size in bytes
   */
  updateSize(newSize: number): void {
    this.size = newSize;
  }

  /**
   * Convert to JSON-serializable object
   */
  toJSON(): IFileMetadata {
    return {
      created: this.created,
      modified: this.modified,
      accessed: this.accessed,
      size: this.size,
      permissions: this.permissions,
    };
  }
}
