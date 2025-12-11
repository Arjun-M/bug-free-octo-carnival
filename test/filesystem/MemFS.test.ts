
import { MemFS } from '../../src/filesystem/MemFS';

describe('MemFS', () => {
    let fs: MemFS;

    beforeEach(() => {
        fs = new MemFS({ maxSize: 1024 * 1024 });
    });

    it('should write and read files', () => {
        fs.write('/test.txt', 'hello world');
        expect(fs.read('/test.txt').toString()).toBe('hello world');
    });

    it('should create directories recursively', () => {
        fs.mkdir('/a/b/c', true);
        expect(fs.exists('/a/b/c')).toBe(true);
    });

    it('should list directory contents', () => {
        fs.mkdir('/dir', false);
        fs.write('/dir/file1.txt', '1');
        fs.write('/dir/file2.txt', '2');
        expect(fs.readdir('/dir')).toEqual(expect.arrayContaining(['file1.txt', 'file2.txt']));
    });

    it('should delete files', () => {
        fs.write('/del.txt', 'bye');
        fs.delete('/del.txt');
        expect(fs.exists('/del.txt')).toBe(false);
    });

    it('should enforce quota', () => {
        const smallFs = new MemFS({ maxSize: 10 });
        expect(() => smallFs.write('/big.txt', '12345678901')).toThrow(/Quota exceeded/);
    });

    it('should normalize relative paths', () => {
        fs.write('relative.txt', 'content');
        expect(fs.exists('/relative.txt')).toBe(true);
    });
});
