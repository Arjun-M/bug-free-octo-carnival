import { ExecutionEngine } from '../../../src/execution/ExecutionEngine';
import { TimeoutError } from '../../../src/core/types';

describe('ExecutionEngine', () => {
  let executionEngine: ExecutionEngine;
  let mockIsolate: any;
  let mockContext: any;
  let mockScript: any;

  beforeEach(() => {
    executionEngine = new ExecutionEngine();

    mockScript = {
      run: jest.fn().mockImplementation(() => {
        return new Promise((resolve) => {
           // Resolve immediately unless delayed
           resolve('result');
        });
      })
    };

    mockContext = {
      isolate: {}, // Circular reference needed
      compileScriptSync: jest.fn(),
    };
    mockContext.isolate = mockIsolate; // Circular reference needed

    mockIsolate = {
      compileScript: jest.fn().mockResolvedValue(mockScript),
      createContextSync: jest.fn().mockReturnValue(mockContext),
      dispose: jest.fn()
    };
  });

  afterEach(() => {
    executionEngine.dispose();
  });

  describe('Constructor', () => {
    it('should initialize with default components', () => {
      expect(executionEngine.getTimeoutManager()).toBeDefined();
      expect(executionEngine.getResourceMonitor()).toBeDefined();
      expect(executionEngine.getErrorSanitizer()).toBeDefined();
    });
  });

  describe('Execute', () => {
    const options = {
      timeout: 1000,
      cpuTimeLimit: 1000,
      memoryLimit: 128,
      strictTimeout: true
    };

    it('should execute code successfully', async () => {
      const code = 'const a = 1;';
      const result = await executionEngine.execute(code, mockIsolate, mockContext, options);

      expect(result.value).toBe('result');
      expect(result.duration).toBeGreaterThanOrEqual(0);
      expect(mockIsolate.compileScript).toHaveBeenCalledWith(code, expect.any(Object));
      expect(mockScript.run).toHaveBeenCalled();
    });

    it('should handle execution error', async () => {
      mockIsolate.compileScript.mockRejectedValue(new Error('Compilation failed'));

      const result = await executionEngine.execute('bad code', mockIsolate, mockContext, options);

      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('Compilation failed');
    });

    it('should emit lifecycle events', async () => {
      const startSpy = jest.fn();
      const completeSpy = jest.fn();

      executionEngine.on('execution:start', startSpy);
      executionEngine.on('execution:complete', completeSpy);

      await executionEngine.execute('code', mockIsolate, mockContext, options);

      expect(startSpy).toHaveBeenCalled();
      expect(completeSpy).toHaveBeenCalled();
    });

    it('should handle timeout error', async () => {
        // Mock run to be slow
        mockScript.run.mockImplementation(() => {
            return new Promise((resolve) => setTimeout(resolve, 1000));
        });

        jest.useFakeTimers();

        const timeoutPromise = executionEngine.execute('long running', mockIsolate, mockContext, { ...options, timeout: 10 });

        // Use advanceTimersByTimeAsync to ensure promises resolve
        await jest.advanceTimersByTimeAsync(20);

        const result = await timeoutPromise;
        expect(result.error).toBeDefined();
        expect(result.error?.message).toContain('Execution timeout exceeded');

        jest.useRealTimers();
    });
  });

  describe('Context Setup', () => {
    it('should create execution context', () => {
      const context = executionEngine.setupExecutionContext(mockIsolate, {} as any);
      expect(context).toBeDefined();
      expect(mockIsolate.createContextSync).toHaveBeenCalled();
    });

    it('should handle context creation failure', () => {
      mockIsolate.createContextSync.mockImplementation(() => {
        throw new Error('Context creation failed');
      });

      // Since it rethrows the same error object
      expect(() => executionEngine.setupExecutionContext(mockIsolate, {} as any))
        .toThrow('Context creation failed');
    });
  });

  describe('Disposal', () => {
    it('should dispose resources', () => {
      // Mock methods to verify calls
      const tmClear = jest.spyOn(executionEngine.getTimeoutManager(), 'clearAll');
      const rmStop = jest.spyOn(executionEngine.getResourceMonitor(), 'stopAll');

      executionEngine.dispose();

      expect(tmClear).toHaveBeenCalled();
      expect(rmStop).toHaveBeenCalled();
    });
  });
});
