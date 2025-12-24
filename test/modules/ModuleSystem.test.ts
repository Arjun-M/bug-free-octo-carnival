
import { ModuleSystem } from '../../src/modules/ModuleSystem';
import { MemFS } from '../../src/filesystem/MemFS';

describe('ModuleSystem', () => {
    let memfs: MemFS;
    let moduleSystem: ModuleSystem;

    beforeEach(() => {
        memfs = new MemFS();
        moduleSystem = new ModuleSystem({
            mode: 'whitelist',
            whitelist: ['fs'], // Fake whitelist
            memfs,
            allowBuiltins: true
        });
    });

    it('should require allowed modules', () => {
        const path = moduleSystem.require('path');
        expect(path.join('a', 'b')).toBe('a/b');
    });

    it('should throw on non-allowed modules', () => {
        // We need to ensure resolution works or mock it, because ModuleSystem resolves before checking whitelist.
        // Or we can assert that it throws MODULE_NOT_FOUND which is also acceptable if it doesn't exist.
        // But the original test expected 'Module denied'.
        // To get 'Module denied', it must pass resolution.
        // If 'http' is not in built-ins and not in memfs, it fails resolution.
        // We can add it to mocks to bypass resolution? No, mocks are checked first.
        // If we want to test whitelist rejection, we should use a module that resolves but is not whitelisted.

        // Mock a file that exists but is not whitelisted
        memfs.write('/node_modules/forbidden/index.js', '');
        expect(() => moduleSystem.require('forbidden')).toThrow(/Module denied/);
    });

    it('should support mocked modules', () => {
        const ms = new ModuleSystem({
            mode: 'whitelist',
            memfs,
            mocks: { 'my-lib': { foo: 'bar' } }
        });
        const lib = ms.require('my-lib');
        expect(lib.foo).toBe('bar');
    });

    it('should load virtual modules with executor', () => {
        memfs.write('/my-module.js', 'module.exports = { a: 1 };');

        const executor = (code: string) => {
            return { a: 1 };
        };

        const mod = moduleSystem.require('./my-module.js', '/', executor);
        expect(mod).toEqual({ a: 1 });
    });
});
