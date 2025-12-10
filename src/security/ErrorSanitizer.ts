/**
 * @fileoverview Error sanitizer to prevent information leakage
 */

import { SandboxError } from '../core/types.js';

/**
 * Sanitized error for safe exposure to external consumers
 */
export interface SanitizedError {
  message: string;
  stack?: string;
  code: string;
  codeContext?: string;
  line?: number;
  column?: number;
}

/**
 * Sanitizes errors to prevent information leakage from host environment
 */
export class ErrorSanitizer {
  /**
   * Common error hints for development
   */
  private static readonly ERROR_HINTS: Record<string, string> = {
    ReferenceError: 'Variable or function is not defined in the sandbox context',
    TypeError:
      'Invalid operation on an incompatible type. Check the data types you are using',
    SyntaxError:
      'Code contains syntax errors. Check the code structure and formatting',
    RangeError:
      'A value is outside the acceptable range (e.g., array index too large)',
    EvalError: 'Invalid eval operation in the sandbox',
    URIError: 'Invalid URI operation',
  };

  /**
   * Sanitize an error and remove host information
   * @param error Error to sanitize
   * @param code Optional source code for context
   * @returns Sanitized error object
   */
  sanitize(error: unknown, code?: string): SanitizedError {
    if (!(error instanceof Error)) {
      return {
        message: String(error),
        code: 'UNKNOWN_ERROR',
      };
    }

    const errorName = error.name;
    let message = error.message;

    // Add helpful hint if available
    const hint = ErrorSanitizer.ERROR_HINTS[errorName];
    if (hint) {
      message = `${message || errorName}. ${hint}`;
    }

    const stack = error.stack || '';
    const sanitizedStack = this.sanitizeStack(stack);
    const codeContext = code ? this.getCodeContext(error, code) : undefined;
    const [line, column] = this.extractLocation(sanitizedStack);

    return {
      message,
      stack: sanitizedStack,
      code: this.getErrorCode(errorName),
      codeContext,
      line,
      column,
    };
  }

  /**
   * Sanitize stack trace by removing host paths and internals
   * @param stack Stack trace string
   * @returns Sanitized stack trace
   */
  private sanitizeStack(stack: string): string {
    let sanitized = stack;

    // 1. Remove Node.js internals first
    sanitized = sanitized.replace(/at .*node:internal\/.*\n/g, '');
    sanitized = sanitized.replace(/at .*\/node_modules\/.*\n/g, '');
    sanitized = sanitized.replace(/at .*Module._compile.*\n/g, '');
    sanitized = sanitized.replace(/at .*Object.Module._extensions.*\n/g, '');

    // 2. Aggressively strip absolute paths (Unix/Windows)
    sanitized = sanitized.replace(/\/[a-zA-Z0-9_\-\.\/]+/g, (match) => {
       if (match.includes('node_modules')) return '[node_modules]';
       return '[sandbox]';
    });
    // Windows paths
    sanitized = sanitized.replace(/[a-zA-Z]:\\[a-zA-Z0-9_\-\.\\]+/g, (match) => {
        if (match.includes('node_modules')) return '[node_modules]';
        return '[sandbox]';
    });

    // 3. Normalize location
    // at Object.<anonymous> ([sandbox]:592:21)
    sanitized = sanitized.replace(
        /at (.+) \((.+):(\d+):(\d+)\)/g,
        (match, fn, path, line, col) => {
           // If the path was sanitized to [sandbox], keep the line/col but format nicely
           if (path.includes('[sandbox]')) return `at ${fn} ([sandbox:${line}:${col}])`;
           return match;
        }
    );

    // 4. Remove stack lines that are just host noise (IsoBox internal calls)
    const lines = sanitized.split('\n');
    const filteredLines = lines.filter(line => {
        // Keep lines that look like user code or generic errors
        if (line.trim().startsWith('Error:')) return true;
        if (line.trim().startsWith('at ')) {
             // Filter out IsoBox internal methods if they appear
             if (line.includes('IsoBox.') || line.includes('ExecutionEngine.')) return false;
             return true;
        }
        return true;
    });

    return filteredLines.join('\n').trim();
  }

  /**
   * Get error code for categorization
   * @param errorName JavaScript error name
   * @returns Standardized error code
   */
  private getErrorCode(errorName: string): string {
    const codeMap: Record<string, string> = {
      TimeoutError: 'TIMEOUT_ERROR',
      ReferenceError: 'REFERENCE_ERROR',
      TypeError: 'TYPE_ERROR',
      SyntaxError: 'SYNTAX_ERROR',
      RangeError: 'RANGE_ERROR',
      EvalError: 'EVAL_ERROR',
      URIError: 'URI_ERROR',
      Error: 'RUNTIME_ERROR',
    };

    return codeMap[errorName] || 'UNKNOWN_ERROR';
  }

  /**
   * Extract line and column from sanitized stack
   * @param stack Sanitized stack trace
   * @returns [line, column] tuple or [undefined, undefined]
   */
  private extractLocation(stack: string): [number | undefined, number | undefined] {
    const match = stack.match(/\[sandbox:(\d+):(\d+)\]/);
    if (match) {
      return [parseInt(match[1], 10), parseInt(match[2], 10)];
    }
    return [undefined, undefined];
  }

  /**
   * Extract code context around an error line
   * @param error The error object
   * @param code Full source code
   * @returns Code snippet around error (3 lines)
   */
  private getCodeContext(error: Error, code: string): string | undefined {
    try {
      const lines = code.split('\n');
      const stack = error.stack || '';

      // Try to extract line number from various formats
      let lineNum: number | undefined;

      // Try [sandbox:line:col] format
      const match1 = stack.match(/\[sandbox:(\d+):/);
      if (match1) {
        lineNum = parseInt(match1[1], 10);
      }

      // Try at function (file.js:line:col) format
      const match2 = stack.match(/:(\d+):\d+\)/);
      if (!lineNum && match2) {
        lineNum = parseInt(match2[1], 10);
      }

      if (lineNum === undefined || lineNum < 1) {
        return undefined;
      }

      const start = Math.max(0, lineNum - 2);
      const end = Math.min(lines.length, lineNum + 1);
      const context = lines.slice(start, end).map((line, i) => {
        const currentLine = start + i + 1;
        const marker = currentLine === lineNum ? '> ' : '  ';
        return `${marker}${currentLine}: ${line}`;
      });

      return context.join('\n');
    } catch {
      return undefined;
    }
  }

  /**
   * Create a safe error from an original error
   * @param message Safe message to expose
   * @param originalError Original error for logging
   * @returns New Error with safe message
   */
  static createSafeError(message: string, originalError?: Error): SandboxError {
    const error = new SandboxError(message, 'SANDBOXED_ERROR');
    if (originalError) {
      error.stack = `${error.name}: ${message}\n  (Original: ${originalError.name})`;
    }
    return error;
  }

  /**
   * Check if error message contains sensitive information
   * @param message Error message to check
   * @returns True if message likely contains sensitive info
   */
  static isSensitive(message: string): boolean {
    const sensitivePatterns = [
      /\/Users\//,
      /\/home\//,
      /\/tmp\//,
      /C:\\Users\\/,
      /node_modules/,
      /\.env/,
      /secret|key|token|password/i,
    ];

    return sensitivePatterns.some((pattern) => pattern.test(message));
  }
}
