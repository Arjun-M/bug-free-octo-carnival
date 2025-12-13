/**
 * @file src/project/ImportResolver.ts
 * @description Import/require path resolution for module loading in virtual filesystem
 * @since 1.0.0
 * @copyright Copyright (c) 2025 Arjun-M. This source code is licensed under the MIT license.
 */

import { logger } from '../utils/Logger.js';

/**
 * @class ImportResolver
 * Resolves import specifiers to actual file paths in virtual filesystem.
 * Handles relative imports (./file), absolute imports (/src/file), and node modules.
 *
 * @example
 * ```typescript
 * // Resolve relative import
 * const path = ImportResolver.resolveImport('./utils', '/src/index.js', memfs);
 * // Returns: '/src/utils.js'
 *
 * // Check path types
 * ImportResolver.isRelative('./file'); // true
 * ImportResolver.isAbsolute('/src/file'); // true
 * ImportResolver.isNodeModule('lodash'); // true
 *
 * // Path manipulation
 * const normalized = ImportResolver.normalizePath('/src/../lib/./file.js');
 * // Returns: '/lib/file.js'
 * ```
 */
export class ImportResolver {
  /**
   * Resolve import specifier to file path
   * @param specifier - Import specifier (e.g., './utils', '@scope/pkg', 'lodash')
   * @param fromPath - Path of importing file
   * @param memfs - MemFS instance for checking file existence (optional)
   * @returns Resolved file path
   *
   * @example
   * ```typescript
   * const path = ImportResolver.resolveImport('./helper', '/src/index.js', memfs);
   * // Returns: '/src/helper.js' (if exists) or '/src/helper/index.js'
   * ```
   */
  static resolveImport(
    specifier: string,
    fromPath: string,
    memfs?: any
  ): string {
    logger.debug(`Resolving import: ${specifier} from ${fromPath}`);

    // Relative import: ./file, ../file
    if (specifier.startsWith('.')) {
      return ImportResolver.resolveRelative(specifier, fromPath, memfs);
    }

    // Absolute import: /src/file
    if (specifier.startsWith('/')) {
      return ImportResolver.resolveAbsolute(specifier, memfs);
    }

    // Node module: lodash, @scope/package
    return ImportResolver.resolveNodeModule(specifier);
  }

  /**
   * Resolve relative import
   * @param specifier Relative specifier (./file, ../file)
   * @param fromPath Path of importing file
   * @param memfs MemFS instance
   * @returns Resolved path
   */
  private static resolveRelative(
    specifier: string,
    fromPath: string,
    memfs?: any
  ): string {
    // Remove leading ./
    let normalized = specifier.replace(/^\.\//, '');
    const goingUp = specifier.match(/\.\.\//g)?.length ?? 0;

    // Split fromPath into directory
    const parts = fromPath.split('/').filter((p) => p);

    // Remove file name
    if (parts.length > 0) {
      parts.pop();
    }

    // Go up directories
    for (let i = 0; i < goingUp; i++) {
      if (parts.length > 0) {
        parts.pop();
      }
      // Remove one ../
      normalized = normalized.replace(/^\.\.\//, '');
    }

    // Add remaining path parts
    const resolved = ['', ...parts, normalized].join('/');

    // Try with extensions
    const extensions = ['.js', '.ts', '.json'];
    for (const ext of extensions) {
      if (memfs && memfs.exists && memfs.exists(resolved + ext)) {
        return resolved + ext;
      }
    }

    // Try as directory with index file
    for (const ext of ['.js', '.ts']) {
      const indexPath = resolved + '/index' + ext;
      if (memfs && memfs.exists && memfs.exists(indexPath)) {
        return indexPath;
      }
    }

    // If memfs not provided or file not found, return with first extension
    return resolved + '.js';
  }

  /**
   * Resolve absolute import
   * @param specifier Absolute specifier (/src/file)
   * @param memfs MemFS instance
   * @returns Resolved path
   */
  private static resolveAbsolute(specifier: string, memfs?: any): string {
    // Try with extensions
    const extensions = ['.js', '.ts', '.json'];
    for (const ext of extensions) {
      if (memfs && memfs.exists && memfs.exists(specifier + ext)) {
        return specifier + ext;
      }
    }

    // Try as directory with index file
    for (const ext of ['.js', '.ts']) {
      const indexPath = specifier + '/index' + ext;
      if (memfs && memfs.exists && memfs.exists(indexPath)) {
        return indexPath;
      }
    }

    return specifier + '.js';
  }

  /**
   * Resolve Node module import
   * @param specifier Module name (lodash, @scope/pkg)
   * @returns Module path for require
   */
  private static resolveNodeModule(specifier: string): string {
    // For node modules, return as-is
    // Module system will handle finding it in node_modules
    return specifier;
  }

  /**
   * Get directory of a file path
   * @param filePath File path
   * @returns Directory path
   */
  static getDirectory(filePath: string): string {
    const parts = filePath.split('/');
    parts.pop(); // Remove filename
    return parts.join('/') || '/';
  }

  /**
   * Get file name from path
   * @param filePath File path
   * @returns File name
   */
  static getFileName(filePath: string): string {
    const parts = filePath.split('/');
    return parts[parts.length - 1] || '';
  }

  /**
   * Normalize path (remove ./, ../, etc.)
   * @param path Path to normalize
   * @returns Normalized path
   */
  static normalizePath(path: string): string {
    // Split into parts
    const parts = path.split('/').filter((p) => p && p !== '.');

    // Process .. entries
    for (let i = 0; i < parts.length; i++) {
      if (parts[i] === '..') {
        if (i > 0) {
          parts.splice(i - 1, 2);
          i -= 2;
        } else {
          parts.splice(i, 1);
          i--;
        }
      }
    }

    return '/' + parts.join('/');
  }

  /**
   * Check if path is relative
   * @param path Path to check
   * @returns True if relative
   */
  static isRelative(path: string): boolean {
    return path.startsWith('./') || path.startsWith('../');
  }

  /**
   * Check if path is absolute
   * @param path Path to check
   * @returns True if absolute
   */
  static isAbsolute(path: string): boolean {
    return path.startsWith('/');
  }

  /**
   * Check if path is node module
   * @param path Path to check
   * @returns True if node module reference
   */
  static isNodeModule(path: string): boolean {
    return !this.isRelative(path) && !this.isAbsolute(path);
  }

  /**
   * Join paths
   * @param basePath Base path
   * @param relativePath Relative path to add
   * @returns Joined path
   */
  static joinPaths(basePath: string, relativePath: string): string {
    const base = basePath.endsWith('/') ? basePath : basePath + '/';
    return ImportResolver.resolveRelative(relativePath, base);
  }

  /**
   * Get relative path from one file to another
   * @param fromPath - Source file path
   * @param toPath - Target file path
   * @returns Relative path from source to target
   *
   * @example
   * ```typescript
   * const rel = ImportResolver.getRelativePath('/src/index.js', '/lib/utils.js');
   * // Returns: './../lib/utils.js'
   * ```
   */
  static getRelativePath(fromPath: string, toPath: string): string {
    const fromParts = fromPath.split('/').filter((p) => p);
    const toParts = toPath.split('/').filter((p) => p);

    // Remove file names
    fromParts.pop();
    toParts.pop();

    // Find common ancestor
    let commonLength = 0;
    for (let i = 0; i < Math.min(fromParts.length, toParts.length); i++) {
      if (fromParts[i] === toParts[i]) {
        commonLength++;
      } else {
        break;
      }
    }

    // Build relative path
    const ups = fromParts.length - commonLength;
    const downs = toParts.slice(commonLength);
    const fileName = toPath.split('/').pop() || '';

    const relativeParts = Array(ups).fill('..').concat(downs).concat(fileName);
    return './' + relativeParts.join('/');
  }
}
