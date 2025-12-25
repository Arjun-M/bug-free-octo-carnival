/**
 * @file src/core/CompiledScript.ts
 * @description Represents a pre-compiled or transpiled script ready for execution. Provides caching for TypeScript-to-JavaScript transpilation and stores compilation metadata to avoid redundant compilation overhead.
 * @since 1.0.0
 * @copyright Copyright (c) 2025 Arjun-M. This source code is licensed under the MIT license.
 */

import type { CompiledScriptData, Language } from './types.js';

/**
 * CompiledScript - Wrapper for compiled/transpiled code with metadata.
 *
 * Stores both the original source code and the compiled JavaScript output,
 * along with language information and compilation timestamp. Useful for
 * caching TypeScript transpilation results.
 *
 * @class
 * @example
 * ```typescript
 * const compiled = new CompiledScript(
 *   'const x: number = 42;',
 *   'const x = 42;',
 *   'typescript'
 * );
 * console.log(compiled.getCompiled()); // 'const x = 42;'
 * ```
 */
export class CompiledScript {
  private code: string;
  private compiled: string;
  private language: Language;
  private compiledAt: number;

  /**
   * Creates a new CompiledScript instance.
   *
   * @param {string} code - Original source code
   * @param {string} compiled - Compiled/transpiled JavaScript code
   * @param {Language} [language='javascript'] - Source language
   */
  constructor(code: string, compiled: string, language: Language = 'javascript') {
    this.code = code;
    this.compiled = compiled;
    this.language = language;
    this.compiledAt = Date.now();
  }

  /**
   * Gets the original source code.
   *
   * @returns {string} Original source code
   */
  getSource(): string {
    return this.code;
  }

  /**
   * Gets the compiled JavaScript code.
   *
   * @returns {string} Compiled JavaScript code
   */
  getCompiled(): string {
    return this.compiled;
  }

  /**
   * Gets the source language.
   *
   * @returns {Language} Source language ('javascript', 'typescript', or 'ts')
   */
  getLanguage(): Language {
    return this.language;
  }

  /**
   * Gets compilation metadata.
   *
   * @returns {CompiledScriptData} Object containing code, compiled output, language, and compilation timestamp
   */
  getMetadata(): CompiledScriptData {
    return {
      code: this.code,
      compiled: this.compiled,
      language: this.language,
      compiledAt: this.compiledAt,
    };
  }
}
