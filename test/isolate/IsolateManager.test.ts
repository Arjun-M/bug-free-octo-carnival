
import { IsolateManager } from '../../src/isolate/IsolateManager';
import ivm from 'isolated-vm';

describe('IsolateManager', () => {
    let manager: IsolateManager;

    beforeEach(() => {
        manager = new IsolateManager();
    });

    afterEach(async () => {
        await manager.disposeAll();
    });

    it('should create and track isolates', () => {
        const isolate = manager.create({ memoryLimit: 128 });
        const stats = manager.getStats();
        expect(stats.active).toBe(1);
        expect(isolate).toBeInstanceOf(ivm.Isolate);
    });

    it('should dispose specific isolate', () => {
        const isolate = manager.create();
        const map = (manager as any).isolates as Map<string, any>;
        const id = map.keys().next().value;

        manager.dispose(id);
        expect(manager.getStats().active).toBe(0);
        expect(isolate.isDisposed).toBe(true);
    });
});
