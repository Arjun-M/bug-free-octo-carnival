import { FileNode } from '../../src/filesystem/FileNode';

describe('FileNode', () => {
  it('should store content', () => {
    const node = new FileNode({
        isDirectory: false,
        content: Buffer.from('content')
    });
    expect(node.content?.toString()).toBe('content');
  });

  it('should track metadata', () => {
    const node = new FileNode({
        isDirectory: false,
        content: Buffer.from('content')
    });
    expect(node.metadata.size).toBe(7);
  });

  it('should handle directories', () => {
      const node = new FileNode({ isDirectory: true });
      expect(node.isDirectory).toBe(true);

      const child = new FileNode({ isDirectory: false });
      node.addChild('file', child);
      expect(node.getChild('file')).toBe(child);
  });
});
