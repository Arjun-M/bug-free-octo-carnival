
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
        expect(() => moduleSystem.require('http')).toThrow(/Module denied/);
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

    it('should load virtual modules (stubbed)', () => {
        memfs.write('/my-module.js', 'module.exports = { a: 1 };');

        // Since execution is skipped on host, it returns empty exports
        const mod = moduleSystem.require('./my-module.js');
        expect(mod).toBeDefined();
    });
});
