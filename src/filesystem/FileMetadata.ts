/**
 * @fileoverview File metadata tracking (created, modified, accessed, size, permissions)
 */

/**
 * Metadata for files and directories
 */
export interface IFileMetadata {
  created: number;
  modified: number;
  accessed: number;
  size: number;
  permissions: number;
}

/**
 * Manages file/directory metadata with timestamp tracking
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
