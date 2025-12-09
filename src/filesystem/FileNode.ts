/**
 * @fileoverview File system tree node representing file or directory
 */

import { FileMetadata, type IFileMetadata } from './FileMetadata.js';
import { PERMISSIONS } from './Permissions.js';

/**
 * Node options for creating files or directories
 */
export interface FileNodeOptions {
  isDirectory: boolean;
  content?: Buffer;
  permissions?: number;
}

/**
 * Tree node in the virtual filesystem
 * Represents either a file or a directory
 */
export class FileNode {
  isDirectory: boolean;
  content?: Buffer;
  children: Map<string, FileNode> = new Map();
  permissions: number;
  metadata: FileMetadata;
  parent?: FileNode;

  /**
   * Create a file or directory node
   * @param options Node configuration
   */
  constructor(options: FileNodeOptions) {
    this.isDirectory = options.isDirectory;
    this.content = options.content;
    this.permissions = options.permissions ?? (options.isDirectory
      ? PERMISSIONS.DEFAULT_DIR
      : PERMISSIONS.DEFAULT_FILE);

    const contentSize = this.content?.length ?? 0;
    this.metadata = new FileMetadata(this.permissions, contentSize);
  }

  /**
   * Get a child node by name
   * @param name Child name
   * @returns Child node if exists, undefined otherwise
   */
  getChild(name: string): FileNode | undefined {
    return this.children.get(name);
  }

  /**
   * Add a child node
   * @param name Child name
   * @param node Child node
   */
  addChild(name: string, node: FileNode): void {
    node.parent = this;
    this.children.set(name, node);
  }

  /**
   * Remove a child node
   * @param name Child name
   * @returns True if child was removed
   */
  removeChild(name: string): boolean {
    const node = this.children.get(name);
    if (node) {
      node.parent = undefined;
      this.children.delete(name);
      return true;
    }
    return false;
  }

  /**
   * Get total size of this node (recursive for directories)
   * @returns Size in bytes
   */
  getSize(): number {
    if (!this.isDirectory) {
      return this.content?.length ?? 0;
    }

    let totalSize = 0;
    for (const child of this.children.values()) {
      totalSize += child.getSize();
    }
    return totalSize;
  }

  /**
   * Get list of child names
   * @returns Array of child names
   */
  listChildren(): string[] {
    return Array.from(this.children.keys());
  }

  /**
   * Check if node has a child with given name
   * @param name Child name
   * @returns True if child exists
   */
  hasChild(name: string): boolean {
    return this.children.has(name);
  }

  /**
   * Get number of children
   * @returns Children count
   */
  childrenCount(): number {
    return this.children.size;
  }

  /**
   * Convert node to JSON-serializable object
   */
  toJSON(): Record<string, any> {
    return {
      isDirectory: this.isDirectory,
      size: this.metadata.size,
      metadata: this.metadata.toJSON(),
      childrenCount: this.children.size,
      children: this.isDirectory
        ? Array.from(this.children.entries()).map(([name, child]) => ({
            name,
            isDirectory: child.isDirectory,
            size: child.metadata.size,
          }))
        : undefined,
    };
  }
}
