import { Validators } from '../../src/security/Validators';

describe('Validators', () => {
  it('should validate filenames', () => {
    // The previous test called `isValidFilename` which doesn't exist.
    // We should use `validatePath` or check if `validateModuleName` is more appropriate.
    // For file system path validation (like inputs), `validatePath` seems relevant.
    // But `validatePath` expects absolute path starting with `/`.
    // The failing test was `isValidFilename('test.js')` which implies simple name check.

    // Let's use `validatePath` for paths
    expect(Validators.validatePath('/test.js')).toBe(true);
    expect(Validators.validatePath('../test.js')).toBe(false);
  });

  it('should validate module names', () => {
      expect(Validators.validateModuleName('fs')).toBe(true);
      expect(Validators.validateModuleName('/fs')).toBe(false);
  });
});
