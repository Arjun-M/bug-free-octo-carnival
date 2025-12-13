/**
 * @file src/filesystem/MemFS.ts
 * @description In-memory virtual filesystem with quota management, permissions, and file watching. Provides a complete filesystem abstraction without external dependencies for sandboxed code execution.
 * @since 1.0.0
 * @copyright Copyright (c) 2025 Arjun-M. This source code is licensed under the MIT license.
 */

import { SandboxError } from '../core/types.js';
import { FileNode } from './FileNode.js';
import { FSWatcher, type WatchCallback } from './FSWatcher.js';
import { PERMISSIONS, checkPermission } from './Permissions.js';
import { logger } from '../utils/Logger.js';

/**
 * Configuration options for MemFS initialization.
 *
 * @interface MemFSOptions
 */
export interface MemFSOptions {
  /** Maximum storage size in bytes (default: 128MB) */
  maxSize?: number;
  /** Root directory path (currently unused) */
  root?: string;
}

/**
 * File or directory statistics.
 *
 * @interface FileStats
 */
export interface FileStats {
  /** Whether the entry is a directory */
  isDirectory: boolean;
  /** Size in bytes */
  size: number;
  /** Creation timestamp (milliseconds since epoch) */
  created: number;
  /** Last modification timestamp */
  modified: number;
  /** Last access timestamp */
  accessed: number;
  /** Unix-style permission bits */
  permissions: number;
}

/**
 * Storage quota usage information.
 *
 * @interface QuotaUsage
 */
export interface QuotaUsage {
  /** Bytes currently used */
  used: number;
  /** Maximum allowed bytes */
  limit: number;
  /** Usage as percentage (0-100) */
  percentage: number;
}

/**
 * In-memory virtual filesystem with quota enforcement and file watching.
 *
 * Provides a complete filesystem implementation that operates entirely in memory,
 * supporting standard operations like read, write, mkdir, delete with Unix-style
 * permissions, file watching, and quota management.
 *
 * The filesystem automatically creates mount points (/sandbox, /tmp, /cache) on initialization
 * and tracks total storage usage against a configurable quota.
 *
 * @class MemFS
 * @example
 * ```typescript
 * const fs = new MemFS({ maxSize: 128 * 1024 * 1024 });
 *
 * fs.write('/sandbox/test.txt', 'Hello, world!');
 * const content = fs.read('/sandbox/test.txt');
 * console.log(content.toString()); // 'Hello, world!'
 *
 * const unwatch = fs.watch('/sandbox', (event, path) => {
 *   console.log(`${event} on ${path}`);
 * });
 * ```
 */
export class MemFS {
  private _root: FileNode;
  private _watcher: FSWatcher;
  private _maxSize: number;
  private _currentSize: number = 0;

  constructor(options: MemFSOptions = {}) {
    this._maxSize = options.maxSize ?? 128 * 1024 * 1024;
    this._root = new FileNode({ isDirectory: true, permissions: PERMISSIONS.DEFAULT_DIR });
    this._watcher = new FSWatcher();

    logger.debug(
      `MemFS ready (${(this._maxSize / 1e6).toFixed(1)}MB quota)`
    );

    this._initializeMountPoints();
  }

  private _initializeMountPoints(): void {
    const mountPoints = ['sandbox', 'tmp', 'cache'];
    for (const mount of mountPoints) {
      try {
        this.mkdir(`/${mount}`, false);
      } catch {
        // Ignore if exists
      }
    }
  }

  /**
   * Write content to a file, creating parent directories as needed.
   *
   * Automatically creates parent directories if they don't exist. Enforces quota limits
   * and updates file metadata. Emits 'create' or 'modify' events to watchers.
   *
   * @param path - Absolute file path
   * @param content - File content as string or Buffer
   * @throws {SandboxError} QUOTA_EXCEEDED if write would exceed storage limit
   * @throws {SandboxError} NOT_A_DIRECTORY if path component is a file
   * @throws {SandboxError} INVALID_PATH if path is malformed
   */
  write(path: string, content: string | Buffer): void {
    const normalized = this.normalizePath(path);
    this.validatePath(normalized);

    const contentBuffer = Buffer.isBuffer(content) ? content : Buffer.from(content);

    if (this._currentSize + contentBuffer.length > this._maxSize) {
      throw new SandboxError(
        `Quota exceeded`,
        'QUOTA_EXCEEDED',
        { path, size: contentBuffer.length, available: this._maxSize - this._currentSize }
      );
    }

    const segments = this.parsePath(normalized);

    let current = this._root;
    for (let i = 0; i < segments.length - 1; i++) {
      const segment = segments[i];
      let child: FileNode | undefined = current.getChild(segment);

      if (!child) {
        child = new FileNode({ isDirectory: true, permissions: PERMISSIONS.DEFAULT_DIR });
        current.addChild(segment, child);
      }

      if (!child.isDirectory) {
        throw new SandboxError(`Not a directory: ${segment}`, 'NOT_A_DIRECTORY', {
          path: normalized,
        });
      }

      current = child;
    }

    const filename = segments[segments.length - 1];
    let fileNode: FileNode | undefined = current.getChild(filename);

    if (!fileNode) {
      fileNode = new FileNode({ isDirectory: false });
      current.addChild(filename, fileNode);
      this._watcher.notify(normalized, 'create');
    }

    // MAJOR FIX: Properly track size delta for quota enforcement
    const oldSize = fileNode.content?.length ?? 0;
    const sizeDelta = contentBuffer.length - oldSize;

    // Check quota before updating (in case of overwrite)
    if (sizeDelta > 0 && this._currentSize + sizeDelta > this._maxSize) {
      throw new SandboxError(
        `Quota exceeded`,
        'QUOTA_EXCEEDED',
        { 
          path, 
          size: contentBuffer.length, 
          available: this._maxSize - this._currentSize,
          delta: sizeDelta
        }
      );
    }

    fileNode.content = contentBuffer;
    fileNode.metadata.updateModified();
    fileNode.metadata.updateSize(contentBuffer.length);

    this._currentSize += sizeDelta;

    logger.debug(`Wrote ${contentBuffer.length} bytes to ${normalized} (delta: ${sizeDelta > 0 ? '+' : ''}${sizeDelta})`);
    this._watcher.notify(normalized, 'modify');
  }

  /**
   * Read file contents and return as Buffer.
   *
   * Updates the file's access timestamp and enforces read permissions.
   *
   * @param path - Absolute file path
   * @returns File contents as Buffer
   * @throws {SandboxError} FILE_NOT_FOUND if file doesn't exist
   * @throws {SandboxError} IS_A_DIRECTORY if path is a directory
   * @throws {SandboxError} PERMISSION_DENIED if read permission is denied
   */
  read(path: string): Buffer {
    const normalized = this.normalizePath(path);
    const node = this._navigate(normalized);

    if (!node) {
      throw new SandboxError(`File not found: ${normalized}`, 'FILE_NOT_FOUND', { path });
    }

    if (node.isDirectory) {
      throw new SandboxError(`Is a directory: ${normalized}`, 'IS_A_DIRECTORY', { path });
    }

    if (!checkPermission(node.permissions, 'read')) {
      throw new SandboxError(`Permission denied: ${normalized}`, 'PERMISSION_DENIED', {
        path,
        permissions: node.permissions.toString(8),
      });
    }

    node.metadata.touch();
    return node.content ?? Buffer.alloc(0);
  }

  /**
   * List contents of a directory.
   *
   * Returns array of entry names (not full paths). Updates directory access timestamp.
   *
   * @param path - Absolute directory path
   * @returns Array of entry names
   * @throws {SandboxError} DIRECTORY_NOT_FOUND if directory doesn't exist
   * @throws {SandboxError} NOT_A_DIRECTORY if path is a file
   */
  readdir(path: string): string[] {
    const normalized = this.normalizePath(path);
    const node = this._navigate(normalized);

    if (!node) {
      throw new SandboxError(`Directory not found: ${normalized}`, 'DIRECTORY_NOT_FOUND', {
        path,
      });
    }

    if (!node.isDirectory) {
      throw new SandboxError(`Not a directory: ${normalized}`, 'NOT_A_DIRECTORY', { path });
    }

    node.metadata.touch();
    return node.listChildren();
  }

  /**
   * Create a directory.
   *
   * When recursive is true, creates all missing parent directories. Emits 'create'
   * events for each newly created directory.
   *
   * @param path - Absolute directory path
   * @param recursive - Whether to create parent directories (default: false)
   * @throws {SandboxError} PARENT_NOT_FOUND if parent doesn't exist and recursive is false
   * @throws {SandboxError} NOT_A_DIRECTORY if path component is a file
   */
  mkdir(path: string, recursive: boolean = false): void {
    const normalized = this.normalizePath(path);
    this.validatePath(normalized);

    if (normalized === '/') return;

    const segments = this.parsePath(normalized);

    let current = this._root;
    const createdPaths: string[] = [];

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      let child: FileNode | undefined = current.getChild(segment);

      if (!child) {
        if (!recursive && i < segments.length - 1) {
          throw new SandboxError(
            `Parent directory missing: ${normalized}`,
            'PARENT_NOT_FOUND',
            { path }
          );
        }

        child = new FileNode({ isDirectory: true, permissions: PERMISSIONS.DEFAULT_DIR });
        current.addChild(segment, child);
        
        // MAJOR FIX: Build path correctly using loop index
        const createdPath = '/' + segments.slice(0, i + 1).join('/');
        createdPaths.push(createdPath);
        this._watcher.notify(createdPath, 'create');
      } else if (!child.isDirectory) {
        throw new SandboxError(`Not a directory: ${segment}`, 'NOT_A_DIRECTORY', { path });
      }

      current = child;
    }

    if (createdPaths.length > 0) {
      logger.debug(`mkdir created ${createdPaths.length} directories: ${createdPaths.join(', ')}`);
    }
  }

  /**
   * Check if a file or directory exists.
   *
   * @param path - Absolute path to check
   * @returns True if path exists
   */
  exists(path: string): boolean {
    const normalized = this.normalizePath(path);
    return this._navigate(normalized) !== undefined;
  }

  /**
   * Delete a file or directory.
   *
   * When deleting a directory, recursive must be true if it contains children.
   * Updates quota to reflect freed storage. Emits 'delete' event to watchers.
   *
   * @param path - Absolute path to delete
   * @param recursive - Whether to delete non-empty directories (default: false)
   * @throws {SandboxError} CANNOT_DELETE_ROOT if attempting to delete root
   * @throws {SandboxError} FILE_NOT_FOUND if path doesn't exist
   * @throws {SandboxError} DIRECTORY_NOT_EMPTY if directory has children and recursive is false
   */
  delete(path: string, recursive: boolean = false): void {
    const normalized = this.normalizePath(path);

    if (normalized === '/') {
      throw new SandboxError('Cannot delete root', 'CANNOT_DELETE_ROOT', {
        path,
      });
    }

    const segments = this.parsePath(normalized);
    const parentPath = segments.slice(0, -1);
    const filename = segments[segments.length - 1];

    let parent: FileNode | undefined = this._root;
    for (const segment of parentPath) {
      parent = parent.getChild(segment);
      if (!parent || !parent.isDirectory) {
        throw new SandboxError(`Path not found: ${normalized}`, 'PATH_NOT_FOUND', { path });
      }
    }

    const node = parent.getChild(filename);
    if (!node) {
      throw new SandboxError(`File not found: ${normalized}`, 'FILE_NOT_FOUND', { path });
    }

    if (node.isDirectory && node.childrenCount() > 0 && !recursive) {
      throw new SandboxError(
        `Directory not empty: ${normalized}`,
        'DIRECTORY_NOT_EMPTY',
        { path, count: node.childrenCount() }
      );
    }

    // MAJOR FIX: Recursively calculate size to subtract for directories
    const sizeToDelete = this._calculateNodeSize(node);
    this._currentSize -= sizeToDelete;

    parent.removeChild(filename);
    this._watcher.notify(normalized, 'delete');
  }

  /**
   * Get file or directory statistics.
   *
   * @param path - Absolute path
   * @returns FileStats object with metadata
   * @throws {SandboxError} PATH_NOT_FOUND if path doesn't exist
   */
  stat(path: string): FileStats {
    const normalized = this.normalizePath(path);
    const node = this._navigate(normalized);

    if (!node) {
      throw new SandboxError(`Path not found: ${normalized}`, 'PATH_NOT_FOUND', { path });
    }

    return {
      isDirectory: node.isDirectory,
      size: node.getSize(),
      created: node.metadata.created,
      modified: node.metadata.modified,
      accessed: node.metadata.accessed,
      permissions: node.permissions,
    };
  }

  /**
   * Change file or directory permissions.
   *
   * @param path - Absolute path
   * @param permissions - Unix-style permission bits (e.g., 0o644, 0o755)
   * @throws {SandboxError} PATH_NOT_FOUND if path doesn't exist
   */
  chmod(path: string, permissions: number): void {
    const normalized = this.normalizePath(path);
    const node = this._navigate(normalized);

    if (!node) {
      throw new SandboxError(`Path not found: ${normalized}`, 'PATH_NOT_FOUND', { path });
    }

    node.permissions = permissions;
    node.metadata.updateModified();
  }

  /**
   * Watch a path for changes.
   *
   * Callback receives events for the watched path and its children. Events include
   * 'create', 'modify', and 'delete'.
   *
   * @param path - Absolute path to watch
   * @param callback - Function called on file system changes
   * @returns Unwatch function to remove the watcher
   */
  watch(path: string, callback: WatchCallback): () => void {
    const normalized = this.normalizePath(path);
    const watchId = this._watcher.subscribe(normalized, callback);

    return () => {
      this._watcher.unsubscribe(watchId);
    };
  }

  /**
   * Get total storage used across all files.
   *
   * @returns Total bytes used
   */
  getTotalSize(): number {
    return this._currentSize;
  }

  /**
   * Recursively calculate total size of a node and its children.
   *
   * @param node - FileNode to measure
   * @returns Total size in bytes
   */
  private _calculateNodeSize(node: FileNode): number {
    let size = node.getSize();
    if (node.isDirectory) {
      for (const child of node.children.values()) {
        size += this._calculateNodeSize(child);
      }
    }
    return size;
  }

  /**
   * Get storage quota usage statistics.
   *
   * @returns QuotaUsage object with used, limit, and percentage
   */
  getQuotaUsage(): QuotaUsage {
    const used = this._currentSize;
    return {
      used,
      limit: this._maxSize,
      percentage: (used / this._maxSize) * 100,
    };
  }

  /**
   * Clear all files and directories, reset to initial state.
   *
   * Removes all content, resets quota usage, and recreates mount points.
   */
  clear(): void {
    this._root.children.clear();
    this._currentSize = 0;
    this._initializeMountPoints();
    logger.debug('MemFS cleared');
  }

  /**
   * Normalize a path to absolute form with no .. or . segments.
   *
   * @param path - Path to normalize
   * @returns Normalized absolute path
   */
  normalizePath(path: string): string {
    if (!path.startsWith('/')) {
      path = '/' + path;
    }

    const parts = path.split('/');
    const normalized: string[] = [];

    for (const part of parts) {
      if (part === '' || part === '.') continue;
      else if (part === '..') normalized.pop();
      else normalized.push(part);
    }

    return '/' + normalized.join('/');
  }

  /**
   * Parse a path into segments, removing empty and . components.
   *
   * @param path - Path to parse
   * @returns Array of path segments
   */
  parsePath(path: string): string[] {
    return path
      .split('/')
      .filter((s) => s.length > 0)
      .filter((s) => s !== '.');
  }

  /**
   * Validate that a path meets security and format requirements.
   *
   * @param path - Path to validate
   * @throws {SandboxError} INVALID_PATH if path is malformed
   * @throws {SandboxError} PATH_TOO_LONG if path exceeds 4096 characters
   */
  private validatePath(path: string): void {
    if (!path.startsWith('/')) {
      throw new SandboxError('Path must be absolute', 'INVALID_PATH', { path });
    }

    if (path.length > 4096) {
      throw new SandboxError('Path too long', 'PATH_TOO_LONG', { path });
    }

    // eslint-disable-next-line no-control-regex
    if (/[\x00-\x1f\x7f]/.test(path)) {
      throw new SandboxError('Path invalid chars', 'INVALID_PATH', { path });
    }
  }

  /**
   * Navigate to a node in the filesystem tree.
   *
   * @param path - Absolute path to navigate to
   * @returns FileNode if found, undefined otherwise
   */
  private _navigate(path: string): FileNode | undefined {
    if (path === '/') return this._root;

    const segments = this.parsePath(path);
    let current = this._root;

    for (const segment of segments) {
      const child = current.getChild(segment);
      if (!child) return undefined;
      current = child;
    }

    return current;
  }

  /**
   * Get direct children of the root directory.
   *
   * @returns Map of child names to FileNodes
   */
  get children() {
    return this._root.children;
  }
}
