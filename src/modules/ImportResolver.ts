/**
 * @fileoverview Import resolution for relative, absolute, and node module paths
 */

import { MemFS } from '../filesystem/MemFS.js';
import { SandboxError } from '../core/types.js';

/**
 * Resolution options
 */
export interface ResolveOptions {
  extensions?: string[];
  preserveSymlinks?: boolean;
}

/**
 * Resolves import/require statements to actual module paths
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

    // Normalize the specifier
    const normalized = this.normalizePath(specifier);

    // Resolve against fromDir
    const resolved = this.joinPaths(fromDir, normalized);

    // Check if it's a directory
    let isDir = false;
    try {
        const stat = this.memfs.stat(resolved);
        isDir = stat.isDirectory;
    } catch {
        // Does not exist
    }

    // If it's a directory, skip direct match unless we are looking for index
    if (!isDir && this.memfs.exists(resolved)) {
      return resolved;
    }

    // Try exact match with extensions (e.g. ./file.js -> /src/file.js)
    if (!isDir && this.memfs.exists(resolved)) {
        return resolved;
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
    // Check if it's a directory
    let isDir = false;
    try {
        const stat = this.memfs.stat(specifier);
        isDir = stat.isDirectory;
    } catch {
        // Does not exist
    }

    // Try exact match first (if not directory)
    if (!isDir && this.memfs.exists(specifier)) {
      return specifier;
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
    // If '/src/index.js' -> dirname is '/src'
    // If '/index.js' -> dirname is '/'
    if (parts.length === 0) {
        return '/';
    }

    // If just filename at root, return /
    // This logic handles /src/lib correctly
    return '/' + parts.slice(0, -1).join('/');
  }

  /**
   * Join path segments
   * @param base Base path
   * @param relative Relative path
   * @returns Joined path
   */
  private joinPaths(base: string, relative: string): string {
    const combined = base === '/' ? `/${relative}` : `${base}/${relative}`;
    // We need to resolve .. in the joined path
    return this.normalizePath(combined);
  }

  /**
   * Normalize path segments
   * @param path Path to normalize
   * @returns Normalized path
   */
  private normalizePath(path: string): string {
    const parts = path.split('/').filter((p) => p && p !== '.');
    const result: string[] = [];

    for (const part of parts) {
      if (part === '..') {
        if (result.length > 0) {
           result.pop();
        }
        // else: accessing parent of root, ignore or stay at root
      } else {
        result.push(part);
      }
    }

    // Ensure absolute path
    const resolved = '/' + result.join('/');
    // Handle root case
    return resolved;
  }
}
