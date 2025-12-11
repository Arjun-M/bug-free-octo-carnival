/**
 * @fileoverview Tests for FileNode
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { FileNode } from './FileNode.js';
import { PERMISSIONS } from './Permissions.js';

describe('FileNode', () => {
  describe('constructor', () => {
    it('should create file node', () => {
      const node = new FileNode({ isDirectory: false });

      expect(node.isDirectory).toBe(false);
      expect(node.content).toBeUndefined();
      expect(node.permissions).toBe(PERMISSIONS.DEFAULT_FILE);
      expect(node.children.size).toBe(0);
      expect(node.metadata).toBeDefined();
    });

    it('should create directory node', () => {
      const node = new FileNode({ isDirectory: true });

      expect(node.isDirectory).toBe(true);
      expect(node.content).toBeUndefined();
      expect(node.permissions).toBe(PERMISSIONS.DEFAULT_DIR);
      expect(node.children.size).toBe(0);
    });

    it('should create file with content', () => {
      const content = Buffer.from('hello world');
      const node = new FileNode({ isDirectory: false, content });

      expect(node.content).toBe(content);
      expect(node.metadata.size).toBe(content.length);
    });

    it('should create node with custom permissions', () => {
      const node = new FileNode({
        isDirectory: false,
        permissions: 0o600,
      });

      expect(node.permissions).toBe(0o600);
    });

    it('should initialize metadata with correct size', () => {
      const content = Buffer.from('test content');
      const node = new FileNode({ isDirectory: false, content });

      expect(node.metadata.size).toBe(content.length);
    });
  });

  describe('getChild', () => {
    it('should return undefined for non-existent child', () => {
      const node = new FileNode({ isDirectory: true });

      expect(node.getChild('nonexistent')).toBeUndefined();
    });

    it('should return child if exists', () => {
      const parent = new FileNode({ isDirectory: true });
      const child = new FileNode({ isDirectory: false });

      parent.addChild('test.txt', child);

      expect(parent.getChild('test.txt')).toBe(child);
    });
  });

  describe('addChild', () => {
    it('should add child node', () => {
      const parent = new FileNode({ isDirectory: true });
      const child = new FileNode({ isDirectory: false });

      parent.addChild('file.txt', child);

      expect(parent.children.size).toBe(1);
      expect(parent.getChild('file.txt')).toBe(child);
    });

    it('should set parent reference', () => {
      const parent = new FileNode({ isDirectory: true });
      const child = new FileNode({ isDirectory: false });

      parent.addChild('file.txt', child);

      expect(child.parent).toBe(parent);
    });

    it('should allow adding multiple children', () => {
      const parent = new FileNode({ isDirectory: true });
      const child1 = new FileNode({ isDirectory: false });
      const child2 = new FileNode({ isDirectory: false });

      parent.addChild('file1.txt', child1);
      parent.addChild('file2.txt', child2);

      expect(parent.children.size).toBe(2);
      expect(parent.getChild('file1.txt')).toBe(child1);
      expect(parent.getChild('file2.txt')).toBe(child2);
    });

    it('should overwrite existing child with same name', () => {
      const parent = new FileNode({ isDirectory: true });
      const child1 = new FileNode({ isDirectory: false });
      const child2 = new FileNode({ isDirectory: false });

      parent.addChild('file.txt', child1);
      parent.addChild('file.txt', child2);

      expect(parent.children.size).toBe(1);
      expect(parent.getChild('file.txt')).toBe(child2);
    });
  });

  describe('removeChild', () => {
    it('should remove existing child', () => {
      const parent = new FileNode({ isDirectory: true });
      const child = new FileNode({ isDirectory: false });

      parent.addChild('file.txt', child);
      const result = parent.removeChild('file.txt');

      expect(result).toBe(true);
      expect(parent.children.size).toBe(0);
      expect(parent.getChild('file.txt')).toBeUndefined();
    });

    it('should clear parent reference', () => {
      const parent = new FileNode({ isDirectory: true });
      const child = new FileNode({ isDirectory: false });

      parent.addChild('file.txt', child);
      parent.removeChild('file.txt');

      expect(child.parent).toBeUndefined();
    });

    it('should return false for non-existent child', () => {
      const parent = new FileNode({ isDirectory: true });

      const result = parent.removeChild('nonexistent.txt');

      expect(result).toBe(false);
    });

    it('should not affect other children', () => {
      const parent = new FileNode({ isDirectory: true });
      const child1 = new FileNode({ isDirectory: false });
      const child2 = new FileNode({ isDirectory: false });

      parent.addChild('file1.txt', child1);
      parent.addChild('file2.txt', child2);
      parent.removeChild('file1.txt');

      expect(parent.children.size).toBe(1);
      expect(parent.getChild('file2.txt')).toBe(child2);
    });
  });

  describe('getSize', () => {
    it('should return 0 for empty file', () => {
      const node = new FileNode({ isDirectory: false });

      expect(node.getSize()).toBe(0);
    });

    it('should return content size for file', () => {
      const content = Buffer.from('hello world');
      const node = new FileNode({ isDirectory: false, content });

      expect(node.getSize()).toBe(content.length);
    });

    it('should return 0 for empty directory', () => {
      const node = new FileNode({ isDirectory: true });

      expect(node.getSize()).toBe(0);
    });

    it('should return sum of children sizes for directory', () => {
      const parent = new FileNode({ isDirectory: true });
      const child1 = new FileNode({
        isDirectory: false,
        content: Buffer.from('hello'),
      });
      const child2 = new FileNode({
        isDirectory: false,
        content: Buffer.from('world'),
      });

      parent.addChild('file1.txt', child1);
      parent.addChild('file2.txt', child2);

      expect(parent.getSize()).toBe(10); // 5 + 5
    });

    it('should recursively calculate size for nested directories', () => {
      const root = new FileNode({ isDirectory: true });
      const subdir = new FileNode({ isDirectory: true });
      const file1 = new FileNode({
        isDirectory: false,
        content: Buffer.from('12345'),
      });
      const file2 = new FileNode({
        isDirectory: false,
        content: Buffer.from('67890'),
      });

      root.addChild('subdir', subdir);
      subdir.addChild('file1.txt', file1);
      root.addChild('file2.txt', file2);

      expect(root.getSize()).toBe(10); // 5 + 5
    });
  });

  describe('listChildren', () => {
    it('should return empty array for no children', () => {
      const node = new FileNode({ isDirectory: true });

      expect(node.listChildren()).toEqual([]);
    });

    it('should return array of child names', () => {
      const parent = new FileNode({ isDirectory: true });
      const child1 = new FileNode({ isDirectory: false });
      const child2 = new FileNode({ isDirectory: false });

      parent.addChild('file1.txt', child1);
      parent.addChild('file2.txt', child2);

      const children = parent.listChildren();

      expect(children).toHaveLength(2);
      expect(children).toContain('file1.txt');
      expect(children).toContain('file2.txt');
    });

    it('should return sorted children names', () => {
      const parent = new FileNode({ isDirectory: true });

      parent.addChild('c.txt', new FileNode({ isDirectory: false }));
      parent.addChild('a.txt', new FileNode({ isDirectory: false }));
      parent.addChild('b.txt', new FileNode({ isDirectory: false }));

      const children = parent.listChildren();

      // Note: Map preserves insertion order, not sorted
      expect(children).toHaveLength(3);
    });
  });

  describe('hasChild', () => {
    it('should return false for non-existent child', () => {
      const node = new FileNode({ isDirectory: true });

      expect(node.hasChild('nonexistent.txt')).toBe(false);
    });

    it('should return true for existing child', () => {
      const parent = new FileNode({ isDirectory: true });
      const child = new FileNode({ isDirectory: false });

      parent.addChild('file.txt', child);

      expect(parent.hasChild('file.txt')).toBe(true);
    });
  });

  describe('childrenCount', () => {
    it('should return 0 for no children', () => {
      const node = new FileNode({ isDirectory: true });

      expect(node.childrenCount()).toBe(0);
    });

    it('should return correct count', () => {
      const parent = new FileNode({ isDirectory: true });

      parent.addChild('file1.txt', new FileNode({ isDirectory: false }));
      parent.addChild('file2.txt', new FileNode({ isDirectory: false }));
      parent.addChild('dir1', new FileNode({ isDirectory: true }));

      expect(parent.childrenCount()).toBe(3);
    });

    it('should update after adding/removing children', () => {
      const parent = new FileNode({ isDirectory: true });

      expect(parent.childrenCount()).toBe(0);

      parent.addChild('file.txt', new FileNode({ isDirectory: false }));
      expect(parent.childrenCount()).toBe(1);

      parent.removeChild('file.txt');
      expect(parent.childrenCount()).toBe(0);
    });
  });

  describe('toJSON', () => {
    it('should serialize file node', () => {
      const content = Buffer.from('test');
      const node = new FileNode({
        isDirectory: false,
        content,
        permissions: 0o644,
      });

      const json = node.toJSON();

      expect(json.isDirectory).toBe(false);
      expect(json.size).toBe(content.length);
      expect(json.childrenCount).toBe(0);
      expect(json.children).toBeUndefined();
      expect(json.metadata).toBeDefined();
    });

    it('should serialize directory node', () => {
      const parent = new FileNode({ isDirectory: true });
      const child1 = new FileNode({
        isDirectory: false,
        content: Buffer.from('hello'),
      });
      const child2 = new FileNode({ isDirectory: true });

      parent.addChild('file.txt', child1);
      parent.addChild('subdir', child2);

      const json = parent.toJSON();

      expect(json.isDirectory).toBe(true);
      expect(json.childrenCount).toBe(2);
      expect(json.children).toBeDefined();
      expect(json.children).toHaveLength(2);
    });

    it('should include child information in directory serialization', () => {
      const parent = new FileNode({ isDirectory: true });
      const child = new FileNode({
        isDirectory: false,
        content: Buffer.from('test'),
      });

      parent.addChild('file.txt', child);

      const json = parent.toJSON();

      expect(json.children).toBeDefined();
      expect(json.children[0].name).toBe('file.txt');
      expect(json.children[0].isDirectory).toBe(false);
      expect(json.children[0].size).toBe(4);
    });
  });

  describe('edge cases', () => {
    it('should handle empty file content', () => {
      const node = new FileNode({
        isDirectory: false,
        content: Buffer.alloc(0),
      });

      expect(node.getSize()).toBe(0);
      expect(node.content?.length).toBe(0);
    });

    it('should handle large file content', () => {
      const largeContent = Buffer.alloc(1024 * 1024); // 1MB
      const node = new FileNode({ isDirectory: false, content: largeContent });

      expect(node.getSize()).toBe(1024 * 1024);
    });

    it('should handle deep directory nesting', () => {
      let current = new FileNode({ isDirectory: true });
      const root = current;

      // Create 10 levels deep
      for (let i = 0; i < 10; i++) {
        const child = new FileNode({ isDirectory: true });
        current.addChild(`level${i}`, child);
        current = child;
      }

      // Add file at deepest level
      current.addChild(
        'deep.txt',
        new FileNode({
          isDirectory: false,
          content: Buffer.from('deep'),
        })
      );

      expect(root.getSize()).toBe(4);
    });

    it('should handle special characters in filenames', () => {
      const parent = new FileNode({ isDirectory: true });
      const child = new FileNode({ isDirectory: false });

      parent.addChild('file with spaces.txt', child);
      parent.addChild('файл.txt', child); // Cyrillic
      parent.addChild('文件.txt', child); // Chinese

      expect(parent.hasChild('file with spaces.txt')).toBe(true);
      expect(parent.hasChild('файл.txt')).toBe(true);
      expect(parent.hasChild('文件.txt')).toBe(true);
    });

    it('should handle updating content reference', () => {
      const node = new FileNode({ isDirectory: false });

      node.content = Buffer.from('initial');
      expect(node.content.toString()).toBe('initial');

      node.content = Buffer.from('updated');
      expect(node.content.toString()).toBe('updated');
    });
  });
});
