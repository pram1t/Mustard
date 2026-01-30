/**
 * NotebookEdit Tool
 *
 * Edit Jupyter notebook (.ipynb) cells.
 * Supports replacing, inserting, and deleting cells.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { BaseTool } from '../base.js';
import type { ToolResult, ExecutionContext, ToolParameters } from '../types.js';

/**
 * Jupyter notebook cell structure
 */
interface NotebookCell {
  id?: string;
  cell_type: 'code' | 'markdown' | 'raw';
  source: string | string[];
  metadata: Record<string, unknown>;
  outputs?: unknown[];
  execution_count?: number | null;
}

/**
 * Jupyter notebook structure
 */
interface JupyterNotebook {
  nbformat: number;
  nbformat_minor: number;
  metadata: Record<string, unknown>;
  cells: NotebookCell[];
}

/**
 * Generate a unique cell ID
 */
function generateCellId(): string {
  return Math.random().toString(36).substring(2, 10);
}

/**
 * Normalize cell source to array of strings
 */
function normalizeSource(source: string): string[] {
  // Split by newlines but preserve them
  const lines = source.split('\n');
  return lines.map((line, i) => i < lines.length - 1 ? line + '\n' : line);
}

/**
 * NotebookEditTool - Edit Jupyter notebook cells
 */
export class NotebookEditTool extends BaseTool {
  readonly name = 'NotebookEdit';
  readonly description = `Edit Jupyter notebook (.ipynb) cells.

Operations:
- **replace**: Replace a cell's content (default)
- **insert**: Add a new cell after the specified cell
- **delete**: Remove a cell

Cell identification:
- Use cell_id to target a specific cell by its ID
- Cells are 0-indexed if using position`;

  readonly parameters: ToolParameters = {
    type: 'object',
    properties: {
      notebook_path: {
        type: 'string',
        description: 'The absolute path to the Jupyter notebook file',
      },
      cell_id: {
        type: 'string',
        description: 'The ID of the cell to edit. For insert, new cell is added after this cell.',
      },
      cell_type: {
        type: 'string',
        description: 'The type of the cell (code or markdown). Required for insert.',
        enum: ['code', 'markdown'],
      },
      edit_mode: {
        type: 'string',
        description: 'The operation: replace (default), insert, or delete',
        enum: ['replace', 'insert', 'delete'],
        default: 'replace',
      },
      new_source: {
        type: 'string',
        description: 'The new source content for the cell',
      },
    },
    required: ['notebook_path', 'new_source'],
  };

  async execute(
    params: Record<string, unknown>,
    context: ExecutionContext
  ): Promise<ToolResult> {
    return this.safeExecute(params, context, async () => {
      const notebookPath = params.notebook_path as string;
      const cellId = params.cell_id as string | undefined;
      const cellType = (params.cell_type as 'code' | 'markdown') || 'code';
      const editMode = (params.edit_mode as 'replace' | 'insert' | 'delete') || 'replace';
      const newSource = params.new_source as string;

      // Resolve path
      const absolutePath = path.isAbsolute(notebookPath)
        ? notebookPath
        : path.resolve(context.cwd, notebookPath);

      // Verify it's a notebook file
      if (!absolutePath.endsWith('.ipynb')) {
        return this.failure('File must be a Jupyter notebook (.ipynb)');
      }

      // Check if file exists
      try {
        await fs.access(absolutePath);
      } catch {
        return this.failure(`Notebook not found: ${absolutePath}`);
      }

      // Read and parse notebook
      let notebook: JupyterNotebook;
      try {
        const content = await fs.readFile(absolutePath, 'utf-8');
        notebook = JSON.parse(content);
      } catch (error) {
        return this.failure(`Failed to parse notebook: ${error}`);
      }

      // Validate notebook structure
      if (!notebook.cells || !Array.isArray(notebook.cells)) {
        return this.failure('Invalid notebook: missing cells array');
      }

      // Find the cell by ID
      let cellIndex = -1;
      if (cellId) {
        cellIndex = notebook.cells.findIndex(cell => cell.id === cellId);
        if (cellIndex === -1 && editMode !== 'insert') {
          return this.failure(`Cell with ID "${cellId}" not found`);
        }
      }

      // Perform the operation
      switch (editMode) {
        case 'replace': {
          if (cellIndex === -1) {
            // If no cell ID, replace first cell
            cellIndex = 0;
          }

          if (cellIndex >= notebook.cells.length) {
            return this.failure(`Cell index ${cellIndex} out of range (${notebook.cells.length} cells)`);
          }

          const cell = notebook.cells[cellIndex];
          cell.source = normalizeSource(newSource);

          // Update cell type if provided
          if (params.cell_type) {
            cell.cell_type = cellType;
          }

          // Clear outputs for code cells
          if (cell.cell_type === 'code') {
            cell.outputs = [];
            cell.execution_count = null;
          }

          break;
        }

        case 'insert': {
          // Create new cell
          const newCell: NotebookCell = {
            id: generateCellId(),
            cell_type: cellType,
            source: normalizeSource(newSource),
            metadata: {},
          };

          if (cellType === 'code') {
            newCell.outputs = [];
            newCell.execution_count = null;
          }

          // Insert after the specified cell, or at the beginning
          const insertIndex = cellIndex === -1 ? 0 : cellIndex + 1;
          notebook.cells.splice(insertIndex, 0, newCell);

          break;
        }

        case 'delete': {
          if (cellIndex === -1) {
            return this.failure('Must specify cell_id for delete operation');
          }

          notebook.cells.splice(cellIndex, 1);
          break;
        }

        default:
          return this.failure(`Unknown edit_mode: ${editMode}`);
      }

      // Write the notebook back
      await fs.writeFile(
        absolutePath,
        JSON.stringify(notebook, null, 1),
        'utf-8'
      );

      // Generate summary
      let summary = '';
      switch (editMode) {
        case 'replace':
          summary = `Replaced cell ${cellIndex + 1} (${notebook.cells[cellIndex]?.cell_type || 'unknown'})`;
          break;
        case 'insert':
          summary = `Inserted new ${cellType} cell`;
          break;
        case 'delete':
          summary = `Deleted cell at position ${cellIndex + 1}`;
          break;
      }

      return this.success(
        `${summary} in ${absolutePath}\nNotebook now has ${notebook.cells.length} cells.`,
        {
          modifiedFiles: [absolutePath],
          operation: editMode,
          cellCount: notebook.cells.length,
        }
      );
    });
  }
}
