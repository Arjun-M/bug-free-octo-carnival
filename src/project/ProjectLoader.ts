/**
 * @fileoverview Multi-file project loading and execution
 */

import type { ProjectOptions, ProjectFile } from '../core/types.js';
import { SandboxError } from '../core/types.js';
import { MemFS } from '../filesystem/MemFS.js';
import { logger } from '../utils/Logger.js';

/**
 * Prepared project ready for execution
 */
export interface PreparedProject {
  entrypoint: string;
  files: ProjectFile[];
  fileCount: number;
  totalSize: number;
  hasTypeScript: boolean;
}

/**
 * Project statistics
 */
export interface ProjectStats {
  fileCount: number;
  totalSize: number;
  largestFile: { name: string; size: number };
  hasTypeScript: boolean;
  hasJavaScript: boolean;
}

/**
 * Loads and validates multi-file projects
 */
export class ProjectLoader {
  /**
   * Load and validate a project
   * @param project Project options
   * @returns Prepared project
   */
  static loadProject(project: ProjectOptions): PreparedProject {
    // Validate project
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
   * Validate project configuration
   * @param project Project to validate
   */
  static validateProject(project: ProjectOptions): void {
    if (!project.files || project.files.length === 0) {
      throw new SandboxError(
        'Project must have at least one file',
        'EMPTY_PROJECT'
      );
    }

    if (!project.entrypoint) {
      throw new SandboxError(
        'Project must specify entrypoint',
        'NO_ENTRYPOINT'
      );
    }

    // Check entrypoint exists
    const entrypointExists = project.files.some(
      (f) => f.path === project.entrypoint
    );

    if (!entrypointExists) {
      throw new SandboxError(
        `Entrypoint file not found: ${project.entrypoint}`,
        'ENTRYPOINT_NOT_FOUND',
        { entrypoint: project.entrypoint }
      );
    }

    // Validate file paths
    const paths = new Set<string>();
    for (const file of project.files) {
      if (!file.path) {
        throw new SandboxError(
          'Project file must have a path',
          'INVALID_FILE_PATH'
        );
      }

      if (!file.code) {
        throw new SandboxError(
          `Project file ${file.path} has no code`,
          'EMPTY_FILE_CODE'
        );
      }

      if (paths.has(file.path)) {
        throw new SandboxError(
          `Duplicate file path: ${file.path}`,
          'DUPLICATE_FILE'
        );
      }

      paths.add(file.path);
    }

    logger.debug(
      `Project validated: ${project.files.length} files, entrypoint: ${project.entrypoint}`
    );
  }

  /**
   * Write project files to MemFS
   * @param project Project options
   * @param memfs Virtual filesystem
   */
  static writeProjectFiles(project: ProjectOptions, memfs: MemFS): void {
    // Create directory structure first
    const directories = new Set<string>();

    for (const file of project.files) {
      const parts = file.path.split('/').filter((p) => p);
      let path = '';

      for (let i = 0; i < parts.length - 1; i++) {
        path += '/' + parts[i];
        directories.add(path);
      }
    }

    // Create directories
    for (const dir of directories) {
      try {
        memfs.mkdir(dir, true);
      } catch {
        // Directory may already exist
      }
    }

    // Write files
    for (const file of project.files) {
      const code = Buffer.isBuffer(file.code)
        ? file.code
        : file.code as string;

      try {
        memfs.write(file.path, code);
        logger.debug(`Wrote project file: ${file.path}`);
      } catch (error) {
        throw new SandboxError(
          `Failed to write file: ${file.path}`,
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
   * Get project statistics
   * @param project Project options
   * @param memfs Virtual filesystem
   * @returns Project statistics
   */
  static getProjectStats(
    project: ProjectOptions,
    memfs: MemFS
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
   * Build file tree for project
   * @param files Project files
   * @returns Map of path to code
   */
  static buildFileTree(files: ProjectFile[]): Map<string, string> {
    const tree = new Map<string, string>();

    for (const file of files) {
      const code = Buffer.isBuffer(file.code)
        ? file.code.toString()
        : (file.code as string);

      tree.set(file.path, code);
    }

    return tree;
  }
}
