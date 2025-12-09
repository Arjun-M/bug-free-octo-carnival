/**
 * @fileoverview CompiledScript represents a precompiled/transpiled script ready for execution
 */

import type { Context } from 'isolated-vm';
import type { CompiledScriptData, Language } from './types.js';

/**
 * Represents a pre-compiled script that can be executed multiple times
 * Improves performance by avoiding re-compilation for the same code
 */
export class CompiledScript {
  private code: string;
  private compiled: string;
  private language: Language;
  private compiledAt: number;
  private context?: Context;

  /**
   * Create a compiled script instance
   * @param code Original source code
   * @param compiled Pre-compiled/transpiled version
   * @param language Programming language of the source
   */
  constructor(code: string, compiled: string, language: Language = 'javascript') {
    this.code = code;
    this.compiled = compiled;
    this.language = language;
    this.compiledAt = Date.now();
  }

  /**
   * Get the original source code
   * @returns The original code string
   */
  getSource(): string {
    return this.code;
  }

  /**
   * Get the compiled/transpiled code
   * @returns The compiled code string
   */
  getCompiled(): string {
    return this.compiled;
  }

  /**
   * Get the language of the original code
   * @returns The language identifier
   */
  getLanguage(): Language {
    return this.language;
  }

  /**
   * Get compilation metadata
   * @returns Object containing script metadata
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
   * Set the execution context for this script
   * @param context The isolated-vm Context to use for execution
   */
  setContext(context: Context): void {
    this.context = context;
  }

  /**
   * Get the execution context
   * @returns The context if set, undefined otherwise
   */
  getContext(): Context | undefined {
    return this.context;
  }

  /**
   * Run this compiled script in a context
   * @param context The execution context (overrides stored context)
   * @param timeout Execution timeout in milliseconds
   * @returns Promise resolving to the script result
   */
  async run<T = any>(
    context: Context,
    timeout?: number
  ): Promise<T> {
    try {
      const runOptions: Record<string, any> = {};
      if (timeout) {
        runOptions.timeout = timeout;
      }

      const script = context.compileScriptSync(this.compiled);
      const result = await script.run(context, runOptions);
      return result as T;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      throw new Error(`Failed to run compiled script: ${err.message}`);
    }
  }

  /**
   * Dispose of the compiled script and release resources
   */
  dispose(): void {
    this.context = undefined;
  }

  /**
   * Check if this script is still valid (not disposed)
   * @returns True if the script can still be executed
   */
  isValid(): boolean {
    return this.compiled.length > 0;
  }
}
