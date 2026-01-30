/**
 * DiffTool
 *
 * Show unified diff of file changes.
 * Beyond Claude Code - provides structured diff output.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { BaseTool } from '../base.js';
import type { ToolResult, ExecutionContext, ToolParameters } from '../types.js';

const execAsync = promisify(exec);

/**
 * DiffTool - Show file diffs
 */
export class DiffTool extends BaseTool {
  readonly name = 'Diff';
  readonly description = `Show unified diff of file changes.

Use this to:
- See changes since last commit
- Compare with specific commits or branches
- Review modifications before committing

Output formats:
- unified (default): Standard diff format
- json: Structured diff with additions/deletions`;

  readonly parameters: ToolParameters = {
    type: 'object',
    properties: {
      file_path: {
        type: 'string',
        description: 'The file to show diff for',
      },
      base: {
        type: 'string',
        description: 'Base version to compare against (commit hash, branch, HEAD~1, etc.). Default: working tree vs index.',
      },
      format: {
        type: 'string',
        description: 'Output format: "unified" (default) or "json"',
        enum: ['unified', 'json'],
        default: 'unified',
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
      const base = params.base as string | undefined;
      const format = (params.format as 'unified' | 'json') || 'unified';

      // Resolve path
      const absolutePath = path.isAbsolute(filePath)
        ? filePath
        : path.resolve(context.cwd, filePath);

      // Check if file exists
      try {
        await fs.access(absolutePath);
      } catch {
        return this.failure(`File not found: ${absolutePath}`);
      }

      // Check if we're in a git repository
      try {
        await execAsync('git rev-parse --git-dir', { cwd: context.cwd });
      } catch {
        // Not a git repo - try to show diff using file comparison
        return this.failure(
          'Not in a git repository. Diff requires git for version comparison.\n' +
          'To see changes, initialize git or compare files manually.'
        );
      }

      // Build git diff command
      let diffCommand: string;
      const relativePath = path.relative(context.cwd, absolutePath);

      if (base) {
        // Compare with specific base
        diffCommand = `git diff ${base} -- "${relativePath}"`;
      } else {
        // Show unstaged changes
        diffCommand = `git diff -- "${relativePath}"`;
      }

      try {
        const { stdout, stderr } = await execAsync(diffCommand, {
          cwd: context.cwd,
          maxBuffer: 10 * 1024 * 1024, // 10MB buffer
        });

        if (!stdout.trim()) {
          // No diff - check if file is staged
          const stagedCheck = await execAsync(
            `git diff --cached -- "${relativePath}"`,
            { cwd: context.cwd }
          );

          if (stagedCheck.stdout.trim()) {
            return this.success(
              `No unstaged changes for ${relativePath}.\n\n` +
              `Staged changes:\n\`\`\`diff\n${stagedCheck.stdout}\n\`\`\``,
              { hasChanges: true, staged: true }
            );
          }

          return this.success(
            `No changes detected for ${relativePath}${base ? ` compared to ${base}` : ''}.`,
            { hasChanges: false }
          );
        }

        if (format === 'json') {
          // Parse diff into structured format
          const structured = this.parseDiff(stdout);
          return this.success(
            JSON.stringify(structured, null, 2),
            { hasChanges: true, format: 'json', ...structured.summary }
          );
        }

        // Unified format
        return this.success(
          `Diff for ${relativePath}${base ? ` (vs ${base})` : ''}:\n\n\`\`\`diff\n${stdout}\n\`\`\``,
          {
            hasChanges: true,
            format: 'unified',
            base: base || 'working-tree',
          }
        );
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);

        // Check if it's a "not in git" error for the file
        if (errorMessage.includes('not in the working tree')) {
          return this.failure(
            `File ${relativePath} is not tracked by git.\n` +
            'Use "git add" to start tracking, or compare manually.'
          );
        }

        return this.failure(`Failed to get diff: ${errorMessage}`);
      }
    });
  }

  /**
   * Parse unified diff into structured format
   */
  private parseDiff(diff: string): {
    hunks: Array<{
      oldStart: number;
      oldCount: number;
      newStart: number;
      newCount: number;
      lines: Array<{ type: 'add' | 'remove' | 'context'; content: string }>;
    }>;
    summary: {
      additions: number;
      deletions: number;
      hunks: number;
    };
  } {
    const hunks: Array<{
      oldStart: number;
      oldCount: number;
      newStart: number;
      newCount: number;
      lines: Array<{ type: 'add' | 'remove' | 'context'; content: string }>;
    }> = [];

    let additions = 0;
    let deletions = 0;

    // Split into hunks by @@ markers
    const hunkPattern = /@@ -(\d+),?(\d*) \+(\d+),?(\d*) @@/g;
    const lines = diff.split('\n');

    let currentHunk: typeof hunks[0] | null = null;

    for (const line of lines) {
      const hunkMatch = line.match(/@@ -(\d+),?(\d*) \+(\d+),?(\d*) @@/);

      if (hunkMatch) {
        if (currentHunk) {
          hunks.push(currentHunk);
        }

        currentHunk = {
          oldStart: parseInt(hunkMatch[1], 10),
          oldCount: parseInt(hunkMatch[2] || '1', 10),
          newStart: parseInt(hunkMatch[3], 10),
          newCount: parseInt(hunkMatch[4] || '1', 10),
          lines: [],
        };
      } else if (currentHunk) {
        if (line.startsWith('+') && !line.startsWith('+++')) {
          currentHunk.lines.push({ type: 'add', content: line.substring(1) });
          additions++;
        } else if (line.startsWith('-') && !line.startsWith('---')) {
          currentHunk.lines.push({ type: 'remove', content: line.substring(1) });
          deletions++;
        } else if (line.startsWith(' ')) {
          currentHunk.lines.push({ type: 'context', content: line.substring(1) });
        }
      }
    }

    if (currentHunk) {
      hunks.push(currentHunk);
    }

    return {
      hunks,
      summary: {
        additions,
        deletions,
        hunks: hunks.length,
      },
    };
  }
}
