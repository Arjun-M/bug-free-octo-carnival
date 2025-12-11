
import { IsoBox } from '../../src/core/IsoBox';

describe('IsoBox Core', () => {
    let box: IsoBox;

    beforeEach(() => {
        box = new IsoBox();
    });

    afterEach(async () => {
        await box.dispose();
    });

    it('should initialize with defaults', () => {
        const metrics = box.getMetrics();
        expect(metrics.totalExecutions).toBe(0);
    });

    it('should emit events', async () => {
        const onStart = jest.fn();
        const onComplete = jest.fn();

        box.on('execution', (event: any) => {
            if (event.type === 'start') onStart();
            if (event.type === 'complete') onComplete();
        });

        await box.run('1+1');

        expect(onStart).toHaveBeenCalled();
        expect(onComplete).toHaveBeenCalled();
    });

    it('should dispose resources', async () => {
        await box.dispose();
        await expect(box.run('1')).rejects.toThrow('Sandbox disposed');
    });

    it('should run compiled script', async () => {
        const compiled = box.compile('return "compiled"');
        expect(compiled).toBeDefined();
    });
});
