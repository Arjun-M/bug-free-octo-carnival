
import { ContextBuilder } from '../../src/context/ContextBuilder';
import { MemFS } from '../../src/filesystem/MemFS';

describe('ContextBuilder', () => {
    let memfs: MemFS;

    beforeEach(() => {
        memfs = new MemFS();
    });

    it('should build context with defaults', async () => {
        const builder = new ContextBuilder({ memfs });
        const context = await builder.build('test-id');

        expect(context.isolateId).toBe('test-id');
        expect(context._globals.$fs).toBeDefined();
        expect(context._globals.$env).toBeDefined();
        expect(context._globals.console).toBeDefined();
    });

    it('should inject custom globals', async () => {
        const builder = new ContextBuilder({
            memfs,
            sandbox: { foo: 'bar' }
        });
        const context = await builder.build('test-id');
        expect(context._globals.foo).toBe('bar');
    });

    it('should support console redirection', async () => {
        const onOutput = jest.fn();
        const builder = new ContextBuilder({
            memfs,
            console: { mode: 'redirect', onOutput }
        });
        const context = await builder.build('test-id');
        const consoleObj = context._globals.console;

        consoleObj.log('hello');
        expect(onOutput).toHaveBeenCalledWith('log', ['hello']);
    });
});
