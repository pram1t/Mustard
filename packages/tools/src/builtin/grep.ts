/**
 * Grep Tool
 *
 * Search for patterns in files with support for:
 * - Regular expressions
 * - Multiple output modes (content, files, count)
 * - Context lines (-A, -B, -C)
 * - Case insensitive search
 * - Glob filtering
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { BaseTool } from '../base.js';
import { validateRegexPattern } from '../security.js';
import type { ToolResult, ExecutionContext, ToolParameters } from '../types.js';

// Maximum files to search
const MAX_FILES = 500;

// Maximum results to return
const MAX_RESULTS = 100;

// Maximum output characters
const MAX_OUTPUT_CHARS = 50000;

/**
 * Simple glob pattern matching (reused from glob tool)
 */
function matchGlob(pattern: string, filePath: string): boolean {
  let regexStr = '^';

  for (let i = 0; i < pattern.length; i++) {
    const char = pattern[i];
    const nextChar = pattern[i + 1];

    if (char === '*' && nextChar === '*') {
      regexStr += '.*';
      i++;
      if (pattern[i + 1] === '/' || pattern[i + 1] === '\\') {
        i++;
      }
    } else if (char === '*') {
      regexStr += '[^/\\\\]*';
    } else if (char === '?') {
      regexStr += '[^/\\\\]';
    } else if (char === '/' || char === '\\') {
      regexStr += '[/\\\\]';
    } else if ('.^$+{}[]|()'.includes(char)) {
      regexStr += '\\' + char;
    } else {
      regexStr += char;
    }
  }

  regexStr += '$';

  try {
    const regex = new RegExp(regexStr, 'i');
    return regex.test(filePath);
  } catch {
    return false;
  }
}

/**
 * Recursively collect files from a directory
 */
async function collectFiles(
  dir: string,
  basePath: string,
  globPattern: string | undefined,
  files: string[],
  maxFiles: number
): Promise<void> {
  if (files.length >= maxFiles) return;

  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (files.length >= maxFiles) break;

    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (
        entry.name === 'node_modules' ||
        entry.name === '.git' ||
        entry.name === 'dist' ||
        entry.name === 'build' ||
        entry.name === '.next' ||
        entry.name === '__pycache__'
      ) {
        continue;
      }
      await collectFiles(fullPath, basePath, globPattern, files, maxFiles);
    } else {
      if (globPattern) {
        const relativePath = path.relative(basePath, fullPath).replace(/\\/g, '/');
        if (!matchGlob(globPattern, relativePath) && !matchGlob(globPattern, entry.name)) {
          continue;
        }
      }
      files.push(fullPath);
    }
  }
}

/**
 * Check if a file is likely text (not binary)
 */
async function isTextFile(filePath: string): Promise<boolean> {
  try {
    const buffer = Buffer.alloc(512);
    const fd = await fs.open(filePath, 'r');
    const { bytesRead } = await fd.read(buffer, 0, 512, 0);
    await fd.close();

    // Check for null bytes (common in binary files)
    for (let i = 0; i < bytesRead; i++) {
      if (buffer[i] === 0) return false;
    }
    return true;
  } catch {
    return false;
  }
}

interface Match {
  file: string;
  lineNum: number;
  line: string;
  contextBefore: string[];
  contextAfter: string[];
}

/**
 * GrepTool - Search for patterns in files
 */
export class GrepTool extends BaseTool {
  readonly name = 'Grep';
  readonly description = 'Search for patterns in files using regular expressions. Supports context lines, case-insensitive search, and multiple output modes.';
  readonly parameters: ToolParameters = {
    type: 'object',
    properties: {
      pattern: {
        type: 'string',
        description: 'The regular expression pattern to search for',
      },
      path: {
        type: 'string',
        description: 'File or directory to search in. Defaults to current directory.',
      },
      glob: {
        type: 'string',
        description: 'Glob pattern to filter files (e.g., "*.js", "**/*.ts")',
      },
      output_mode: {
        type: 'string',
        enum: ['content', 'files_with_matches', 'count'],
        description: 'Output mode: "content" shows matching lines, "files_with_matches" shows file paths (default), "count" shows match counts',
      },
      '-i': {
        type: 'boolean',
        description: 'Case insensitive search',
      },
      '-A': {
        type: 'number',
        description: 'Number of lines to show after each match',
      },
      '-B': {
        type: 'number',
        description: 'Number of lines to show before each match',
      },
      '-C': {
        type: 'number',
        description: 'Number of lines to show before and after each match',
      },
      '-n': {
        type: 'boolean',
        description: 'Show line numbers (default true for content mode)',
      },
      head_limit: {
        type: 'number',
        description: 'Limit output to first N results',
      },
      offset: {
        type: 'number',
        description: 'Skip first N results',
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
      const glob = params.glob as string | undefined;
      const outputMode = (params.output_mode as string) || 'files_with_matches';
      const caseInsensitive = params['-i'] as boolean;
      const afterContext = (params['-A'] as number) || (params['-C'] as number) || 0;
      const beforeContext = (params['-B'] as number) || (params['-C'] as number) || 0;
      const showLineNumbers = params['-n'] !== false;
      const headLimit = (params.head_limit as number) || MAX_RESULTS;
      const offset = (params.offset as number) || 0;

      // Validate regex pattern for ReDoS protection
      try {
        validateRegexPattern(pattern);
      } catch (error) {
        return this.failure(`Unsafe regex pattern: ${(error as Error).message}`);
      }

      // Create regex
      let regex: RegExp;
      try {
        regex = new RegExp(pattern, caseInsensitive ? 'gi' : 'g');
      } catch (error) {
        return this.failure(`Invalid regex pattern: ${(error as Error).message}`);
      }

      // Collect files to search
      const files: string[] = [];
      try {
        const stats = await fs.stat(searchPath);
        if (stats.isFile()) {
          files.push(searchPath);
        } else {
          await collectFiles(searchPath, searchPath, glob, files, MAX_FILES);
        }
      } catch {
        return this.failure(`Path not found: ${searchPath}`);
      }

      if (files.length === 0) {
        return this.success('No files to search', { matchCount: 0 });
      }

      // Search files
      const matches: Match[] = [];
      const fileCounts: Map<string, number> = new Map();
      const filesWithMatches: Set<string> = new Set();

      for (const file of files) {
        if (matches.length >= MAX_RESULTS + offset) break;

        // Skip binary files
        if (!(await isTextFile(file))) continue;

        try {
          const content = await fs.readFile(file, 'utf-8');
          const lines = content.split('\n');

          for (let i = 0; i < lines.length; i++) {
            if (matches.length >= MAX_RESULTS + offset) break;

            const line = lines[i];
            regex.lastIndex = 0;

            if (regex.test(line)) {
              filesWithMatches.add(file);
              fileCounts.set(file, (fileCounts.get(file) || 0) + 1);

              if (outputMode === 'content') {
                // Collect context lines
                const contextBefore: string[] = [];
                const contextAfter: string[] = [];

                for (let j = Math.max(0, i - beforeContext); j < i; j++) {
                  contextBefore.push(lines[j]);
                }

                for (let j = i + 1; j <= Math.min(lines.length - 1, i + afterContext); j++) {
                  contextAfter.push(lines[j]);
                }

                matches.push({
                  file,
                  lineNum: i + 1,
                  line,
                  contextBefore,
                  contextAfter,
                });
              }
            }
          }
        } catch {
          // Skip files that can't be read
          continue;
        }
      }

      // Apply offset and limit, then format output
      let output: string;

      switch (outputMode) {
        case 'content': {
          const sliced = matches.slice(offset, offset + headLimit);
          const lines: string[] = [];

          for (const match of sliced) {
            if (match.contextBefore.length > 0) {
              const startLine = match.lineNum - match.contextBefore.length;
              match.contextBefore.forEach((line, idx) => {
                if (showLineNumbers) {
                  lines.push(`${match.file}:${startLine + idx}-${line}`);
                } else {
                  lines.push(`${match.file}-${line}`);
                }
              });
            }

            if (showLineNumbers) {
              lines.push(`${match.file}:${match.lineNum}:${match.line}`);
            } else {
              lines.push(`${match.file}:${match.line}`);
            }

            if (match.contextAfter.length > 0) {
              match.contextAfter.forEach((line, idx) => {
                if (showLineNumbers) {
                  lines.push(`${match.file}:${match.lineNum + 1 + idx}-${line}`);
                } else {
                  lines.push(`${match.file}-${line}`);
                }
              });
            }

            // Add separator between matches from different files or non-consecutive lines
            if (sliced.indexOf(match) < sliced.length - 1) {
              lines.push('--');
            }
          }

          output = lines.join('\n');
          break;
        }

        case 'files_with_matches': {
          const fileList = Array.from(filesWithMatches);
          const sliced = fileList.slice(offset, offset + headLimit);
          output = sliced.join('\n');
          break;
        }

        case 'count': {
          const entries = Array.from(fileCounts.entries());
          const sliced = entries.slice(offset, offset + headLimit);
          output = sliced.map(([file, count]) => `${file}:${count}`).join('\n');
          break;
        }

        default:
          output = Array.from(filesWithMatches).slice(offset, offset + headLimit).join('\n');
      }

      // Truncate if too long
      if (output.length > MAX_OUTPUT_CHARS) {
        output = output.substring(0, MAX_OUTPUT_CHARS) + '\n...[output truncated]';
      }

      if (filesWithMatches.size === 0) {
        return this.success(`No matches found for pattern: ${pattern}`, {
          matchCount: 0,
          filesSearched: files.length,
        });
      }

      return this.success(output, {
        matchCount: matches.length || filesWithMatches.size,
        filesWithMatches: filesWithMatches.size,
        filesSearched: files.length,
        tokensUsed: this.estimateTokens(output),
      });
    });
  }
}
