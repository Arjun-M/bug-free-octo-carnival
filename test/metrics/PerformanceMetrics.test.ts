import { PerformanceMetrics } from '../../src/metrics/PerformanceMetrics';

describe('PerformanceMetrics', () => {
  let metrics: PerformanceMetrics;

  beforeEach(() => {
    metrics = new PerformanceMetrics();
  });

  it('should start with empty metrics', () => {
    expect(metrics.getMetricNames().length).toBe(0);
  });

  it('should record execution time', () => {
    metrics.start();
    // simulate delay
    const start = Date.now();
    while (Date.now() - start < 10) {}

    // The previous test assumed `end('task1')` which records a metric.
    // The current class doesn't have `end`. It has `recordMetric`.
    const duration = metrics.getElapsedTime();
    metrics.recordMetric('task1', duration, 'ms');

    const stats = metrics.getMetricStats('task1');
    expect(stats?.avg).toBeGreaterThanOrEqual(10);
  });

  it('should reset metrics', () => {
    metrics.recordMetric('foo', 1, 'ms');
    metrics.reset();
    expect(metrics.getMetricNames().length).toBe(0);
  });
});
