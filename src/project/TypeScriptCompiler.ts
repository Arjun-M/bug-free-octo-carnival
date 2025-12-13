/**
 * @fileoverview TypeScript to JavaScript transpiler
 */

import { logger } from '../utils/Logger.js';

/**
 * TypeScript compiler options
 */
export interface CompilerOptions {
  target: 'ES2015' | 'ES2020' | 'ES2022';
  module: 'commonjs' | 'esnext';
  strict: boolean;
  esModuleInterop: boolean;
  skipLibCheck: boolean;
  forceConsistentCasingInFileNames: boolean;
  sourceMap: boolean;
  declaration: boolean;
}

/**
 * Type check result
 */
export interface TypeCheckResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Simple TypeScript to JavaScript transpiler
 * Handles basic TS → JS conversion without full type checking
 */
export class TypeScriptCompiler {
  private compilerOptions: CompilerOptions;

  constructor(options: Partial<CompilerOptions> = {}) {
    this.compilerOptions = {
      target: options.target ?? 'ES2020',
      module: options.module ?? 'esnext',
      strict: options.strict ?? true,
      esModuleInterop: options.esModuleInterop ?? true,
      skipLibCheck: options.skipLibCheck ?? true,
      forceConsistentCasingInFileNames: options.forceConsistentCasingInFileNames ?? true,
      sourceMap: options.sourceMap ?? false,
      declaration: options.declaration ?? false,
    };

    logger.debug('TypeScriptCompiler initialized');
  }

  /**
   * Compile TypeScript code to JavaScript
   * @param code TypeScript code
   * @param filename File being compiled
   * @returns Compiled JavaScript code
   */
  compile(code: string, filename: string): string {
    logger.debug(`Compiling ${filename}`);

    try {
      // Transpile TypeScript to JavaScript
      const js = this.transpile(code);

      logger.debug(`Successfully compiled ${filename}`);
      return js;
    } catch (error) {
      logger.error(`Failed to compile ${filename}:`, error);
      throw new Error(
        `TypeScript compilation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Transpile TypeScript code to JavaScript
   * Uses regex-based approach for simplicity
   * @param code TypeScript code
   * @returns JavaScript code
   */
  static transpile(code: string): string {
    let js = code;

    // Remove type annotations from parameters
    // function foo(x: number) → function foo(x)
    js = js.replace(/(\w+)\s*:\s*[^=,)]+(?=[,)])/g, '$1');

    // Remove interface declarations
    // interface X { ... } → (removed)
    js = js.replace(/^\s*export\s+interface\s+\w+\s*\{[\s\S]*?\n\}/gm, '');
    js = js.replace(/^\s*interface\s+\w+\s*\{[\s\S]*?\n\}/gm, '');

    // Remove type declarations
    // type X = ... → (removed)
    js = js.replace(/^\s*export\s+type\s+\w+\s*=[\s\S]*?;/gm, '');
    js = js.replace(/^\s*type\s+\w+\s*=[\s\S]*?;/gm, '');

    // Remove type parameters from functions
    // function foo<T>(x: T) → function foo(x)
    js = js.replace(/<\w+[^>]*>/g, '');

    // Remove return type annotations
    // function foo(): number → function foo()
    js = js.replace(/\):\s*[^{;]+(?=[{;])/g, ')');

    // Remove property type annotations
    // x: number; → x;
    // x: string = 'test'; → x = 'test';
    js = js.replace(/(\w+)\s*:\s*([^=;]+);/g, (_match, name, _type) => {
      return `${name};`;
    });
    js = js.replace(/(\w+)\s*:\s*[^=]+\s*=/g, '$1 =');

    // Remove readonly keyword
    js = js.replace(/\breadonly\s+/g, '');

    // Remove access modifiers
    js = js.replace(/\b(public|private|protected)\s+/g, '');

    // Remove abstract keyword
    js = js.replace(/\babstract\s+/g, '');

    // Convert class property declarations with types
    // private x: number; → (removed in strict, kept as comment in loose)
    js = js.replace(/^\s*(private|protected|public)?\s*(\w+)\s*:\s*[^=;]+;/gm, 'this.$2 = undefined;');

    // Fix generic type usage in code
    // Array<string> → Array
    js = js.replace(/([A-Z]\w*)<[^>]+>/g, '$1');

    // Remove as type assertions
    // x as string → x
    js = js.replace(/\s+as\s+\w+/g, '');

    // Remove type-only imports
    // import type { X } from 'y' → (removed)
    js = js.replace(/import\s+type\s+{[^}]*}\s+from\s+['"][^'"]*['"]/g, '');

    // Keep regular imports
    // import { X } from 'y' → import { X } from 'y'

    // Validate basic syntax
    this.validateSyntax(js);

    return js;
  }

  /**
   * Validate JavaScript syntax
   * @param code JavaScript code
   */
  private validateSyntax(code: string): void {
    try {
      // Try to parse as function to check syntax
      new Function(code);
    } catch (error) {
      throw new Error(
        `Syntax error after transpilation: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Validate TypeScript types (basic)
   * @param code TypeScript code
   * @returns Type check result
   */
  validateTypes(code: string): TypeCheckResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check for basic type errors (very simplified)

    // Check for missing type annotations in strict mode
    if (this.compilerOptions.strict) {
      const implicitAnyPattern = /(?<!:)\s+(?:function|const|let|var)\s+(\w+)\s*\(/g;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      while (implicitAnyPattern.exec(code) !== null) {
        // Would need more context to properly detect
      }
    }

    // Check for unused variables (warning)
    const varPattern = /(?:const|let|var)\s+(\w+)\s*=/g;
    // We need a new match variable here because the previous one is block-scoped (let match)
    // Wait, the previous 'match' was declared with 'let' inside the if block.
    // So it's not accessible here. We need to declare a new one.
    let varMatch: RegExpExecArray | null;
    while ((varMatch = varPattern.exec(code)) !== null) {
      const varName = varMatch[1];
      // Simple heuristic: warn if variable not used after declaration
      const restCode = code.substring(varMatch.index + varMatch[0].length);
      if (!restCode.includes(varName)) {
        warnings.push(`Unused variable: ${varName}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Get compiler options
   */
  getCompilerOptions(): CompilerOptions {
    return { ...this.compilerOptions };
  }

  /**
   * Set compiler options
   * @param options Partial options to merge
   */
  setCompilerOptions(options: Partial<CompilerOptions>): void {
    this.compilerOptions = {
      ...this.compilerOptions,
      ...options,
    };
  }
}
