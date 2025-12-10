import { IsoBox } from '../../src/core/IsoBox';

describe('File Operations Integration', () => {
  let isobox: IsoBox;

  beforeEach(() => {
    isobox = new IsoBox({
      filesystem: {
        root: '/',
        maxSize: 1024 * 1024 // 1MB
      }
    });
  });

  afterEach(async () => {
    await isobox.dispose();
  });

  it('should support basic file I/O', async () => {
    const code = `
      $fs.write('/test.txt', 'hello world');
      const content = $fs.read('/test.txt');
      content;
    `;
    const result = await isobox.run(code, { timeout: 10000 });
    expect(result).toBe('hello world');
  });

  it('should enforce quota limits', async () => {
    // 1MB limit. Try writing > 1MB.
    // 1024 * 1024 + 1 bytes
    const code = `
      const largeData = 'a'.repeat(1024 * 1024 + 1);
      $fs.write('/large.txt', largeData);
    `;

    await expect(isobox.run(code, { timeout: 10000 })).rejects.toThrow('Quota exceeded');
  }, 15000);

  it('should enforce permissions', async () => {
    // Create read-only file
    isobox.fs.write('/readonly.txt', 'secret');
    isobox.fs.chmod('/readonly.txt', 0o400); // Read only

    const readCode = `
      $fs.read('/readonly.txt');
    `;
    const result = await isobox.run(readCode, { timeout: 10000 });
    expect(result).toBe('secret');

    // Test no-read permission
    isobox.fs.chmod('/readonly.txt', 0o000);
    await expect(isobox.run(readCode, { timeout: 10000 })).rejects.toThrow('Permission denied');
  }, 15000);

  it('should support directory operations', async () => {
    const code = `
      $fs.mkdir('/data');
      $fs.write('/data/1.txt', '1');
      $fs.write('/data/2.txt', '2');
      $fs.readdir('/data');
    `;

    const result = await isobox.run(code, { timeout: 10000 });
    expect(result).toEqual(expect.arrayContaining(['1.txt', '2.txt']));
  });
});
