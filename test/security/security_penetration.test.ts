
import { IsoBox } from '../../src/core/IsoBox';

describe('Security Penetration Tests', () => {
  let isobox: IsoBox;

  beforeEach(() => {
    isobox = new IsoBox({
        memoryLimit: 128 * 1024 * 1024,
        cpuTimeLimit: 1000
    });
  });

  afterEach(async () => {
    await isobox.dispose();
  });

  describe('VM2 Escapes', () => {
    // Attempt to access process.env
    it('should block access to process.env', async () => {
      const code = `
        try {
            process.env.NODE_ENV;
            'accessed';
        } catch (e) {
            'blocked';
            throw e;
        }
      `;
      // We expect it to throw ReferenceError (process not defined)
      try {
          await isobox.run(code);
          fail('Should have thrown ReferenceError');
      } catch (e) {
           expect((e as Error).message).toMatch(/process is not defined/);
      }
    });

    // Attempt to access fs via require
    it('should block access to fs module', async () => {
        const code = `
          try {
              const fs = require('fs');
              'accessed';
          } catch (e) {
              'blocked';
              throw e;
          }
        `;
        // require is not available unless configured
        try {
            await isobox.run(code);
            fail('Should have thrown ReferenceError');
        } catch (e) {
             expect((e as Error).message).toMatch(/require is not defined/);
        }
    });

    // Attempt constructor.constructor escape
    it('should block constructor.constructor escape', async () => {
        const code = `
            try {
                const ForeignFunction = (function(){}).constructor;
                ForeignFunction("return process")();
            } catch(e) {
                'blocked';
            }
        `;
        const result = await isobox.run(code);
        expect(result).toBe('blocked');
    });

    // Attempt infinite loop (DoS) - should timeout
    it('should timeout on infinite loop', async () => {
        const code = `while(true) {}`;
        await expect(isobox.run(code, { timeout: 100 })).rejects.toThrow();
    });
  });
});
