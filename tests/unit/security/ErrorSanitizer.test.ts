import { ErrorSanitizer } from '../../../src/security/ErrorSanitizer';
import { SandboxError } from '../../../src/core/types';

describe('ErrorSanitizer', () => {
  let sanitizer: ErrorSanitizer;

  beforeEach(() => {
    sanitizer = new ErrorSanitizer();
  });

  describe('sanitize', () => {
    it('should sanitize regular Error', () => {
      const error = new Error('Something went wrong');
      const sanitized = sanitizer.sanitize(error);

      expect(sanitized.message).toBe('Something went wrong');
      expect(sanitized.code).toBe('RUNTIME_ERROR');
      expect(sanitized.stack).toBeDefined();
    });

    it('should sanitize unknown error types', () => {
      const sanitized = sanitizer.sanitize('string error');
      expect(sanitized.message).toBe('string error');
      expect(sanitized.code).toBe('UNKNOWN_ERROR');
    });

    it('should add hints for common errors', () => {
      const error = new ReferenceError('foo is not defined');
      const sanitized = sanitizer.sanitize(error);

      expect(sanitized.message).toContain('foo is not defined');
      expect(sanitized.message).toContain('Variable or function is not defined');
      expect(sanitized.code).toBe('REFERENCE_ERROR');
    });

    it('should sanitize stack traces', () => {
      const error = new Error('Test');
      error.stack = `Error: Test
    at Object.<anonymous> (/home/user/project/test.js:10:5)
    at Module._compile (node:internal/modules/cjs/loader:1103:14)
    at file:///app/src/index.ts:20:10`;

      const sanitized = sanitizer.sanitize(error);
      const stack = sanitized.stack || '';

      // The sanitizer replaces /home/... with [sandbox]
      expect(stack).not.toContain('/home/user/project/test.js');
      expect(stack).not.toContain('file:///app/src/index.ts');
      expect(stack).not.toContain('node:internal');

      // Check expected replacements
      expect(stack).toContain('[sandbox:10:5]'); // From /home/user/project/test.js:10:5
      expect(stack).toContain('[sandbox]'); // From file:///app/src/index.ts:20:10
    });

    it('should extract code context if code provided', () => {
        const code = `const a = 1;
const b = 2;
throw new Error("Boom");
const c = 3;`;

        const error = new Error('Boom');
        // Mock stack to point to line 3
        error.stack = 'Error: Boom\n    at [sandbox:3:7]';

        const sanitized = sanitizer.sanitize(error, code);

        expect(sanitized.line).toBe(3);
        expect(sanitized.codeContext).toBeDefined();
        expect(sanitized.codeContext).toContain('> 3: throw new Error("Boom");');
        expect(sanitized.codeContext).toContain('  2: const b = 2;');
        expect(sanitized.codeContext).toContain('  4: const c = 3;');
    });
  });

  describe('createSafeError', () => {
    it('should create a safe SandboxError', () => {
      const original = new Error('Sensitive info');
      const safe = ErrorSanitizer.createSafeError('Safe message', original);

      expect(safe).toBeInstanceOf(SandboxError);
      expect(safe.message).toBe('Safe message');
      expect(safe.stack).toContain('Safe message');
      // The original error stack might not be fully exposed depending on implementation detail but name should be
      expect(safe.stack).toContain('Error');
    });
  });

  describe('isSensitive', () => {
    it('should detect sensitive information', () => {
      expect(ErrorSanitizer.isSensitive('/home/user/file.txt')).toBe(true);
      expect(ErrorSanitizer.isSensitive('API_KEY=123')).toBe(true);
      expect(ErrorSanitizer.isSensitive('Error in node_modules/pkg')).toBe(true);
    });

    it('should allow non-sensitive information', () => {
      expect(ErrorSanitizer.isSensitive('Syntax error on line 5')).toBe(false);
      expect(ErrorSanitizer.isSensitive('ReferenceError: a is not defined')).toBe(false);
    });
  });
});
