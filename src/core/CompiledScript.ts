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
   * NOTE: This method is currently not used by IsoBox.run, which uses ExecutionEngine.
   * It is left here for potential future use, but it should be noted that it
   * re-compiles the script every time, defeating the purpose of CompiledScript.
   * The correct approach is to compile once and store the ivm.Script object.
   * Since IsoBox.run uses ExecutionEngine, we will focus on fixing the core class.
   *
   * The IsoBox.compile method (in IsoBox.ts) is also broken as it only returns a string.
   *
   * For now, we will fix IsoBox.compile to return a proper CompiledScript object
   * that can be used by ExecutionEngine.executeScript.
   *
   * The run method in CompiledScript is flawed because it re-compiles.
   * We will remove it as it is not used and is misleading.
   */
  // async run<T = any>(
  //   context: ivm.Context,
  //   isolate: ivm.Isolate,
  //   timeout?: number
  // ): Promise<T> {
  //   // ... (removed flawed implementation)
  // }
}
