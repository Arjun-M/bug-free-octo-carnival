import { IsoBox } from '../../src/core/IsoBox';

describe('Module Loading Integration', () => {
  let isobox: IsoBox;

  beforeEach(() => {
    isobox = new IsoBox({
      filesystem: { root: '/' },
      require: {
        external: false, // We use virtual modules
        whitelist: [], // No external allowed
        allowBuiltins: false,
        memfs: undefined // Will be set by IsoBox
      }
    });
  });

  afterEach(async () => {
    await isobox.dispose();
  });

  it('should load virtual modules', async () => {
    isobox.fs.write('/src/utils.js', 'module.exports = { add: (a, b) => a + b };');
    isobox.fs.write('/src/main.js', `
      const utils = require('./utils');
      module.exports = utils.add(1, 2);
    `);

    // We need to pass the file content in project options for runProject to work as designed
    // because it might look up files in the array.

    const result = await isobox.run(`
      const utils = require('/src/utils.js');
      utils.add(3, 4);
    `, { filename: '/src/main.js' });

    expect(result).toBe(7);
  });

  it('should handle circular dependencies gracefully', async () => {
    isobox.fs.write('/a.js', `
      const b = require('./b.js');
      module.exports = { name: 'a', bName: b.name };
    `);
    isobox.fs.write('/b.js', `
      const a = require('./a.js'); // Circular
      // a is partial here
      module.exports = { name: 'b', aPartial: a };
    `);

    // With Node.js style loading (shim), circular dependencies should be supported.
    // 'b' gets an incomplete 'a'.
    const result = await isobox.run(`
        const a = require('/a.js');
        // Return a primitive to avoid transfer issues with circular objects
        a.name + ':' + a.bName;
    `);

    expect(result).toBe('a:b');
  });

  it('should restrict unauthorized modules', async () => {
    await expect(isobox.run("require('fs')")).rejects.toThrow(/Module not whitelisted/);
  });
});
