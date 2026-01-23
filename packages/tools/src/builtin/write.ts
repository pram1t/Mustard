/**
 * Write Tool
 *
 * Writes content to files with support for:
 * - Creating parent directories automatically
 * - Overwriting existing files
 * - Error handling for permission issues
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { BaseTool } from '../base.js';
import { sanitizePath } from '../security.js';
import type { ToolResult, ExecutionContext, ToolParameters } from '../types.js';

/**
 * WriteTool - Writes content to files
 */
export class WriteTool extends BaseTool {
  readonly name = 'Write';
  readonly description = 'Writes content to a file. Creates parent directories if needed. Overwrites existing files.';
  readonly parameters: ToolParameters = {
    type: 'object',
    properties: {
      file_path: {
        type: 'string',
        description: 'The absolute path to the file to write',
      },
      content: {
        type: 'string',
        description: 'The content to write to the file',
      },
    },
    required: ['file_path', 'content'],
  };

  async execute(
    params: Record<string, unknown>,
    context: ExecutionContext
  ): Promise<ToolResult> {
    return this.safeExecute(params, context, async () => {
      const filePath = params.file_path as string;
      const content = params.content as string;

      // Resolve path (handle relative paths)
      const resolvedPath = path.isAbsolute(filePath)
        ? filePath
        : path.resolve(context.cwd, filePath);

      // Validate path for security (prevents path traversal and symlink attacks)
      const absolutePath = sanitizePath(resolvedPath, context.cwd);

      // Get the directory path
      const dirPath = path.dirname(absolutePath);

      // Create parent directories if they don't exist
      try {
        await fs.mkdir(dirPath, { recursive: true });
      } catch (error) {
        const err = error as NodeJS.ErrnoException;
        if (err.code !== 'EEXIST') {
          return this.failure(`Failed to create directory: ${dirPath} - ${err.message}`);
        }
      }

      // Check if file exists (for reporting)
      let fileExisted = false;
      try {
        await fs.access(absolutePath);
        fileExisted = true;
      } catch {
        // File doesn't exist, which is fine
      }

      // Write the file
      try {
        await fs.writeFile(absolutePath, content, 'utf-8');
      } catch (error) {
        const err = error as NodeJS.ErrnoException;
        return this.failure(`Failed to write file: ${absolutePath} - ${err.message}`);
      }

      // Get file stats for metadata
      const stats = await fs.stat(absolutePath);

      const action = fileExisted ? 'Updated' : 'Created';
      const lineCount = content.split('\n').length;

      return this.success(
        `${action} ${absolutePath} (${lineCount} lines, ${this.formatFileSize(stats.size)})`,
        {
          modifiedFiles: [absolutePath],
          path: absolutePath,
          action: fileExisted ? 'updated' : 'created',
          lineCount,
          size: stats.size,
        }
      );
    });
  }

  /**
   * Format file size in human-readable format
   */
  private formatFileSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(unitIndex > 0 ? 1 : 0)} ${units[unitIndex]}`;
  }
}
