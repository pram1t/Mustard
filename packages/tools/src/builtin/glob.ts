/**
 * Glob Tool
 *
 * Fast file pattern matching with support for:
 * - Standard glob patterns (**, *, ?)
 * - Directory filtering
 * - Modification time sorting
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { BaseTool } from '../base.js';
import type { ToolResult, ExecutionContext, ToolParameters } from '../types.js';

// Maximum number of results to return
const MAX_RESULTS = 1000;

/**
 * Simple glob pattern matching
 * Supports: ** (any path), * (any chars), ? (single char)
 */
function matchGlob(pattern: string, filePath: string): boolean {
  // Convert glob pattern to regex
  let regexStr = '^';

  for (let i = 0; i < pattern.length; i++) {
    const char = pattern[i];
    const nextChar = pattern[i + 1];

    if (char === '*' && nextChar === '*') {
      // ** matches any path including /
      regexStr += '.*';
      i++; // Skip next *

      // Skip trailing / after **
      if (pattern[i + 1] === '/' || pattern[i + 1] === '\\') {
        i++;
      }
    } else if (char === '*') {
      // * matches any characters except /
      regexStr += '[^/\\\\]*';
    } else if (char === '?') {
      // ? matches single character except /
      regexStr += '[^/\\\\]';
    } else if (char === '/' || char === '\\') {
      // Normalize path separators
      regexStr += '[/\\\\]';
    } else if ('.^$+{}[]|()'.includes(char)) {
      // Escape regex special characters
      regexStr += '\\' + char;
    } else {
      regexStr += char;
    }
  }

  regexStr += '$';

  try {
    // Use case-insensitive matching only on Windows (where filesystem is case-insensitive)
    // Unix filesystems are case-sensitive
    const isWindows = process.platform === 'win32';
    const regex = new RegExp(regexStr, isWindows ? 'i' : '');
    return regex.test(filePath);
  } catch {
    return false;
  }
}

/**
 * Recursively walk directory and find matching files
 */
async function walkDir(
  dir: string,
  pattern: string,
  basePath: string,
  results: { path: string; mtime: number }[],
  maxResults: number
): Promise<void> {
  if (results.length >= maxResults) {
    return;
  }

  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    // Skip directories we can't read
    return;
  }

  for (const entry of entries) {
    if (results.length >= maxResults) {
      break;
    }

    const fullPath = path.join(dir, entry.name);
    const relativePath = path.relative(basePath, fullPath);

    // Skip common directories to ignore
    if (entry.isDirectory()) {
      if (
        entry.name === 'node_modules' ||
        entry.name === '.git' ||
        entry.name === 'dist' ||
        entry.name === 'build' ||
        entry.name === '.next' ||
        entry.name === '__pycache__' ||
        entry.name === '.venv' ||
        entry.name === 'venv'
      ) {
        continue;
      }

      // Recurse into subdirectory
      await walkDir(fullPath, pattern, basePath, results, maxResults);
    } else {
      // Check if file matches pattern
      // Normalize path separators for matching
      const normalizedPath = relativePath.replace(/\\/g, '/');
      if (matchGlob(pattern, normalizedPath)) {
        try {
          const stats = await fs.stat(fullPath);
          results.push({
            path: fullPath,
            mtime: stats.mtimeMs,
          });
        } catch {
          // Skip files we can't stat
        }
      }
    }
  }
}

/**
 * GlobTool - Find files matching glob patterns
 */
export class GlobTool extends BaseTool {
  readonly name = 'Glob';
  readonly description = 'Fast file pattern matching. Supports patterns like "**/*.ts" or "src/**/*.tsx". Returns matching file paths sorted by modification time.';
  readonly parameters: ToolParameters = {
    type: 'object',
    properties: {
      pattern: {
        type: 'string',
        description: 'The glob pattern to match files against (e.g., "**/*.ts")',
      },
      path: {
        type: 'string',
        description: 'The directory to search in. Defaults to current working directory.',
      },
    },
    required: ['pattern'],
  };

  async execute(
    params: Record<string, unknown>,
    context: ExecutionContext
  ): Promise<ToolResult> {
    return this.safeExecute(params, context, async () => {
      const pattern = params.pattern as string;
      const searchPath = params.path
        ? path.isAbsolute(params.path as string)
          ? params.path as string
          : path.resolve(context.cwd, params.path as string)
        : context.cwd;

      // Check if search path exists
      try {
        const stats = await fs.stat(searchPath);
        if (!stats.isDirectory()) {
          return this.failure(`Path is not a directory: ${searchPath}`);
        }
      } catch {
        return this.failure(`Directory not found: ${searchPath}`);
      }

      // Find matching files
      const results: { path: string; mtime: number }[] = [];
      await walkDir(searchPath, pattern, searchPath, results, MAX_RESULTS);

      // Sort by modification time (newest first)
      results.sort((a, b) => b.mtime - a.mtime);

      // Format output
      const paths = results.map((r) => r.path);

      if (paths.length === 0) {
        return this.success(`No files found matching pattern: ${pattern}`, {
          matchCount: 0,
          searchPath,
        });
      }

      const output = paths.join('\n');
      const truncated = results.length >= MAX_RESULTS;

      return this.success(output, {
        matchCount: paths.length,
        searchPath,
        pattern,
        truncated,
        tokensUsed: this.estimateTokens(output),
      });
    });
  }
}
