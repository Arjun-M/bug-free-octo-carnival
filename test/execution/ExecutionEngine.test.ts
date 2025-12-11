
import { ExecutionEngine } from '../../src/execution/ExecutionEngine';
import ivm from 'isolated-vm';

describe('ExecutionEngine', () => {
    let engine: ExecutionEngine;
    let isolate: ivm.Isolate;
    let context: ivm.Context;

    beforeEach(() => {
        engine = new ExecutionEngine();
        isolate = new ivm.Isolate({ memoryLimit: 128 });
        context = isolate.createContextSync();
    });

    afterEach(() => {
        engine.dispose();
        if (!isolate.isDisposed) {
            isolate.dispose();
        }
    });

    it('should execute code and return result', async () => {
        const result = await engine.execute('1 + 1', isolate, context, {
            timeout: 1000,
            cpuTimeLimit: 1000,
            memoryLimit: 128,
            strictTimeout: true
        });
        expect(result.value).toBe(2);
    });

    it('should handle runtime errors', async () => {
        const result = await engine.execute('throw new Error("oops")', isolate, context, {
            timeout: 1000,
            cpuTimeLimit: 1000,
            memoryLimit: 128,
            strictTimeout: true
        });
        expect(result.error).toBeDefined();
        expect(result.error!.message).toContain('oops');
    });

    it('should handle timeout', async () => {
        const result = await engine.execute('while(true) {}', isolate, context, {
            timeout: 100,
            cpuTimeLimit: 1000,
            memoryLimit: 128,
            strictTimeout: true
        });
        expect(result.error).toBeDefined();
        // Can be TIMEOUT_ERROR (from promise race) or execution error (from isolate disposal)
        // Sanitizer might map execution error to UNKNOWN or RUNTIME
        const isTimeout = result.error!.code === 'TIMEOUT_ERROR' ||
                          result.error!.message.includes('disposed') ||
                          result.error!.message.includes('timed out');
        expect(isTimeout).toBe(true);
    }, 5000);

    it('should monitor resources', async () => {
        const result = await engine.execute('1', isolate, context, {
            timeout: 1000,
            cpuTimeLimit: 1000,
            memoryLimit: 128,
            strictTimeout: true
        });
        expect(result.resourceStats).toBeDefined();
        expect(result.cpuTime).toBeGreaterThanOrEqual(0);
    });
});
