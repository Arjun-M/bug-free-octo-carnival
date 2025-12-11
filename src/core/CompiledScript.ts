/**
 * Represents a script that has been compiled/transpiled and is ready for execution.
 *
 * Supports caching transpiled code (e.g. TS -> JS) to avoid re-transpilation cost.
 */

import ivm from 'isolated-vm';
import type { CompiledScriptData, Language } from './types.js';

export class CompiledScript {
  private code: string;
  private compiled: string;
  private language: Language;
  private compiledAt: number;

  constructor(code: string, compiled: string, language: Language = 'javascript') {
    this.code = code;
    this.compiled = compiled;
    this.language = language;
    this.compiledAt = Date.now();
  }

  getSource(): string {
    return this.code;
  }

  getCompiled(): string {
    return this.compiled;
  }

  getLanguage(): Language {
    return this.language;
  }

  getMetadata(): CompiledScriptData {
    return {
      code: this.code,
      compiled: this.compiled,
      language: this.language,
      compiledAt: this.compiledAt,
    };
  }

  /**
   * Run the script in the given context.
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
