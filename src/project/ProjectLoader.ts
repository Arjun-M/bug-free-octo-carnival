/**
 * @file src/project/ProjectLoader.ts
 * @description Helper to load multiple files into MemFS for a project with validation and statistics
 * @since 1.0.0
 * @copyright Copyright (c) 2025 Arjun-M. This source code is licensed under the MIT license.
 */

import type { ProjectOptions, ProjectFile } from '../core/types.js';
import { SandboxError } from '../core/types.js';
import { MemFS } from '../filesystem/MemFS.js';
import { logger } from '../utils/Logger.js';

/**
 * Prepared project information after initial loading
 */
export interface PreparedProject {
  entrypoint: string;
  files: ProjectFile[];
  fileCount: number;
  totalSize: number;
  hasTypeScript: boolean;
}

/**
 * Statistical information about a project's files
 */
export interface ProjectStats {
  fileCount: number;
  totalSize: number;
  largestFile: { name: string; size: number };
  hasTypeScript: boolean;
  hasJavaScript: boolean;
}

/**
 * @class ProjectLoader
 * Handles loading, validation, and preparation of multi-file projects for execution.
 * Provides utilities for analyzing project structure and writing files to virtual filesystem.
 *
 * @example
 * ```typescript
 * // Load a project
 * const prepared = ProjectLoader.loadProject({
 *   entrypoint: '/index.js',
 *   files: [
 *     { path: '/index.js', code: 'console.log("Hello")', language: 'javascript' }
 *   ]
 * });
 *
 * // Get project statistics
 * const stats = ProjectLoader.getProjectStats(project);
 * console.log(`Project has ${stats.fileCount} files`);
 * ```
 */
export class ProjectLoader {
  /**
   * Load and prepare a project for execution
   * @param project - Project options containing files and entrypoint
   * @returns Prepared project with metadata
   * @throws {SandboxError} If project validation fails
   *
   * @example
   * ```typescript
   * const prepared = ProjectLoader.loadProject({
   *   entrypoint: '/main.ts',
   *   files: [{ path: '/main.ts', code: 'const x = 1;', language: 'typescript' }]
   * });
   * ```
   */
  static loadProject(project: ProjectOptions): PreparedProject {
    this.validateProject(project);

    const hasTypeScript = project.files.some(
      (f) => f.language === 'typescript' || f.language === 'ts'
    );

    const totalSize = project.files.reduce((sum, f) => {
      const size = Buffer.isBuffer(f.code)
        ? (f.code as Buffer).length
        : (f.code as string).length;
      return sum + size;
    }, 0);

    return {
      entrypoint: project.entrypoint,
      files: project.files,
      fileCount: project.files.length,
      totalSize,
      hasTypeScript,
    };
  }

  /**
   * Validate project structure and files
   * @param project - Project to validate
   * @throws {SandboxError} If validation fails (empty project, missing entrypoint, duplicate files, etc.)
   *
   * @example
   * ```typescript
   * ProjectLoader.validateProject({
   *   entrypoint: '/index.js',
   *   files: [{ path: '/index.js', code: 'console.log("test")' }]
   * });
   * ```
   */
  static validateProject(project: ProjectOptions): void {
    if (!project.files || project.files.length === 0) {
      throw new SandboxError(
        'Project empty',
        'EMPTY_PROJECT'
      );
    }

    if (!project.entrypoint) {
      throw new SandboxError(
        'No entrypoint',
        'NO_ENTRYPOINT'
      );
    }

    const entrypointExists = project.files.some(
      (f) => f.path === project.entrypoint
    );

    if (!entrypointExists) {
      throw new SandboxError(
        `Entrypoint not found: ${project.entrypoint}`,
        'ENTRYPOINT_NOT_FOUND',
        { entrypoint: project.entrypoint }
      );
    }

    const paths = new Set<string>();
    for (const file of project.files) {
      if (!file.path) {
        throw new SandboxError(
          'Missing file path',
          'INVALID_FILE_PATH'
        );
      }

      if (!file.code) {
        throw new SandboxError(
          `Empty file code: ${file.path}`,
          'EMPTY_FILE_CODE'
        );
      }

      if (paths.has(file.path)) {
        throw new SandboxError(
          `Duplicate path: ${file.path}`,
          'DUPLICATE_FILE'
        );
      }

      paths.add(file.path);
    }

    logger.debug(
      `Project validated (${project.files.length} files)`
    );
  }

  /**
   * Write all project files to the virtual filesystem
   * Creates necessary directories and writes file contents
   * @param project - Project containing files to write
   * @param memfs - Virtual filesystem instance
   * @throws {SandboxError} If file write fails
   *
   * @example
   * ```typescript
   * const memfs = new MemFS();
   * ProjectLoader.writeProjectFiles(project, memfs);
   * ```
   */
  static writeProjectFiles(project: ProjectOptions, memfs: MemFS): void {
    const directories = new Set<string>();

    for (const file of project.files) {
      const parts = file.path.split('/').filter((p) => p);
      let path = '';

      for (let i = 0; i < parts.length - 1; i++) {
        path += '/' + parts[i];
        directories.add(path);
      }
    }

    for (const dir of directories) {
      try {
        memfs.mkdir(dir, true);
      } catch {
        // Ignore exists
      }
    }

    for (const file of project.files) {
      // MAJOR FIX: Ensure code is passed as string or Buffer, not just string
      const code: string | Buffer = Buffer.isBuffer(file.code)
        ? file.code
        : file.code as string;

      try {
        memfs.write(file.path, code);
      } catch (error) {
        throw new SandboxError(
          `Write failed: ${file.path}`,
          'FILE_WRITE_ERROR',
          {
            path: file.path,
            error: error instanceof Error ? error.message : String(error),
          }
        );
      }
    }
  }

  /**
   * Get statistical information about a project
   * @param project - Project to analyze
   * @param _memfs - Unused parameter for signature compatibility
   * @returns Statistics including file count, sizes, and language distribution
   *
   * @example
   * ```typescript
   * const stats = ProjectLoader.getProjectStats(project);
   * console.log(`Largest file: ${stats.largestFile.name} (${stats.largestFile.size} bytes)`);
   * ```
   */
  static getProjectStats(
    project: ProjectOptions,
    _memfs?: MemFS // Unused param, marked with underscore or remove. Keeping underscore for signature compat if needed.
  ): ProjectStats {
    let largestFile = { name: '', size: 0 };
    let totalSize = 0;
    let hasTypeScript = false;
    let hasJavaScript = false;

    for (const file of project.files) {
      const language = file.language || 'javascript';
      const codeSize = Buffer.isBuffer(file.code)
        ? (file.code as Buffer).length
        : (file.code as string).length;

      totalSize += codeSize;

      if (codeSize > largestFile.size) {
        largestFile = { name: file.path, size: codeSize };
      }

      if (language === 'typescript' || language === 'ts') {
        hasTypeScript = true;
      } else {
        hasJavaScript = true;
      }
    }

    return {
      fileCount: project.files.length,
      totalSize,
      largestFile,
      hasTypeScript,
      hasJavaScript,
    };
  }

  /**
   * Build a map of file paths to their source code
   * @param files - Array of project files
   * @returns Map with file paths as keys and source code as values
   *
   * @example
   * ```typescript
   * const tree = ProjectLoader.buildFileTree(project.files);
   * const indexCode = tree.get('/index.js');
   * ```
   */
  static buildFileTree(files: ProjectFile[]): Map<string, string> {
    const tree = new Map<string, string>();

    for (const file of files) {
      // MAJOR FIX: buildFileTree should only be used for source code (text),
      // so converting Buffer to string is acceptable, but should use 'utf8' encoding.
      const code = Buffer.isBuffer(file.code)
        ? file.code.toString('utf8')
        : (file.code as string);

      tree.set(file.path, code);
    }

    return tree;
  }
}
