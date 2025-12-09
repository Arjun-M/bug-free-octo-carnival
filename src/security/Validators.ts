/**
 * @fileoverview Input validation and sanitization
 */

import { logger } from '../utils/Logger.js';

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validates user input and code
 */
export class Validators {
  /**
   * Validate JavaScript/TypeScript code
   * @param code Code to validate
   * @returns Validation result
   */
  static validateCode(code: string): ValidationResult {
    const errors: string[] = [];

    if (!code) {
      errors.push('Code cannot be empty');
      return { valid: false, errors };
    }

    if (code.length > 10_000_000) {
      errors.push('Code exceeds maximum length (10MB)');
    }

    // Check for suspicious patterns
    const suspiciousPatterns = [
      { pattern: /require\s*\(\s*['"].*node[_:]?internals/i, msg: 'Attempt to require node internals' },
      { pattern: /\bprocess\b/, msg: 'Direct process access detected' },
      { pattern: /\bbuffer\b/i, msg: 'Direct buffer access detected' },
      { pattern: /\bchild_process\b/i, msg: 'Attempted child process execution' },
      { pattern: /\bcluster\b/i, msg: 'Attempted cluster access' },
      { pattern: /\bvm\b.*require/i, msg: 'Attempted VM module access' },
      { pattern: /\bfs\b.*require/i, msg: 'Attempted filesystem access' },
    ];

    for (const { pattern, msg } of suspiciousPatterns) {
      if (pattern.test(code)) {
        errors.push(msg);
      }
    }

    // Try to parse as JavaScript to check syntax
    try {
      new Function(code);
    } catch (error) {
      errors.push(`Syntax error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate module name
   * @param name Module name
   * @returns True if valid
   */
  static validateModuleName(name: string): boolean {
    if (!name || typeof name !== 'string') {
      return false;
    }

    // Check for dangerous patterns
    if (name.includes('..') || name.startsWith('/')) {
      return false;
    }

    // Must be valid npm package name or relative path
    return /^(@[a-z0-9-]+\/)?[a-z0-9-]+(\.[a-z0-9-]+)*$/.test(name) ||
           /^\.\/|^\.\.\//.test(name);
  }

  /**
   * Validate file path
   * @param path File path
   * @returns True if valid
   */
  static validatePath(path: string): boolean {
    if (!path || typeof path !== 'string') {
      return false;
    }

    // Prevent directory traversal
    if (path.includes('..')) {
      return false;
    }

    // Must start with /
    if (!path.startsWith('/')) {
      return false;
    }

    return true;
  }

  /**
   * Validate execution options
   * @param options Options to validate
   */
  static validateOptions(options: any): void {
    if (!options || typeof options !== 'object') {
      return;
    }

    // Validate timeout
    if ('timeout' in options) {
      if (typeof options.timeout !== 'number' || options.timeout < 0) {
        throw new Error('Invalid timeout value');
      }
      if (options.timeout > 600_000) {
        throw new Error('Timeout exceeds maximum (10 minutes)');
      }
    }

    // Validate memory limit
    if ('memoryLimit' in options) {
      if (typeof options.memoryLimit !== 'number' || options.memoryLimit < 0) {
        throw new Error('Invalid memory limit');
      }
      if (options.memoryLimit > 4_000_000_000) {
        throw new Error('Memory limit exceeds maximum (4GB)');
      }
    }

    // Validate CPU limit
    if ('cpuLimit' in options) {
      if (typeof options.cpuLimit !== 'number' || options.cpuLimit < 0) {
        throw new Error('Invalid CPU limit');
      }
    }
  }

  /**
   * Sanitize user input string
   * @param input Input string
   * @returns Sanitized string
   */
  static sanitizeInput(input: string): string {
    if (!input || typeof input !== 'string') {
      return '';
    }

    // Remove null bytes
    let sanitized = input.replace(/\0/g, '');

    // Limit length
    if (sanitized.length > 100_000) {
      sanitized = sanitized.substring(0, 100_000);
    }

    return sanitized;
  }

  /**
   * Validate environment variable
   * @param key Variable name
   * @param value Variable value
   * @returns True if valid
   */
  static validateEnvVar(key: string, value: any): boolean {
    // Key must be valid identifier
    if (!/^[A-Z_][A-Z0-9_]*$/i.test(key)) {
      return false;
    }

    // Value must be string or convertible to string
    if (value !== null && value !== undefined && typeof value !== 'string') {
      return false;
    }

    return true;
  }

  /**
   * Check if code is suspicious
   * @param code Code to check
   * @returns Suspicious reasons
   */
  static checkSuspiciousCode(code: string): string[] {
    const reasons: string[] = [];

    // Very long lines might indicate obfuscation
    const lines = code.split('\n');
    const veryLongLines = lines.filter((l) => l.length > 500).length;
    if (veryLongLines > 10) {
      reasons.push('Contains many very long lines (possible obfuscation)');
    }

    // Excessive use of String.fromCharCode
    if ((code.match(/String\.fromCharCode/g) || []).length > 100) {
      reasons.push('Excessive use of String.fromCharCode');
    }

    // Suspicious unicode escapes
    if ((code.match(/\\u[0-9a-f]{4}/gi) || []).length > 50) {
      reasons.push('Excessive unicode escapes detected');
    }

    // Eval or Function constructors
    if (/\beval\s*\(/.test(code)) {
      reasons.push('Direct eval usage detected');
    }
    if (/new\s+Function/.test(code)) {
      reasons.push('Dynamic function construction detected');
    }

    return reasons;
  }
}
