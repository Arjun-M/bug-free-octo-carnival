/**
 * Helper to load multiple files into MemFS for a project.
 */

import type { ProjectOptions, ProjectFile } from '../core/types.js';
import { SandboxError } from '../core/types.js';
import { MemFS } from '../filesystem/MemFS.js';
import { logger } from '../utils/Logger.js';

export interface PreparedProject {
  entrypoint: string;
  files: ProjectFile[];
  fileCount: number;
  totalSize: number;
  hasTypeScript: boolean;
}

export interface ProjectStats {
  fileCount: number;
  totalSize: number;
  largestFile: { name: string; size: number };
  hasTypeScript: boolean;
  hasJavaScript: boolean;
}

export class ProjectLoader {
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
      const code = Buffer.isBuffer(file.code)
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
