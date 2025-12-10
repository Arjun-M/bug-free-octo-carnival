import { IsoBox } from '../../src/core/IsoBox';

describe('Timeout Enforcement Integration', () => {
  let isobox: IsoBox;

  beforeEach(() => {
    isobox = new IsoBox({
      timeout: 1000,
      cpuTimeLimit: 1000,
      strictTimeout: true
    });
  });

  afterEach(async () => {
    await isobox.dispose();
  });

  it('should terminate infinite loop', async () => {
    // A tight loop that never yields
    const code = `while(true) {}`;

    // Should throw with timeout error
    // Note: in a real environment, this might consume CPU and trigger CPU limit or Wall clock limit
    // CPU limit is more likely to trigger first for tight loops if supported
    await expect(isobox.run(code, { timeout: 200 })).rejects.toThrow();
  });

  it('should terminate async infinite loop', async () => {
    // An async loop that keeps the event loop busy
    // In isolated-vm, promises might not be interrupted easily by wall clock if not polling
    // But our ExecutionEngine uses Promise.race for wall clock timeout.

    const code = `
      async function loop() {
        while(true) {
          await new Promise(r => setTimeout(r, 10));
        }
      }
      loop();
    `;

    await expect(isobox.run(code, { timeout: 200 })).rejects.toThrow();
  });

  it('should enforce CPU limit', async () => {
     // Heavy computation
     const code = `
       let i = 0;
       while(true) { i++; }
     `;

     const strictBox = new IsoBox({ cpuTimeLimit: 50 });
     await expect(strictBox.run(code, { timeout: 5000 })).rejects.toThrow();
     await strictBox.dispose();
  }, 10000);
});
