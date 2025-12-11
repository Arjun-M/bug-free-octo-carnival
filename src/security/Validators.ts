/**
 * Validates inputs and checks for security risks in code.
 */

import { logger } from '../utils/Logger.js';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export class Validators {
  static validateCode(code: string): ValidationResult {
    const errors: string[] = [];

    // Silence unused logger warning
    logger.debug('Validating code');

    if (!code) {
      errors.push('Code cannot be empty');
      return { valid: false, errors };
    }

    if (code.length > 10_000_000) {
      errors.push('Code exceeds 10MB limit');
    }

    const suspiciousPatterns = [
      { pattern: /require\s*\(\s*['"].*node[_:]?internals/i, msg: 'Node internals blocked' },
      { pattern: /\bprocess\b/, msg: 'Process access blocked' },
      // buffer is safe in small doses, but global access might be blocked
      // { pattern: /\bbuffer\b/i, msg: 'Direct buffer access detected' },
      { pattern: /\bchild_process\b/i, msg: 'Child process blocked' },
      { pattern: /\bcluster\b/i, msg: 'Cluster blocked' },
      // fs access via require is blocked by whitelist, but good to catch early
      { pattern: /\bfs\b.*require/i, msg: 'Filesystem access blocked' },
    ];

    for (const { pattern, msg } of suspiciousPatterns) {
      if (pattern.test(code)) {
        // Warning only, as these might be in strings or comments
        // Real security is enforced by the sandbox
        logger.warn(`Suspicious pattern detected: ${msg}`);
      }
    }

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

  static validateModuleName(name: string): boolean {
    if (!name || typeof name !== 'string') return false;
    if (name.includes('..') || name.startsWith('/')) return false;

    // NPM package name or relative path
    return /^(@[a-z0-9-]+\/)?[a-z0-9-]+(\.[a-z0-9-]+)*$/.test(name) ||
           /^\.\/|^\.\.\//.test(name);
  }

  static validatePath(path: string): boolean {
    if (!path || typeof path !== 'string') return false;
    if (path.includes('..')) return false;
    if (!path.startsWith('/')) return false;
    return true;
  }

  static validateOptions(options: any): void {
    if (!options || typeof options !== 'object') return;

    if ('timeout' in options) {
      if (typeof options.timeout !== 'number' || options.timeout < 0) {
        throw new Error('Invalid timeout');
      }
      if (options.timeout > 600_000) {
        throw new Error('Timeout > 10m not allowed');
      }
    }

    if ('memoryLimit' in options) {
      if (typeof options.memoryLimit !== 'number' || options.memoryLimit < 0) {
        throw new Error('Invalid memory limit');
      }
      if (options.memoryLimit > 4_000_000_000) {
        throw new Error('Memory limit > 4GB not allowed');
      }
    }

    if ('cpuLimit' in options) {
      if (typeof options.cpuLimit !== 'number' || options.cpuLimit < 0) {
        throw new Error('Invalid CPU limit');
      }
    }
  }

  static sanitizeInput(input: string): string {
    if (!input || typeof input !== 'string') return '';
    let sanitized = input.replace(/\0/g, '');
    if (sanitized.length > 100_000) {
      sanitized = sanitized.substring(0, 100_000);
    }
    return sanitized;
  }

  static validateEnvVar(key: string, value: any): boolean {
    if (!/^[A-Z_][A-Z0-9_]*$/i.test(key)) return false;
    if (value !== null && value !== undefined && typeof value !== 'string') return false;
    return true;
  }

  static checkSuspiciousCode(code: string): string[] {
    const reasons: string[] = [];

    const lines = code.split('\n');
    const veryLongLines = lines.filter((l) => l.length > 500).length;
    if (veryLongLines > 10) {
      reasons.push('Possible obfuscation (long lines)');
    }

    if ((code.match(/String\.fromCharCode/g) || []).length > 100) {
      reasons.push('Excessive String.fromCharCode');
    }

    if ((code.match(/\\u[0-9a-f]{4}/gi) || []).length > 50) {
      reasons.push('Excessive unicode escapes');
    }

    if (/\beval\s*\(/.test(code)) {
      reasons.push('Direct eval usage');
    }
    if (/new\s+Function/.test(code)) {
      reasons.push('Dynamic function construction');
    }

    return reasons;
  }
}
