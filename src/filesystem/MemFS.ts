/**
 * In-memory virtual filesystem with no external dependencies.
 */

import { SandboxError } from '../core/types.js';
import { FileNode } from './FileNode.js';
import { FSWatcher, type WatchCallback } from './FSWatcher.js';
import { PERMISSIONS, checkPermission } from './Permissions.js';
import { logger } from '../utils/Logger.js';

export interface MemFSOptions {
  maxSize?: number;
  root?: string;
}

export interface FileStats {
  isDirectory: boolean;
  size: number;
  created: number;
  modified: number;
  accessed: number;
  permissions: number;
}

export interface QuotaUsage {
  used: number;
  limit: number;
  percentage: number;
}

export class MemFS {
  private _root: FileNode;
  private _watcher: FSWatcher;
  private _maxSize: number;
  private _currentSize: number = 0;

  constructor(options: MemFSOptions = {}) {
    this._maxSize = options.maxSize ?? 128 * 1024 * 1024; // 128MB
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

    const filename = segments[segments.length - 1];
    let fileNode: FileNode | undefined = current.getChild(filename);

    if (!fileNode) {
      fileNode = new FileNode({ isDirectory: false });
      current.addChild(filename, fileNode);
      this._watcher.notify(normalized, 'create');
    }

    const oldSize = fileNode.content?.length ?? 0;
    fileNode.content = contentBuffer;
    fileNode.metadata.updateModified();
    fileNode.metadata.updateSize(contentBuffer.length);

    this._currentSize += contentBuffer.length - oldSize;

    logger.debug(`Wrote ${contentBuffer.length} bytes to ${normalized}`);
    this._watcher.notify(normalized, 'modify');
  }

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

  mkdir(path: string, recursive: boolean = false): void {
    const normalized = this.normalizePath(path);
    this.validatePath(normalized);

    if (normalized === '/') return;

    const segments = this.parsePath(normalized);

    let current = this._root;
    for (const segment of segments) {
      let child: FileNode | undefined = current.getChild(segment);

      if (!child) {
        const isLast = segments.indexOf(segment) === segments.length - 1;
        if (!recursive && !isLast) {
           throw new SandboxError(
            `Parent directory missing: ${normalized}`,
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

    logger.debug(`mkdir ${normalized}`);
  }

  exists(path: string): boolean {
    const normalized = this.normalizePath(path);
    return this._navigate(normalized) !== undefined;
  }

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

    this._currentSize -= node.getSize();
    parent.removeChild(filename);
    this._watcher.notify(normalized, 'delete');
  }

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

  chmod(path: string, permissions: number): void {
    const normalized = this.normalizePath(path);
    const node = this._navigate(normalized);

    if (!node) {
      throw new SandboxError(`Path not found: ${normalized}`, 'PATH_NOT_FOUND', { path });
    }

    node.permissions = permissions;
    node.metadata.updateModified();
  }

  watch(path: string, callback: WatchCallback): () => void {
    const normalized = this.normalizePath(path);
    const watchId = this._watcher.subscribe(normalized, callback);

    return () => {
      this._watcher.unsubscribe(watchId);
    };
  }

  getTotalSize(): number {
    return this._root.getSize();
  }

  getQuotaUsage(): QuotaUsage {
    const used = this._currentSize;
    return {
      used,
      limit: this._maxSize,
      percentage: (used / this._maxSize) * 100,
    };
  }

  clear(): void {
    this._root.children.clear();
    this._currentSize = 0;
    this._initializeMountPoints();
    logger.debug('MemFS cleared');
  }

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

  parsePath(path: string): string[] {
    return path
      .split('/')
      .filter((s) => s.length > 0)
      .filter((s) => s !== '.');
  }

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

  private _buildPath(parent: FileNode, childName: string): string {
    if (parent === this._root) return '/' + childName;

    const parts: string[] = [childName];
    let current = parent;

    while (current.parent && current.parent !== this._root) {
      const parentName = this._findNodeName(current.parent, current);
      if (parentName) parts.unshift(parentName);
      current = current.parent;
    }

    return '/' + parts.join('/');
  }

  private _findNodeName(parent: FileNode, child: FileNode): string | undefined {
    for (const [name, node] of parent.children) {
      if (node === child) {
        return name;
      }
    }
    return undefined;
  }
}
