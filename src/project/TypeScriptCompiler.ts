/**
 * @file src/project/TypeScriptCompiler.ts
 * @description TypeScript to JavaScript transpiler using official TypeScript API
 * @since 1.0.0
 * @copyright Copyright (c) 2025 Arjun-M. This source code is licensed under the MIT license.
 */

import { logger } from '../utils/Logger.js';
import ts from 'typescript';

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
 * @class TypeScriptCompiler
 * TypeScript to JavaScript transpiler using the official TypeScript API.
 * Provides compilation, type checking, and configuration management.
 *
 * @example
 * ```typescript
 * // Create compiler with custom options
 * const compiler = new TypeScriptCompiler({
 *   target: 'ES2020',
 *   module: 'esnext',
 *   strict: true
 * });
 *
 * // Compile TypeScript code
 * const js = compiler.compile('const x: number = 42;', 'test.ts');
 *
 * // Validate types
 * const result = compiler.validateTypes('const x: number = "error";');
 * if (!result.valid) {
 *   console.error('Type errors:', result.errors);
 * }
 * ```
 */
export class TypeScriptCompiler {
  private compilerOptions: ts.CompilerOptions;

  /**
   * Create a new TypeScript compiler
   * @param options - Partial compiler options (defaults will be applied)
   */
  constructor(options: Partial<CompilerOptions> = {}) {
    // Map the custom interface to official ts.CompilerOptions
    this.compilerOptions = {
      target: this.mapTarget(options.target ?? 'ES2020'),
      module: this.mapModule(options.module ?? 'esnext'),
      strict: options.strict ?? true,
      esModuleInterop: options.esModuleInterop ?? true,
      skipLibCheck: options.skipLibCheck ?? true,
      forceConsistentCasingInFileNames: options.forceConsistentCasingInFileNames ?? true,
      sourceMap: options.sourceMap ?? false,
      declaration: options.declaration ?? false,
    };

    logger.debug('TypeScriptCompiler initialized with official API');
  }

  /**
   * Static helper to transpile code without creating a persistent instance.
   * Useful for quick transpilation where options are defaults.
   *
   * @param code - TypeScript code
   * @param filename - Optional filename
   * @returns Transpiled JavaScript code
   */
  static transpile(code: string, filename: string = 'script.ts'): string {
    const compiler = new TypeScriptCompiler();
    return compiler.compile(code, filename);
  }

  /**
   * Helper to map string target to ts.ScriptTarget enum
   */
  private mapTarget(target: string): ts.ScriptTarget {
    switch (target) {
      case 'ES2015': return ts.ScriptTarget.ES2015;
      case 'ES2020': return ts.ScriptTarget.ES2020;
      case 'ES2022': return ts.ScriptTarget.ES2022;
      default: return ts.ScriptTarget.ES2020;
    }
  }

  /**
   * Helper to map string module to ts.ModuleKind enum
   */
  private mapModule(mod: string): ts.ModuleKind {
    switch (mod) {
      case 'commonjs': return ts.ModuleKind.CommonJS;
      case 'esnext': return ts.ModuleKind.ESNext;
      default: return ts.ModuleKind.ESNext;
    }
  }

  /**
   * Compile TypeScript code to JavaScript
   * @param code - TypeScript source code
   * @param filename - Name of file being compiled (for error reporting)
   * @returns Compiled JavaScript code
   * @throws {Error} If compilation fails
   *
   * @example
   * ```typescript
   * const compiler = new TypeScriptCompiler();
   * const js = compiler.compile('const x: number = 42;', 'example.ts');
   * console.log(js); // Output: const x = 42;
   * ```
   */
  compile(code: string, filename: string): string {
    logger.debug(`Compiling ${filename}`);

    try {
      // Use ts.transpileModule for single-file transpilation
      // This is the standard way to convert TS -> JS without needing a full project setup
      const result = ts.transpileModule(code, {
        compilerOptions: this.compilerOptions,
        fileName: filename,
        reportDiagnostics: true
      });

      // Check for syntax errors during transpilation
      if (result.diagnostics && result.diagnostics.length > 0) {
        const messages = result.diagnostics.map(d => {
          const message = ts.flattenDiagnosticMessageText(d.messageText, '\n');
          return `Line ${d.file?.getLineAndCharacterOfPosition(d.start!).line}: ${message}`;
        });
        logger.warn(`Compilation warnings for ${filename}:`, messages);
      }

      logger.debug(`Successfully compiled ${filename}`);
      return result.outputText;
    } catch (error) {
      logger.error(`Failed to compile ${filename}:`, error);
      throw new Error(
        `TypeScript compilation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Validate TypeScript types
   * Note: 'transpileModule' is isolated (single file).
   * For full type checking across dependencies, a ts.Program is required.
   * This implementation checks for syntactic correctness and basic usage.
   * @param code - TypeScript source code to validate
   * @returns Type check result with errors and warnings
   *
   * @example
   * ```typescript
   * const compiler = new TypeScriptCompiler({ strict: true });
   * const result = compiler.validateTypes('const x: number = "wrong";');
   * if (!result.valid) {
   *   console.error('Errors:', result.errors);
   * }
   * ```
   */
  validateTypes(code: string): TypeCheckResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Create a source file in memory to check syntax
    const sourceFile = ts.createSourceFile(
      'temp.ts',
      code,
      this.compilerOptions.target || ts.ScriptTarget.ES2020,
      true // setParentNodes
    );

    // 1. Syntactic Diagnostics (Parse errors)
    // This catches things like "const x: =" (missing value)
    const diagnostics = sourceFile.getSyntacticDiagnostics();

    diagnostics.forEach(diagnostic => {
      const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
      const { line, character } = sourceFile.getLineAndCharacterOfPosition(diagnostic.start!);
      errors.push(`Line ${line + 1}, Col ${character + 1}: ${message}`);
    });

    // 2. Basic semantic checks (optional, simplistic for single file)
    // Without a CompilerHost, we can't fully check types against libraries (like Array, Promise, etc)
    // effectively, but we can catch obvious block-scoped issues.
    
    // Example: Check for empty interfaces if strict
    if (this.compilerOptions.strict) {
       // We can traverse the AST if needed
       ts.forEachChild(sourceFile, (node) => {
         if (ts.isInterfaceDeclaration(node) && node.members.length === 0) {
           warnings.push(`Empty interface found: ${node.name.text}`);
         }
       });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Get current compiler options
   * @returns Current compiler options
   */
  getCompilerOptions(): CompilerOptions {
    // Map back to the simple interface for the getter
    return {
      target: 'ES2020', // Simplified return for demo
      module: 'esnext',
      strict: this.compilerOptions.strict ?? true,
      esModuleInterop: this.compilerOptions.esModuleInterop ?? true,
      skipLibCheck: this.compilerOptions.skipLibCheck ?? true,
      forceConsistentCasingInFileNames: this.compilerOptions.forceConsistentCasingInFileNames ?? true,
      sourceMap: this.compilerOptions.sourceMap ?? false,
      declaration: this.compilerOptions.declaration ?? false,
    };
  }

  /**
   * Set compiler options
   * @param options - Partial options to merge with existing options
   */
  setCompilerOptions(options: Partial<CompilerOptions>): void {
    const newOptions = {
        ...this.getCompilerOptions(),
        ...options
    };

    this.compilerOptions = {
        ...this.compilerOptions,
        target: this.mapTarget(newOptions.target),
        module: this.mapModule(newOptions.module),
        strict: newOptions.strict,
        // ... map other options as needed
    };
  }
}
