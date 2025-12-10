import { IsoBox } from '../../src/core/IsoBox';

describe('Memory Limits Integration', () => {
  let isobox: IsoBox;

  beforeEach(() => {
    isobox = new IsoBox({
      memoryLimit: 12 * 1024 * 1024, // 12MB (min is usually 8-10MB in ivm)
    });
  });

  afterEach(async () => {
    await isobox.dispose();
  });

  it('should enforce memory limit on large allocation', async () => {
    // Allocate ArrayBuffer to force heap usage
    // 32MB allocation
    const code = `
      const buffer = new ArrayBuffer(32 * 1024 * 1024);
      buffer.byteLength;
    `;

    // Should fail with OOM or similar crash
    // We expect "Isolate was disposed during execution due to memory limit"
    // or just "Isolate is disposed"
    await expect(isobox.run(code)).rejects.toThrow();
  });
});
