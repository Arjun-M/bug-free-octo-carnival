/**
 * @fileoverview Project builder for multi-file execution
 */

import { MemFS } from '../filesystem/MemFS.js';
import { logger } from '../utils/Logger.js';

/**
 * Project file definition
 */
export interface ProjectFile {
  path: string;
  code: string;
  language?: 'javascript' | 'typescript';
}

/**
 * Project options
 */
export interface ProjectOptions {
  files: ProjectFile[];
  entrypoint: string;
  baseDir?: string;
}

/**
 * Project statistics
 */
export interface ProjectStats {
  fileCount: number;
  totalSize: number;
  languages: Record<string, number>;
  paths: string[];
}

/**
 * Builds virtual filesystem from project files
 */
export class ProjectBuilder {
  /**
   * Build virtual filesystem from files
   * @param files Project files
   * @param memfs MemFS instance
   */
  static buildVirtualFS(files: ProjectFile[], memfs: MemFS): void {
    logger.debug(`Building virtual FS with ${files.length} files`);

    // Create directory structure first
    const paths = files.map((f) => f.path);
    ProjectBuilder.createDirectoryStructure(paths, memfs);

    // Write all files
    ProjectBuilder.writeProjectFiles(files, memfs);

    logger.debug('Virtual FS built successfully');
  }

  /**
   * Create directory structure
   * @param paths File paths
   * @param memfs MemFS instance
   */
  private static createDirectoryStructure(paths: string[], memfs: MemFS): void {
    const dirs = new Set<string>();

    for (const path of paths) {
      // Extract directory from path
      const parts = path.split('/');
      parts.pop(); // Remove filename

      let currentDir = '';
      for (const part of parts) {
        if (part) {
          currentDir += '/' + part;
          dirs.add(currentDir);
        }
      }
    }

    // Create all directories
    for (const dir of dirs) {
      try {
        memfs.mkdir(dir, true);
        logger.debug(`Created directory: ${dir}`);
      } catch (error) {
        logger.warn(`Failed to create directory ${dir}:`, error);
      }
    }
  }

  /**
   * Write project files to MemFS
   * @param files Project files
   * @param memfs MemFS instance
   */
  private static writeProjectFiles(files: ProjectFile[], memfs: MemFS): void {
    for (const file of files) {
      try {
        memfs.write(file.path, file.code);
        logger.debug(`Wrote file: ${file.path}`);
      } catch (error) {
        throw new Error(`Failed to write file ${file.path}: ${error}`);
      }
    }
  }

  /**
   * Get project statistics
   * @param files Project files
   * @returns Project statistics
   */
  static getProjectStats(files: ProjectFile[]): ProjectStats {
    const languages: Record<string, number> = {};
    let totalSize = 0;

    for (const file of files) {
      const lang = file.language ?? 'javascript';
      languages[lang] = (languages[lang] ?? 0) + 1;
      totalSize += file.code.length;
    }

    return {
      fileCount: files.length,
      totalSize,
      languages,
      paths: files.map((f) => f.path),
    };
  }

  /**
   * Validate project files
   * @param files Project files
   * @returns Validation errors (empty array if valid)
   */
  static validateFiles(files: ProjectFile[]): string[] {
    const errors: string[] = [];

    if (!files || files.length === 0) {
      errors.push('Project must have at least one file');
      return errors;
    }

    const seenPaths = new Set<string>();

    for (const file of files) {
      // Check path
      if (!file.path) {
        errors.push('File path cannot be empty');
      } else if (!file.path.startsWith('/')) {
        errors.push(`File path must start with /: ${file.path}`);
      }

      // Check for duplicate paths
      if (seenPaths.has(file.path)) {
        errors.push(`Duplicate file path: ${file.path}`);
      }
      seenPaths.add(file.path);

      // Check code
      if (!file.code) {
        errors.push(`File ${file.path} cannot be empty`);
      }

      // Check language
      const lang = file.language ?? 'javascript';
      if (!['javascript', 'typescript'].includes(lang)) {
        errors.push(`Invalid language for ${file.path}: ${lang}`);
      }
    }

    return errors;
  }

  /**
   * Validate entrypoint exists
   * @param entrypoint Entrypoint path
   * @param files Project files
   * @returns Error message or empty string if valid
   */
  static validateEntrypoint(entrypoint: string, files: ProjectFile[]): string {
    if (!entrypoint) {
      return 'Entrypoint cannot be empty';
    }

    const exists = files.some((f) => f.path === entrypoint);
    if (!exists) {
      return `Entrypoint ${entrypoint} not found in project files`;
    }

    return '';
  }

  /**
   * Resolve entrypoint from project
   * @param project Project options
   * @returns Resolved entrypoint path
   */
  static resolveEntrypoint(project: ProjectOptions): string {
    // Use provided entrypoint if specified
    if (project.entrypoint) {
      return project.entrypoint;
    }

    // Try common entrypoint names
    const commonNames = ['index.js', 'index.ts', 'main.js', 'main.ts'];
    for (const name of commonNames) {
      const path = (project.baseDir || '') + '/' + name;
      const found = project.files.some((f) => f.path === path);
      if (found) {
        return path;
      }
    }

    // Use first file as entrypoint
    if (project.files.length > 0) {
      return project.files[0].path;
    }

    throw new Error('Cannot resolve entrypoint');
  }

  /**
   * Get file tree structure
   * @param files Project files
   * @returns Map of path → code
   */
  static buildFileTree(files: ProjectFile[]): Map<string, string> {
    const tree = new Map<string, string>();

    for (const file of files) {
      tree.set(file.path, file.code);
    }

    return tree;
  }

  /**
   * Get source of a file
   * @param path File path
   * @param files Project files
   * @returns File code or null
   */
  static getFileSource(path: string, files: ProjectFile[]): string | null {
    const file = files.find((f) => f.path === path);
    return file?.code ?? null;
  }

  /**
   * Get language of a file
   * @param path File path
   * @param files Project files
   * @returns Language or 'javascript'
   */
  static getFileLanguage(path: string, files: ProjectFile[]): string {
    const file = files.find((f) => f.path === path);
    return file?.language ?? 'javascript';
  }

  /**
   * Filter files by language
   * @param language Language to filter by
   * @param files Project files
   * @returns Filtered files
   */
  static filterByLanguage(language: string, files: ProjectFile[]): ProjectFile[] {
    return files.filter((f) => (f.language ?? 'javascript') === language);
  }

  /**
   * Filter files by path pattern
   * @param pattern Path pattern (wildcard support)
   * @param files Project files
   * @returns Filtered files
   */
  static filterByPattern(pattern: string, files: ProjectFile[]): ProjectFile[] {
    const regex = new RegExp(
      '^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$'
    );
    return files.filter((f) => regex.test(f.path));
  }

  /**
   * Get dependencies (imports/requires) from a file
   * @param code File code
   * @returns Array of module names
   */
  static getDependencies(code: string): string[] {
    const deps = new Set<string>();

    // Match require('...')
    const requirePattern = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    let match;
    while ((match = requirePattern.exec(code)) !== null) {
      deps.add(match[1]);
    }

    // Match import ... from '...'
    const importPattern = /import\s+.*from\s+['"]([^'"]+)['"]/g;
    while ((match = importPattern.exec(code)) !== null) {
      deps.add(match[1]);
    }

    // Match import('...')
    const dynamicPattern = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    while ((match = dynamicPattern.exec(code)) !== null) {
      deps.add(match[1]);
    }

    return Array.from(deps);
  }

  /**
   * Get all project dependencies
   * @param files Project files
   * @returns Map of file path → dependencies
   */
  static getAllDependencies(files: ProjectFile[]): Map<string, string[]> {
    const allDeps = new Map<string, string[]>();

    for (const file of files) {
      const deps = ProjectBuilder.getDependencies(file.code);
      allDeps.set(file.path, deps);
    }

    return allDeps;
  }
}
