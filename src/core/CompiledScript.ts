/**
 * @fileoverview CompiledScript - Represents a pre-compiled script ready for execution.
 *
 * Supports caching transpiled code (e.g. TS -> JS) to avoid re-transpilation cost
 * when executing the same code multiple times.
 *
 * @example
 * ```typescript
 * const script = new CompiledScript(
 *   'const x = 2 + 2',
 *   'const x = 2 + 2',
 *   'javascript'
 * );
 * const result = await script.run(context, isolate, 5000);
 * ```
 */

import ivm from 'isolated-vm';
import type { CompiledScriptData, Language } from './types.js';

/**
 * Represents a script that has been compiled/transpiled and is ready for execution.
 *
 * CompiledScript stores both the original source code and the compiled/transpiled version,
 * allowing for efficient re-execution without recompilation overhead. This is particularly
 * useful for TypeScript code that needs to be transpiled to JavaScript.
 *
 * @example Basic usage
 * ```typescript
 * const script = box.compile('2 + 2');
 * const result1 = await script.run(context1, isolate1);
 * const result2 = await script.run(context2, isolate2);
 * ```
 *
 * @example TypeScript compilation
 * ```typescript
 * const tsCode = 'const greet = (name: string): string => `Hello ${name}`;';
 * const jsCode = transpile(tsCode);
 * const script = new CompiledScript(tsCode, jsCode, 'typescript');
 * ```
 *
 * @see {@link IsoBox.compile}
 */
export class CompiledScript {
  private code: string;
  private compiled: string;
  private language: Language;
  private compiledAt: number;

  /**
   * Creates a new CompiledScript instance.
   *
   * @param code - Original source code
   * @param compiled - Compiled/transpiled code ready for execution
   * @param language - Programming language of the source code (default: 'javascript')
   *
   * @example
   * ```typescript
   * const script = new CompiledScript(
   *   'const x: number = 42',
   *   'const x = 42',
   *   'typescript'
   * );
   * ```
   */
  constructor(code: string, compiled: string, language: Language = 'javascript') {
    this.code = code;
    this.compiled = compiled;
    this.language = language;
    this.compiledAt = Date.now();
  }

  /**
   * Get the original source code.
   *
   * @returns Original uncompiled source code
   *
   * @example
   * ```typescript
   * const source = script.getSource();
   * console.log(source); // Original TypeScript code
   * ```
   */
  getSource(): string {
    return this.code;
  }

  /**
   * Get the compiled/transpiled code.
   *
   * @returns Compiled code ready for execution
   *
   * @example
   * ```typescript
   * const compiled = script.getCompiled();
   * console.log(compiled); // Transpiled JavaScript code
   * ```
   */
  getCompiled(): string {
    return this.compiled;
  }

  /**
   * Get the source language.
   *
   * @returns Language identifier ('javascript', 'typescript', 'js', 'ts')
   *
   * @example
   * ```typescript
   * const lang = script.getLanguage();
   * console.log(lang); // 'typescript'
   * ```
   */
  getLanguage(): Language {
    return this.language;
  }

  /**
   * Get complete metadata about the compiled script.
   *
   * @returns Object containing all script metadata
   *
   * @example
   * ```typescript
   * const metadata = script.getMetadata();
   * console.log(metadata.compiledAt); // Timestamp
   * console.log(metadata.language); // 'javascript'
   * ```
   */
  getMetadata(): CompiledScriptData {
    return {
      code: this.code,
      compiled: this.compiled,
      language: this.language,
      compiledAt: this.compiledAt,
    };
  }

  /**
   * Execute the compiled script in an isolated context.
   *
   * Compiles the script into isolated-vm bytecode and runs it in the provided
   * context with optional timeout enforcement.
   *
   * @template T - Expected return type of the script execution
   * @param context - isolated-vm context to run the script in
   * @param isolate - isolated-vm isolate instance
   * @param timeout - Optional execution timeout in milliseconds
   *
   * @returns Promise resolving to the script's return value
   *
   * @throws {Error} If execution fails or times out
   *
   * @example
   * ```typescript
   * const isolate = new ivm.Isolate({ memoryLimit: 128 });
   * const context = isolate.createContextSync();
   * const result = await script.run(context, isolate, 5000);
   * console.log(result); // Script output
   * ```
   */
  async run<T = any>(
    context: ivm.Context,
    isolate: ivm.Isolate,
    timeout?: number
  ): Promise<T> {
    try {
      const script = await isolate.compileScript(this.compiled);
      const result = await script.run(context, {
        timeout: timeout,
        promise: true, // Handle async code
      });
      return result as T;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      throw new Error(`Execution failed: ${err.message}`);
    }
  }
}
