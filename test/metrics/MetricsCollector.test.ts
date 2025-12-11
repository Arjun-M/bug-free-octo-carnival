
import { MetricsCollector, ExecutionMetrics } from '../../src/metrics/MetricsCollector';

describe('MetricsCollector', () => {
    let collector: MetricsCollector;

    beforeEach(() => {
        collector = new MetricsCollector();
    });

    it('should collect metrics', () => {
        const metric: ExecutionMetrics = {
            duration: 100,
            cpuTime: 50,
            memory: { heap: 1000, rss: 2000, external: 0 },
            success: true,
            timestamp: Date.now()
        };

        collector.recordExecution(metric);

        const metrics = collector.getMetrics();
        expect(metrics.totalExecutions).toBe(1);
        expect(metrics.avgExecutionTime).toBe(100);
        expect(metrics.totalCpuTime).toBe(50);
        expect(metrics.successfulExecutions).toBe(1);
    });

    it('should aggregate metrics', () => {
        const m1: ExecutionMetrics = {
            duration: 100,
            cpuTime: 50,
            memory: { heap: 1000, rss: 1000, external: 0 },
            success: true,
            timestamp: 1
        };
        const m2: ExecutionMetrics = {
            duration: 200,
            cpuTime: 150,
            memory: { heap: 2000, rss: 2000, external: 0 },
            success: false,
            error: new Error('fail'),
            timestamp: 2
        };

        collector.recordExecution(m1);
        collector.recordExecution(m2);

        const metrics = collector.getMetrics();
        expect(metrics.totalExecutions).toBe(2);
        expect(metrics.avgExecutionTime).toBe(150);
        expect(metrics.totalCpuTime).toBe(200);
        expect(metrics.peakMemory).toBe(2000);
        expect(metrics.failedExecutions).toBe(1);
        expect(metrics.errorRate).toBe(0.5);
    });
});
