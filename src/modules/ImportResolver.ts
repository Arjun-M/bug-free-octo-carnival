/**
 * @file src/modules/ImportResolver.ts
 * @description Import path resolution for relative, absolute, and node module specifiers. Handles extension resolution, index file fallbacks, and filesystem lookups.
 * @since 1.0.0
 * @copyright Copyright (c) 2025 Arjun-M. This source code is licensed under the MIT license.
 */

import { MemFS } from '../filesystem/MemFS.js';
import { SandboxError } from '../core/types.js';

/**
 * Configuration options for import resolution.
 *
 * @interface ResolveOptions
 */
export interface ResolveOptions {
  extensions?: string[];
  preserveSymlinks?: boolean;
}

/**
 * Resolves import/require statements to actual module paths in the virtual filesystem.
 *
 * Handles three types of specifiers:
 * - Relative: './file', '../folder/file'
 * - Absolute: '/src/file'
 * - Node modules: 'lodash', '@scope/package'
 *
 * Automatically tries common extensions (.js, .ts, .json) and index files when
 * exact paths don't exist.
 *
 * @class ImportResolver
 * @example
 * ```typescript
 * const resolver = new ImportResolver(memfs);
 * const path = resolver.resolve('./utils', '/src/index.js');
 * // Returns: '/src/utils.js' (if exists)
 * ```
 */
export class ImportResolver {
  private memfs: MemFS;
  private extensions: string[];

  /**
   * Create import resolver
   * @param memfs Virtual filesystem for resolving paths
   * @param options Resolution options
   */
  constructor(memfs: MemFS, options: ResolveOptions = {}) {
    this.memfs = memfs;
    this.extensions = options.extensions ?? ['.js', '.ts', '.json'];
  }

  /**
   * Resolve an import specifier to actual path
   * @param specifier Module specifier ('lodash', './utils', '/src/file')
   * @param fromPath Importing file path ('/src/main.js')
   * @returns Resolved absolute path
   */
  resolve(specifier: string, fromPath: string = '/'): string {
    // Relative: ./file, ../file, ./folder/file
    if (specifier.startsWith('.')) {
      return this.resolveRelative(specifier, fromPath);
    }

    // Absolute: /src/file
    if (specifier.startsWith('/')) {
      return this.resolveAbsolute(specifier);
    }

    // Node modules: lodash, @scope/package
    return this.resolveNodeModules(specifier);
  }

  /**
   * Resolve relative import
   * @param specifier Relative path ('./utils', '../lib')
   * @param fromPath Path of importing file
   * @returns Absolute path
   */
  private resolveRelative(specifier: string, fromPath: string): string {
    // Extract directory from fromPath
    const fromDir = this.dirname(fromPath);

        // Resolve against fromDir
        const resolved = this.joinPaths(fromDir, specifier);

    // Try exact match first
    if (this.memfs.exists(resolved)) {
      const stat = this.memfs.stat(resolved);
      if (!stat.isDirectory) {
        return resolved;
      }
    }

    // Try with extensions
    for (const ext of this.extensions) {
      const withExt = resolved + ext;
      if (this.memfs.exists(withExt)) {
        return withExt;
      }
    }

    // Try index files
    for (const ext of this.extensions) {
      const indexFile = this.joinPaths(resolved, `index${ext}`);
      if (this.memfs.exists(indexFile)) {
        return indexFile;
      }
    }

    throw new SandboxError(
      `Cannot resolve module: ${specifier} from ${fromPath}`,
      'MODULE_NOT_FOUND',
      { specifier, from: fromPath }
    );
  }

  /**
   * Resolve absolute import
   * @param specifier Absolute path ('/src/file')
   * @returns Resolved path
   */
  private resolveAbsolute(specifier: string): string {
    // Try exact match first
    if (this.memfs.exists(specifier)) {
      const stat = this.memfs.stat(specifier);
      if (!stat.isDirectory) {
        return specifier;
      }
    }

    // Try with extensions
    for (const ext of this.extensions) {
      const withExt = specifier + ext;
      if (this.memfs.exists(withExt)) {
        return withExt;
      }
    }

    // Try index files
    for (const ext of this.extensions) {
      const indexFile = this.joinPaths(specifier, `index${ext}`);
      if (this.memfs.exists(indexFile)) {
        return indexFile;
      }
    }

    throw new SandboxError(
      `Cannot resolve module: ${specifier}`,
      'MODULE_NOT_FOUND',
      { specifier }
    );
  }

  /**
   * Resolve node module name
   * @param specifier Module name ('lodash', '@scope/package')
   * @returns Resolved path (from node_modules or mocked)
   */
  private resolveNodeModules(specifier: string): string {
    // Try node_modules path (for external packages)
    const nodeModulesPath = `/node_modules/${specifier}`;

    // Try exact match first
    if (this.memfs.exists(nodeModulesPath)) {
       const stat = this.memfs.stat(nodeModulesPath);
       if (!stat.isDirectory) return nodeModulesPath;
    }

    // Try with extensions
    for (const ext of this.extensions) {
      const withExt = nodeModulesPath + ext;
      if (this.memfs.exists(withExt)) {
        return withExt;
      }
    }

    // Try index files
    for (const ext of this.extensions) {
      const indexFile = this.joinPaths(nodeModulesPath, `index${ext}`);
      if (this.memfs.exists(indexFile)) {
        return indexFile;
      }
    }

    throw new SandboxError(
      `Cannot resolve module: ${specifier}`,
      'MODULE_NOT_FOUND',
      { specifier }
    );
  }

  /**
   * Get directory name from path
   * @param path File path
   * @returns Directory path
   */
  private dirname(path: string): string {
    if (path === '/') {
      return '/';
    }

    const parts = path.split('/').filter((p) => p.length > 0);
    if (parts.length <= 1) {
      return '/';
    }

    return '/' + parts.slice(0, -1).join('/');
  }

  /**
   * Join path segments
   * @param base Base path
   * @param relative Relative path
   * @returns Joined path
   */
  private joinPaths(base: string, relative: string): string {
    const baseParts = base.split('/').filter(p => p.length > 0);
    const relativeParts = relative.split('/').filter(p => p.length > 0 && p !== '.');

    const resolvedParts = [...baseParts];

    for (const part of relativeParts) {
      if (part === '..') {
        resolvedParts.pop();
      } else {
        resolvedParts.push(part);
      }
    }

    return '/' + resolvedParts.join('/');
  }

}
