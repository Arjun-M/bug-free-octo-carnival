import { CompiledScript } from '../../../src/core/CompiledScript';

// Mock isolated-vm types
const mockRun = jest.fn();
const mockCompileScriptSync = jest.fn();
const mockContext = {
  compileScriptSync: mockCompileScriptSync,
  run: jest.fn()
};

describe('CompiledScript', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCompileScriptSync.mockReturnValue({
      run: mockRun
    });
  });

  describe('Constructor', () => {
    it('should initialize with valid parameters', () => {
      const code = 'const a = 1;';
      const script = new CompiledScript(code, code);
      expect(script.getSource()).toBe(code);
      expect(script.getCompiled()).toBe(code);
      expect(script.getLanguage()).toBe('javascript');
    });

    it('should accept custom language', () => {
      const code = 'const a: number = 1;';
      const compiled = 'var a = 1;';
      const script = new CompiledScript(code, compiled, 'typescript');
      expect(script.getLanguage()).toBe('typescript');
    });
  });

  describe('Metadata', () => {
    it('should return correct metadata', () => {
      const code = 'const a = 1;';
      const script = new CompiledScript(code, code);
      const metadata = script.getMetadata();

      expect(metadata).toMatchObject({
        code,
        compiled: code,
        language: 'javascript'
      });
      expect(metadata.compiledAt).toBeLessThanOrEqual(Date.now());
    });
  });

  describe('Execution Context', () => {
    it('should set and get execution context', () => {
      const script = new CompiledScript('code', 'code');
      const context: any = {};
      script.setContext(context);
      expect(script.getContext()).toBe(context);
    });
  });

  describe('Execution', () => {
    it('should execute compiled script in context', async () => {
      const code = '1 + 1';
      const script = new CompiledScript(code, code);
      mockRun.mockResolvedValue(2);

      const result = await script.run(mockContext as any);

      expect(mockCompileScriptSync).toHaveBeenCalledWith(code);
      expect(mockRun).toHaveBeenCalled();
      expect(result).toBe(2);
    });

    it('should handle execution errors', async () => {
      const script = new CompiledScript('error', 'error');
      mockRun.mockRejectedValue(new Error('Execution failed'));

      await expect(script.run(mockContext as any))
        .rejects.toThrow('Failed to run compiled script: Execution failed');
    });

    it('should pass timeout options', async () => {
      const script = new CompiledScript('code', 'code');
      mockRun.mockResolvedValue(undefined);

      await script.run(mockContext as any, 1000);

      expect(mockRun).toHaveBeenCalledWith(mockContext, expect.objectContaining({
        timeout: 1000
      }));
    });
  });

  describe('Disposal', () => {
    it('should clear context on dispose', () => {
      const script = new CompiledScript('code', 'code');
      script.setContext({} as any);
      script.dispose();
      expect(script.getContext()).toBeUndefined();
    });

    it('should check validity', () => {
      const script = new CompiledScript('code', 'code');
      expect(script.isValid()).toBe(true);
    });
  });
});
