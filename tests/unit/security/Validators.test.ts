import { Validators } from '../../../src/security/Validators';

describe('Validators', () => {
  describe('validateCode', () => {
    it('should validate simple valid code', () => {
      const code = 'const a = 1;';
      const result = Validators.validateCode(code);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject empty code', () => {
      const result = Validators.validateCode('');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Code cannot be empty');
    });

    it('should reject code with syntax errors', () => {
      const code = 'if (true {';
      const result = Validators.validateCode(code);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Syntax error');
    });

    it('should warn on suspicious patterns', () => {
      const patterns = [
        { code: 'process.exit()', error: 'Direct process access detected' },
        { code: 'require("child_process")', error: 'Attempted child process execution' },
      ];

      for (const { code, error } of patterns) {
        const result = Validators.validateCode(code);
        expect(result.errors).toContain(error);
      }
    });
  });

  describe('validateModuleName', () => {
    it('should validate valid module names', () => {
      expect(Validators.validateModuleName('lodash')).toBe(true);
      expect(Validators.validateModuleName('@scope/pkg')).toBe(true);
      expect(Validators.validateModuleName('./local')).toBe(true);
    });

    it('should reject invalid module names', () => {
      // Logic is: if (name.includes('..') || name.startsWith('/')) return false
      expect(Validators.validateModuleName('/absolute')).toBe(false);
      expect(Validators.validateModuleName('../parent')).toBe(false);
      expect(Validators.validateModuleName('..')).toBe(false);
    });
  });

  describe('validatePath', () => {
    it('should validate absolute paths', () => {
      expect(Validators.validatePath('/tmp/file')).toBe(true);
    });

    it('should reject relative paths or traversal', () => {
      expect(Validators.validatePath('file.txt')).toBe(false);
      expect(Validators.validatePath('/tmp/../etc/passwd')).toBe(false);
    });
  });

  describe('validateOptions', () => {
    it('should validate valid options', () => {
      const options = {
        timeout: 1000,
        memoryLimit: 128 * 1024 * 1024,
        cpuLimit: 1000
      };
      expect(() => Validators.validateOptions(options)).not.toThrow();
    });

    it('should throw on invalid timeout', () => {
      expect(() => Validators.validateOptions({ timeout: -1 })).toThrow('Invalid timeout value');
      expect(() => Validators.validateOptions({ timeout: 1000000 })).toThrow('Timeout exceeds maximum');
    });

    it('should throw on invalid memory limit', () => {
      expect(() => Validators.validateOptions({ memoryLimit: -1 })).toThrow('Invalid memory limit');
    });
  });

  describe('checkSuspiciousCode', () => {
    it('should detect suspicious code', () => {
      const code = 'eval("1+1")';
      const reasons = Validators.checkSuspiciousCode(code);
      expect(reasons).toContain('Direct eval usage detected');
    });

    it('should detect excessive long lines', () => {
      const longLine = 'a'.repeat(600);
      const code = Array(15).fill(longLine).join('\n');
      const reasons = Validators.checkSuspiciousCode(code);
      expect(reasons).toContain('Contains many very long lines (possible obfuscation)');
    });
  });
});
