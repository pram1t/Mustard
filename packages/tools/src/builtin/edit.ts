/**
 * Edit Tool
 *
 * Performs exact string replacements in files with support for:
 * - Single occurrence replacement (default)
 * - Replace all occurrences
 * - Uniqueness validation
 * - Deletion (empty new_string)
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { BaseTool } from '../base';
import type { ToolResult, ExecutionContext, ToolParameters } from '../types';

/**
 * EditTool - Performs exact string replacements in files
 */
export class EditTool extends BaseTool {
  readonly name = 'Edit';
  readonly description = 'Performs exact string replacements in files. The old_string must be unique in the file unless replace_all is true.';
  readonly parameters: ToolParameters = {
    type: 'object',
    properties: {
      file_path: {
        type: 'string',
        description: 'The absolute path to the file to modify',
      },
      old_string: {
        type: 'string',
        description: 'The text to replace (must be unique in the file unless replace_all is true)',
      },
      new_string: {
        type: 'string',
        description: 'The text to replace it with (can be empty for deletion)',
      },
      replace_all: {
        type: 'boolean',
        description: 'Replace all occurrences of old_string (default false)',
        default: false,
      },
    },
    required: ['file_path', 'old_string', 'new_string'],
  };

  async execute(
    params: Record<string, unknown>,
    context: ExecutionContext
  ): Promise<ToolResult> {
    return this.safeExecute(params, context, async () => {
      const filePath = params.file_path as string;
      const oldString = params.old_string as string;
      const newString = params.new_string as string;
      const replaceAll = (params.replace_all as boolean) || false;

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

      // Read current content
      let content: string;
      try {
        content = await fs.readFile(absolutePath, 'utf-8');
      } catch (error) {
        const err = error as NodeJS.ErrnoException;
        return this.failure(`Failed to read file: ${absolutePath} - ${err.message}`);
      }

      // Check if old_string exists in content
      if (!content.includes(oldString)) {
        return this.failure(
          `The string to replace was not found in ${absolutePath}.\n` +
          `Looking for:\n${this.truncate(oldString, 200)}`
        );
      }

      // Count occurrences
      const occurrenceCount = this.countOccurrences(content, oldString);

      // If not replace_all, verify uniqueness
      if (!replaceAll && occurrenceCount > 1) {
        return this.failure(
          `The string to replace appears ${occurrenceCount} times in ${absolutePath}. ` +
          `Either provide a more unique string with more context, or set replace_all to true.`
        );
      }

      // Perform replacement
      let newContent: string;
      if (replaceAll) {
        newContent = content.split(oldString).join(newString);
      } else {
        // Replace only the first occurrence
        const index = content.indexOf(oldString);
        newContent = content.substring(0, index) + newString + content.substring(index + oldString.length);
      }

      // Check if anything changed
      if (content === newContent) {
        return this.failure('No changes were made (old_string equals new_string)');
      }

      // Write the updated content
      try {
        await fs.writeFile(absolutePath, newContent, 'utf-8');
      } catch (error) {
        const err = error as NodeJS.ErrnoException;
        return this.failure(`Failed to write file: ${absolutePath} - ${err.message}`);
      }

      const replacementCount = replaceAll ? occurrenceCount : 1;
      const action = newString === '' ? 'Deleted' : 'Replaced';
      const countText = replacementCount === 1 ? '1 occurrence' : `${replacementCount} occurrences`;

      return this.success(
        `${action} ${countText} in ${absolutePath}`,
        {
          modifiedFiles: [absolutePath],
          path: absolutePath,
          replacementCount,
          oldStringLength: oldString.length,
          newStringLength: newString.length,
        }
      );
    });
  }

  /**
   * Count occurrences of a substring in a string
   */
  private countOccurrences(str: string, substr: string): number {
    let count = 0;
    let pos = 0;
    while ((pos = str.indexOf(substr, pos)) !== -1) {
      count++;
      pos += substr.length;
    }
    return count;
  }

  /**
   * Truncate a string for display
   */
  private truncate(str: string, maxLength: number): string {
    if (str.length <= maxLength) {
      return str;
    }
    return str.substring(0, maxLength) + '...';
  }
}
