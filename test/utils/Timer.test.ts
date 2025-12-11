
import { Timer } from '../../src/utils/Timer';

describe('Timer', () => {
    it('should measure duration', async () => {
        const timer = new Timer();
        timer.start();
        await new Promise(resolve => setTimeout(resolve, 10));
        const duration = timer.stop();
        expect(duration).toBeGreaterThanOrEqual(9);
    });

    it('should return 0 if not started', () => {
        const timer = new Timer();
        expect(timer.stop()).toBe(0);
    });
});
