/**
 * MultiEdit Tool
 *
 * Performs multiple string replacements in a single file in one operation.
 * More efficient than multiple Edit calls when making several changes.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { BaseTool } from '../base.js';
import type { ToolResult, ExecutionContext, ToolParameters } from '../types.js';

/**
 * Single edit operation
 */
interface EditOperation {
  old_string: string;
  new_string: string;
}

/**
 * MultiEditTool - Multiple edits in one operation
 */
export class MultiEditTool extends BaseTool {
  readonly name = 'MultiEdit';
  readonly description = `Perform multiple string replacements in a single file.

Use this when you need to make several edits to the same file - more efficient than multiple Edit calls.

Features:
- Validates all replacements before applying any
- Applies edits in order (earlier edits may affect later ones)
- Returns summary of all changes made

IMPORTANT: Each old_string must be unique in the file at the time of replacement.`;

  readonly parameters: ToolParameters = {
    type: 'object',
    properties: {
      file_path: {
        type: 'string',
        description: 'The absolute path to the file to edit',
      },
      edits: {
        type: 'array',
        description: 'Array of edit operations to perform in sequence',
        items: {
          type: 'object',
          properties: {
            old_string: {
              type: 'string',
              description: 'The exact text to find and replace',
            },
            new_string: {
              type: 'string',
              description: 'The text to replace it with',
            },
          },
          required: ['old_string', 'new_string'],
        },
      },
    },
    required: ['file_path', 'edits'],
  };

  async execute(
    params: Record<string, unknown>,
    context: ExecutionContext
  ): Promise<ToolResult> {
    return this.safeExecute(params, context, async () => {
      const filePath = params.file_path as string;
      const edits = params.edits as EditOperation[];

      if (!edits || edits.length === 0) {
        return this.failure('No edits provided');
      }

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

      // Read file content
      let content = await fs.readFile(absolutePath, 'utf-8');
      const originalContent = content;

      // Validate all edits first (check each old_string exists)
      const validationErrors: string[] = [];
      let tempContent = content;

      for (let i = 0; i < edits.length; i++) {
        const edit = edits[i];

        if (!edit.old_string) {
          validationErrors.push(`Edit ${i + 1}: old_string is empty`);
          continue;
        }

        if (edit.old_string === edit.new_string) {
          validationErrors.push(`Edit ${i + 1}: old_string and new_string are identical`);
          continue;
        }

        // Check if old_string exists in current state
        const occurrences = tempContent.split(edit.old_string).length - 1;

        if (occurrences === 0) {
          validationErrors.push(
            `Edit ${i + 1}: old_string not found in file (may have been changed by earlier edit)`
          );
          continue;
        }

        if (occurrences > 1) {
          validationErrors.push(
            `Edit ${i + 1}: old_string appears ${occurrences} times - must be unique. Provide more context.`
          );
          continue;
        }

        // Simulate the edit for validation of subsequent edits
        tempContent = tempContent.replace(edit.old_string, edit.new_string);
      }

      if (validationErrors.length > 0) {
        return this.failure(
          `Validation failed:\n${validationErrors.map(e => `  - ${e}`).join('\n')}`
        );
      }

      // Apply all edits
      const appliedEdits: string[] = [];

      for (let i = 0; i < edits.length; i++) {
        const edit = edits[i];
        content = content.replace(edit.old_string, edit.new_string);

        // Track what was changed (truncate long strings)
        const oldPreview = edit.old_string.length > 40
          ? edit.old_string.substring(0, 40) + '...'
          : edit.old_string;
        const newPreview = edit.new_string.length > 40
          ? edit.new_string.substring(0, 40) + '...'
          : edit.new_string;

        appliedEdits.push(`${i + 1}. "${oldPreview}" → "${newPreview}"`);
      }

      // Write the file
      await fs.writeFile(absolutePath, content, 'utf-8');

      // Calculate diff summary
      const linesChanged = content.split('\n').length - originalContent.split('\n').length;
      const linesDiff = linesChanged > 0 ? `+${linesChanged}` : `${linesChanged}`;

      const output = `Applied ${edits.length} edits to ${absolutePath}:\n\n${appliedEdits.join('\n')}\n\nLines changed: ${linesDiff}`;

      return this.success(output, {
        modifiedFiles: [absolutePath],
        editsApplied: edits.length,
        linesChanged,
      });
    });
  }
}
