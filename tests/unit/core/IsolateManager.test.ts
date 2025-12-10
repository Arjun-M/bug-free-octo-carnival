import { IsolateManager } from '../../../src/core/IsolateManager';

describe('IsolateManager', () => {
  let isolateManager: IsolateManager;
  let mockDispose: jest.Mock;

  beforeEach(() => {
    isolateManager = new IsolateManager();
    mockDispose = jest.fn();

    // Mock global Isolate class
    (globalThis as any).Isolate = class MockIsolate {
      options: any;
      constructor(options: any) {
        this.options = options;
      }
      dispose = mockDispose;
    };
  });

  afterEach(() => {
    delete (globalThis as any).Isolate;
  });

  describe('createIsolate', () => {
    it('should create an isolate with default options', () => {
      const isolate = isolateManager.createIsolate();
      expect(isolate).toBeDefined();
    });

    it('should create an isolate with memory limit', () => {
      const memoryLimit = 128 * 1024 * 1024; // 128MB
      const isolate = isolateManager.createIsolate({ memoryLimit });
      expect((isolate as any).options.memoryLimit).toBe(128);
    });

    it('should enforce minimum memory limit', () => {
      const memoryLimit = 1 * 1024 * 1024; // 1MB
      const isolate = isolateManager.createIsolate({ memoryLimit });
      expect((isolate as any).options.memoryLimit).toBe(10); // Min 10MB
    });

    // Removed 'should throw error if Isolate is not available' as Isolate is imported directly
  });

  describe('Lifecycle Management', () => {
    it('should track and retrieve isolates', () => {
      const id = 'test-isolate';
      const isolate = isolateManager.createIsolate();

      isolateManager.trackIsolate(id, isolate);
      expect(isolateManager.getIsolate(id)).toBe(isolate);
    });

    it('should throw error when tracking duplicate id', () => {
      const id = 'test-isolate';
      const isolate = isolateManager.createIsolate();

      isolateManager.trackIsolate(id, isolate);
      expect(() => isolateManager.trackIsolate(id, isolate))
        .toThrow(`Isolate with id ${id} already tracked`);
    });

    it('should generate unique ids', () => {
      const id1 = isolateManager.generateId();
      const id2 = isolateManager.generateId();
      expect(id1).not.toBe(id2);
      expect(id1).toContain('isolate-');
    });

    it('should get stats', () => {
      const stats = isolateManager.getStats();
      expect(stats).toEqual({ active: 0, total: 0 });

      isolateManager.generateId();
      const isolate = isolateManager.createIsolate();
      isolateManager.trackIsolate('id', isolate);

      const newStats = isolateManager.getStats();
      expect(newStats).toEqual({ active: 1, total: 1 });
    });
  });

  describe('Disposal', () => {
    it('should dispose isolate and remove from tracking', async () => {
      const id = 'test-isolate';
      const isolate = isolateManager.createIsolate();
      isolateManager.trackIsolate(id, isolate);

      await isolateManager.disposeIsolate(id);

      expect(mockDispose).toHaveBeenCalled();
      expect(isolateManager.getIsolate(id)).toBeUndefined();
    });

    it('should handle disposal errors gracefully', async () => {
      const id = 'test-isolate';
      const isolate = isolateManager.createIsolate();
      mockDispose.mockRejectedValue(new Error('Dispose failed'));
      isolateManager.trackIsolate(id, isolate);

      await isolateManager.disposeIsolate(id);

      // Should not throw and should still remove from tracking
      expect(isolateManager.getIsolate(id)).toBeUndefined();
    });

    it('should dispose all tracked isolates', async () => {
      const isolate1 = isolateManager.createIsolate();
      const isolate2 = isolateManager.createIsolate();

      isolateManager.trackIsolate('id1', isolate1);
      isolateManager.trackIsolate('id2', isolate2);

      await isolateManager.disposeAll();

      expect(mockDispose).toHaveBeenCalledTimes(2);
      expect(isolateManager.getStats().active).toBe(0);
    });
  });
});
