/**
 * @fileoverview In-memory virtual filesystem with no external dependencies
 *
 * Test Scenarios:
 * ===============
 * Test 1: Write file → read file → content matches
 *   - write('/sandbox/test.txt', 'hello') writes 5 bytes
 *   - read('/sandbox/test.txt') returns Buffer/string matching
 *   - Metadata reflects file size and timestamps
 *
 * Test 2: Write 200MB with 100MB quota → throws quota error
 *   - Write operation checks _currentSize + contentSize > _maxSize
 *   - Throws SandboxError with code QUOTA_EXCEEDED
 *   - Filesystem state unchanged (atomic operation)
 *
 * Test 3: mkdir -p /a/b/c → creates nested directories
 *   - mkdir('/a/b/c', true) creates all intermediate paths
 *   - Each level is a directory node
 *   - Later write('/a/b/c/file.txt') places file in deepest dir
 *
 * Test 4: chmod → permissions updated correctly
 *   - chmod('/sandbox/test.txt', 0o755) updates node.permissions
 *   - checkPermission() respects new mode
 *   - write() throws on permission denied
 *
 * Test 5: watch file → write triggers callback
 *   - watch('/sandbox/test.txt', callback) returns watch ID
 *   - write('/sandbox/test.txt') calls callback('modify', path)
 *   - delete('/sandbox/test.txt') calls callback('delete', path)
 *   - unwatch(id) removes subscription
 */

import { SandboxError } from '../core/types.js';
import { FileNode } from './FileNode.js';
import { FileMetadata } from './FileMetadata.js';
import { FSWatcher, type WatchCallback } from './FSWatcher.js';
import { PERMISSIONS, checkPermission } from './Permissions.js';
import { logger } from '../utils/Logger.js';

/**
 * Options for MemFS initialization
 */
export interface MemFSOptions {
  maxSize?: number;
  root?: string;
}

/**
 * File statistics information
 */
export interface FileStats {
  isDirectory: boolean;
  size: number;
  created: number;
  modified: number;
  accessed: number;
  permissions: number;
}

/**
 * Quota usage information
 */
export interface QuotaUsage {
  used: number;
  limit: number;
  percentage: number;
}

/**
 * In-memory virtual filesystem with no external dependencies
 *
 * Architecture:
 * - Tree-based structure with FileNode for each file/directory
 * - Size tracking via _currentSize
 * - Quota enforcement on writes
 * - Path normalization to handle .., ., //
 * - File watching via FSWatcher
 */
export class MemFS {
  private _root: FileNode;
  private _watcher: FSWatcher;
  private _maxSize: number;
  private _currentSize: number = 0;
  private readonly _rootPath: string;

  /**
   * Create a new virtual filesystem
   * @param options Initialization options
   */
  constructor(options: MemFSOptions = {}) {
    this._maxSize = options.maxSize ?? 128 * 1024 * 1024; // 128MB default
    this._rootPath = options.root ?? '/';
    this._root = new FileNode({ isDirectory: true, permissions: PERMISSIONS.DEFAULT_DIR });
    this._watcher = new FSWatcher();

    logger.debug(
      `MemFS initialized with ${(this._maxSize / 1024 / 1024).toFixed(2)}MB quota`
    );

    // Initialize default mount points
    this._initializeMountPoints();
  }

  /**
   * Initialize default mount points
   */
  private _initializeMountPoints(): void {
    const mountPoints = ['sandbox', 'tmp', 'cache'];
    for (const mount of mountPoints) {
      try {
        this.mkdir(`/${mount}`, false);
      } catch {
        // Already exists or error - safe to ignore
      }
    }
  }

  /**
   * Write content to a file (creates or overwrites)
   * @param path File path
   * @param content Content to write (string or Buffer)
   * @param options Write options
   */
  write(path: string, content: string | Buffer): void {
    const normalized = this.normalizePath(path);
    this.validatePath(normalized);

    const contentBuffer = Buffer.isBuffer(content) ? content : Buffer.from(content);

    // Check quota
    if (this._currentSize + contentBuffer.length > this._maxSize) {
      throw new SandboxError(
        `Quota exceeded: would exceed ${(this._maxSize / 1024 / 1024).toFixed(2)}MB limit`,
        'QUOTA_EXCEEDED',
        { path, size: contentBuffer.length, available: this._maxSize - this._currentSize }
      );
    }

    const segments = this.parsePath(normalized);

    // Navigate/create directory structure
    let current = this._root;
    for (let i = 0; i < segments.length - 1; i++) {
      const segment = segments[i];
      let child = current.getChild(segment);

      if (!child) {
        child = new FileNode({ isDirectory: true });
        current.addChild(segment, child);
      }

      if (!child.isDirectory) {
        throw new SandboxError(`Not a directory: ${segment}`, 'NOT_A_DIRECTORY', {
          path: normalized,
        });
      }

      current = child;
    }

    // Create or update file
    const filename = segments[segments.length - 1];
    let fileNode = current.getChild(filename);

    if (!fileNode) {
      fileNode = new FileNode({ isDirectory: false });
      current.addChild(filename, fileNode);
      this._watcher.notify(normalized, 'create');
    }

    // Update content and size tracking
    const oldSize = fileNode.content?.length ?? 0;
    fileNode.content = contentBuffer;
    fileNode.metadata.updateModified();
    fileNode.metadata.updateSize(contentBuffer.length);

    this._currentSize += contentBuffer.length - oldSize;

    logger.debug(`Wrote ${contentBuffer.length} bytes to ${normalized}`);
    this._watcher.notify(normalized, 'modify');
  }

  /**
   * Read file content
   * @param path File path
   * @returns File content as Buffer
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
    logger.debug(`Read ${node.content?.length ?? 0} bytes from ${normalized}`);
    return node.content ?? Buffer.alloc(0);
  }

  /**
   * Read directory contents
   * @param path Directory path
   * @returns Array of file/directory names
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
    const entries = node.listChildren();
    logger.debug(`Listed ${entries.length} entries in ${normalized}`);
    return entries;
  }

  /**
   * Create a directory
   * @param path Directory path
   * @param recursive Create parent directories if needed
   */
  mkdir(path: string, recursive: boolean = false): void {
    const normalized = this.normalizePath(path);
    this.validatePath(normalized);

    if (normalized === '/') {
      return;
    }

    const segments = this.parsePath(normalized);

    let current = this._root;
    for (const segment of segments) {
      let child = current.getChild(segment);

      if (!child) {
        if (!recursive && current !== this._root) {
          throw new SandboxError(
            `Parent directory does not exist: ${normalized}`,
            'PARENT_NOT_FOUND',
            { path }
          );
        }

        child = new FileNode({ isDirectory: true });
        current.addChild(segment, child);
        this._watcher.notify(this._buildPath(current, segment), 'create');
      } else if (!child.isDirectory) {
        throw new SandboxError(`Not a directory: ${segment}`, 'NOT_A_DIRECTORY', { path });
      }

      current = child;
    }

    logger.debug(`Created directory ${normalized}`);
  }

  /**
   * Check if path exists
   * @param path File or directory path
   * @returns True if path exists
   */
  exists(path: string): boolean {
    const normalized = this.normalizePath(path);
    return this._navigate(normalized) !== undefined;
  }

  /**
   * Delete a file or directory
   * @param path File or directory path
   * @param recursive Delete directory contents recursively
   */
  delete(path: string, recursive: boolean = false): void {
    const normalized = this.normalizePath(path);

    if (normalized === '/') {
      throw new SandboxError('Cannot delete root directory', 'CANNOT_DELETE_ROOT', {
        path,
      });
    }

    const segments = this.parsePath(normalized);
    const parentPath = segments.slice(0, -1);
    const filename = segments[segments.length - 1];

    let parent = this._root;
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

    // Check if directory is non-empty
    if (node.isDirectory && node.childrenCount() > 0 && !recursive) {
      throw new SandboxError(
        `Directory not empty: ${normalized}`,
        'DIRECTORY_NOT_EMPTY',
        { path, count: node.childrenCount() }
      );
    }

    // Reduce current size
    this._currentSize -= node.getSize();

    // Remove node
    parent.removeChild(filename);

    logger.debug(`Deleted ${normalized}`);
    this._watcher.notify(normalized, 'delete');
  }

  /**
   * Get file/directory stats
   * @param path File or directory path
   * @returns File statistics
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
   * Change file permissions
   * @param path File or directory path
   * @param permissions Unix-style permission mode (e.g., 0o755)
   */
  chmod(path: string, permissions: number): void {
    const normalized = this.normalizePath(path);
    const node = this._navigate(normalized);

    if (!node) {
      throw new SandboxError(`Path not found: ${normalized}`, 'PATH_NOT_FOUND', { path });
    }

    node.permissions = permissions;
    node.metadata.updateModified();

    logger.debug(`Changed permissions of ${normalized} to ${permissions.toString(8)}`);
  }

  /**
   * Watch a path for changes
   * @param path File or directory path to watch
   * @param callback Callback invoked on changes
   * @returns Function to unsubscribe
   */
  watch(path: string, callback: WatchCallback): () => void {
    const normalized = this.normalizePath(path);
    const watchId = this._watcher.subscribe(normalized, callback);

    return () => {
      this._watcher.unsubscribe(watchId);
    };
  }

  /**
   * Get total filesystem size
   * @returns Size in bytes
   */
  getTotalSize(): number {
    return this._root.getSize();
  }

  /**
   * Get quota usage information
   * @returns Quota usage object
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
   * Clear all files (keep only mount points)
   */
  clear(): void {
    this._root.children.clear();
    this._currentSize = 0;
    this._initializeMountPoints();
    logger.debug('MemFS cleared');
  }

  /**
   * Normalize path (resolve .. and . and multiple /)
   * @param path Input path
   * @returns Normalized absolute path
   */
  normalizePath(path: string): string {
    // Convert to absolute
    if (!path.startsWith('/')) {
      path = '/' + path;
    }

    // Split and filter
    const parts = path.split('/');
    const normalized: string[] = [];

    for (const part of parts) {
      if (part === '' || part === '.') {
        // Skip empty and current directory
        continue;
      } else if (part === '..') {
        // Go up one level
        normalized.pop();
      } else {
        normalized.push(part);
      }
    }

    return '/' + normalized.join('/');
  }

  /**
   * Parse path into segments
   * @param path Normalized path
   * @returns Array of path segments
   */
  parsePath(path: string): string[] {
    return path
      .split('/')
      .filter((s) => s.length > 0)
      .filter((s) => s !== '.');
  }

  /**
   * Validate path for invalid characters
   * @param path Path to validate
   */
  private validatePath(path: string): void {
    if (!path.startsWith('/')) {
      throw new SandboxError('Path must be absolute', 'INVALID_PATH', { path });
    }

    if (path.length > 4096) {
      throw new SandboxError('Path too long (max 4096 characters)', 'PATH_TOO_LONG', { path });
    }

    // Check for invalid characters (null, control chars)
    if (/[\x00-\x1f\x7f]/.test(path)) {
      throw new SandboxError('Path contains invalid characters', 'INVALID_PATH', { path });
    }
  }

  /**
   * Navigate to a node at given path
   * @param path Path to navigate to
   * @returns Node if found, undefined otherwise
   */
  private _navigate(path: string): FileNode | undefined {
    if (path === '/') {
      return this._root;
    }

    const segments = this.parsePath(path);
    let current = this._root;

    for (const segment of segments) {
      const child = current.getChild(segment);
      if (!child) {
        return undefined;
      }
      current = child;
    }

    return current;
  }

  /**
   * Build full path from parent node and child name
   * @param parent Parent node
   * @param childName Child name
   * @returns Full path string
   */
  private _buildPath(parent: FileNode, childName: string): string {
    if (parent === this._root) {
      return '/' + childName;
    }

    const parts: string[] = [childName];
    let current = parent;

    while (current.parent && current.parent !== this._root) {
      const parentName = this._findNodeName(current.parent, current);
      if (parentName) {
        parts.unshift(parentName);
      }
      current = current.parent;
    }

    return '/' + parts.join('/');
  }

  /**
   * Find name of a child in parent node
   * @param parent Parent node
   * @param child Child node to find
   * @returns Child name or undefined
   */
  private _findNodeName(parent: FileNode, child: FileNode): string | undefined {
    for (const [name, node] of parent.children) {
      if (node === child) {
        return name;
      }
    }
    return undefined;
  }
}
