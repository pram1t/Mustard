/**
 * Read Tool
 *
 * Reads files from the filesystem with support for:
 * - Line offset and limit for large files
 * - Line numbers (cat -n style)
 * - Binary file detection
 * - Long line truncation
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { BaseTool } from '../base';
import type { ToolResult, ExecutionContext, ToolParameters } from '../types';

// Maximum characters per line before truncation
const MAX_LINE_LENGTH = 2000;

// Default number of lines to read
const DEFAULT_LIMIT = 2000;

// Buffer size for binary detection
const BINARY_CHECK_SIZE = 8192;

/**
 * Detects if a buffer likely contains binary content
 */
function isBinaryBuffer(buffer: Buffer): boolean {
  // Check for null bytes (common in binary files)
  for (let i = 0; i < Math.min(buffer.length, BINARY_CHECK_SIZE); i++) {
    if (buffer[i] === 0) {
      return true;
    }
  }
  return false;
}

/**
 * Gets file extension in lowercase
 */
function getExtension(filePath: string): string {
  return path.extname(filePath).toLowerCase();
}

/**
 * Known binary file extensions
 */
const BINARY_EXTENSIONS = new Set([
  // Images
  '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.webp', '.svg', '.tiff', '.tif',
  // Audio
  '.mp3', '.wav', '.ogg', '.flac', '.aac', '.m4a',
  // Video
  '.mp4', '.avi', '.mkv', '.mov', '.wmv', '.flv', '.webm',
  // Archives
  '.zip', '.tar', '.gz', '.bz2', '.7z', '.rar', '.xz',
  // Executables
  '.exe', '.dll', '.so', '.dylib', '.bin',
  // Documents (binary)
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  // Other
  '.wasm', '.pyc', '.class', '.o', '.obj',
]);

/**
 * Image extensions that could be displayed with vision
 */
const IMAGE_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp',
]);

/**
 * ReadTool - Reads file contents from the filesystem
 */
export class ReadTool extends BaseTool {
  readonly name = 'Read';
  readonly description = 'Reads a file from the local filesystem. Returns file contents with line numbers.';
  readonly parameters: ToolParameters = {
    type: 'object',
    properties: {
      file_path: {
        type: 'string',
        description: 'The absolute path to the file to read',
      },
      offset: {
        type: 'number',
        description: 'The line number to start reading from (1-indexed). Only provide if the file is too large to read at once.',
      },
      limit: {
        type: 'number',
        description: 'The number of lines to read. Only provide if the file is too large to read at once.',
      },
    },
    required: ['file_path'],
  };

  async execute(
    params: Record<string, unknown>,
    context: ExecutionContext
  ): Promise<ToolResult> {
    return this.safeExecute(params, context, async () => {
      const filePath = params.file_path as string;
      const offset = (params.offset as number) || 1;
      const limit = (params.limit as number) || DEFAULT_LIMIT;

      // Resolve path (handle relative paths)
      const absolutePath = path.isAbsolute(filePath)
        ? filePath
        : path.resolve(context.cwd, filePath);

      // Check if file exists
      try {
        await fs.access(absolutePath);
      } catch {
        return this.failure(`File not found: ${absolutePath}`);
      }

      // Get file stats
      const stats = await fs.stat(absolutePath);

      if (stats.isDirectory()) {
        return this.failure(`Path is a directory, not a file: ${absolutePath}`);
      }

      // Check for binary by extension first
      const ext = getExtension(absolutePath);

      if (IMAGE_EXTENSIONS.has(ext)) {
        return this.success(
          `[Image file: ${absolutePath}]\n` +
          `Size: ${this.formatFileSize(stats.size)}\n` +
          `Note: This is an image file. Use vision capabilities to view it.`,
          { type: 'image', path: absolutePath }
        );
      }

      if (BINARY_EXTENSIONS.has(ext)) {
        return this.success(
          `[Binary file: ${absolutePath}]\n` +
          `Size: ${this.formatFileSize(stats.size)}\n` +
          `Type: ${ext} file`,
          { type: 'binary', path: absolutePath }
        );
      }

      // Read file content
      const buffer = await fs.readFile(absolutePath);

      // Check for binary content
      if (isBinaryBuffer(buffer)) {
        return this.success(
          `[Binary file: ${absolutePath}]\n` +
          `Size: ${this.formatFileSize(stats.size)}\n` +
          `Note: This file appears to contain binary data.`,
          { type: 'binary', path: absolutePath }
        );
      }

      // Convert to string and split into lines
      const content = buffer.toString('utf-8');
      const allLines = content.split('\n');
      const totalLines = allLines.length;

      // Calculate line range (offset is 1-indexed)
      const startLine = Math.max(1, offset) - 1; // Convert to 0-indexed
      const endLine = Math.min(startLine + limit, totalLines);

      // Extract lines in range
      const selectedLines = allLines.slice(startLine, endLine);

      // Format with line numbers (cat -n style)
      const formattedLines = selectedLines.map((line, index) => {
        const lineNum = startLine + index + 1; // 1-indexed line number
        const truncatedLine = line.length > MAX_LINE_LENGTH
          ? line.substring(0, MAX_LINE_LENGTH) + '...[truncated]'
          : line;

        // Right-align line numbers with padding, followed by tab
        const lineNumStr = String(lineNum).padStart(6, ' ');
        return `${lineNumStr}\t${truncatedLine}`;
      });

      const output = formattedLines.join('\n');

      // Add metadata about what was read
      const metadata: Record<string, unknown> = {
        path: absolutePath,
        totalLines,
        linesRead: selectedLines.length,
        startLine: startLine + 1,
        endLine: endLine,
        tokensUsed: this.estimateTokens(output),
      };

      // Add note if file was truncated
      if (endLine < totalLines) {
        metadata.truncated = true;
        metadata.remainingLines = totalLines - endLine;
      }

      // Handle empty file
      if (content.length === 0) {
        return this.success('[Empty file]', metadata);
      }

      return this.success(output, metadata);
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
