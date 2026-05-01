/**
 * Todo Tools
 *
 * TodoWrite - Create and manage task lists
 * TodoRead - Read current task list
 *
 * Todos are stored in:
 * - .openagent/todos.json (if in a project)
 * - ~/.openagent/todos.json (global fallback)
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { BaseTool } from '../base.js';
import type { ToolResult, ExecutionContext, ToolParameters } from '../types.js';
import { getTodosPath as getConfigTodosPath } from '@pram1t/mustard-config';

/**
 * Todo item structure
 */
interface TodoItem {
  content: string;
  activeForm: string;
  status: 'pending' | 'in_progress' | 'completed';
}

/**
 * Persistent todo state
 */
interface TodoState {
  todos: TodoItem[];
  lastUpdated: string;
}

/**
 * Get the path to the todos file
 * Uses project-specific path if in a project, otherwise global
 */
async function getTodosPath(cwd: string): Promise<string> {
  return getConfigTodosPath(cwd);
}

/**
 * Ensure the parent directory exists
 */
async function ensureDir(todosPath: string): Promise<void> {
  const dir = path.dirname(todosPath);
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch {
    // Directory may already exist
  }
}

/**
 * Load todos from file
 */
async function loadTodos(cwd: string): Promise<TodoState> {
  const todosPath = await getTodosPath(cwd);
  try {
    const content = await fs.readFile(todosPath, 'utf-8');
    return JSON.parse(content);
  } catch {
    // File doesn't exist or is invalid, return empty state
    return {
      todos: [],
      lastUpdated: new Date().toISOString(),
    };
  }
}

/**
 * Save todos to file
 */
async function saveTodos(cwd: string, state: TodoState): Promise<void> {
  const todosPath = await getTodosPath(cwd);
  await ensureDir(todosPath);
  await fs.writeFile(todosPath, JSON.stringify(state, null, 2), 'utf-8');
}

/**
 * TodoWriteTool - Create/update task lists
 */
export class TodoWriteTool extends BaseTool {
  readonly name = 'TodoWrite';
  readonly description = `Create and manage a structured task list for tracking progress.

Use this tool to:
- Plan complex, multi-step tasks
- Track progress on work items
- Give users visibility into what you're doing

Task States:
- pending: Task not yet started
- in_progress: Currently working on (limit to ONE at a time)
- completed: Task finished

IMPORTANT: Exactly ONE task must be in_progress at any time when actively working.`;

  readonly parameters: ToolParameters = {
    type: 'object',
    properties: {
      todos: {
        type: 'array',
        description: 'The updated todo list',
        items: {
          type: 'object',
          properties: {
            content: {
              type: 'string',
              description: 'Task description (imperative form, e.g., "Run tests")',
              minLength: 1,
            },
            activeForm: {
              type: 'string',
              description: 'Present continuous form (e.g., "Running tests")',
              minLength: 1,
            },
            status: {
              type: 'string',
              enum: ['pending', 'in_progress', 'completed'],
              description: 'Task status',
            },
          },
          required: ['content', 'status', 'activeForm'],
        },
      },
    },
    required: ['todos'],
  };

  async execute(
    params: Record<string, unknown>,
    context: ExecutionContext
  ): Promise<ToolResult> {
    return this.safeExecute(params, context, async () => {
      const todos = params.todos as TodoItem[];

      // Validate: exactly one in_progress when there are non-completed tasks
      const inProgressCount = todos.filter(t => t.status === 'in_progress').length;
      const pendingOrInProgress = todos.filter(t => t.status !== 'completed').length;

      if (pendingOrInProgress > 0 && inProgressCount > 1) {
        return this.failure(
          `Invalid todo state: ${inProgressCount} tasks are in_progress. Only ONE task can be in_progress at a time.`
        );
      }

      // Validate each todo has required fields
      for (let i = 0; i < todos.length; i++) {
        const todo = todos[i];
        if (!todo.content || !todo.activeForm || !todo.status) {
          return this.failure(
            `Todo item ${i + 1} is missing required fields (content, activeForm, status)`
          );
        }
      }

      // Save todos (uses project-specific path if in a project)
      const state: TodoState = {
        todos,
        lastUpdated: new Date().toISOString(),
      };
      await saveTodos(context.cwd, state);

      // Generate summary
      const completed = todos.filter(t => t.status === 'completed').length;
      const pending = todos.filter(t => t.status === 'pending').length;
      const inProgress = todos.filter(t => t.status === 'in_progress').length;

      const currentTask = todos.find(t => t.status === 'in_progress');

      let output = `Todo list updated (${todos.length} tasks):\n`;
      output += `  ✅ Completed: ${completed}\n`;
      output += `  🔄 In Progress: ${inProgress}\n`;
      output += `  ⏳ Pending: ${pending}\n`;

      if (currentTask) {
        output += `\nCurrently: ${currentTask.activeForm}`;
      }

      return this.success(output, {
        totalTasks: todos.length,
        completed,
        pending,
        inProgress,
      });
    });
  }
}

/**
 * TodoReadTool - Read current task list
 */
export class TodoReadTool extends BaseTool {
  readonly name = 'TodoRead';
  readonly description = 'Read the current todo list to see task progress.';

  readonly parameters: ToolParameters = {
    type: 'object',
    properties: {},
    required: [],
  };

  async execute(
    params: Record<string, unknown>,
    context: ExecutionContext
  ): Promise<ToolResult> {
    return this.safeExecute(params, context, async () => {
      const state = await loadTodos(context.cwd);
      const todos = state.todos;

      if (todos.length === 0) {
        return this.success('No tasks in todo list.', { totalTasks: 0 });
      }

      // Generate formatted output
      let output = `Todo List (${todos.length} tasks):\n\n`;

      const statusIcons: Record<string, string> = {
        completed: '✅',
        in_progress: '🔄',
        pending: '⏳',
      };

      for (let i = 0; i < todos.length; i++) {
        const todo = todos[i];
        const icon = statusIcons[todo.status] || '❓';
        output += `${i + 1}. [${icon} ${todo.status}] ${todo.content}\n`;
      }

      // Summary
      const completed = todos.filter(t => t.status === 'completed').length;
      const pending = todos.filter(t => t.status === 'pending').length;
      const inProgress = todos.filter(t => t.status === 'in_progress').length;

      output += `\nProgress: ${completed}/${todos.length} completed`;

      const currentTask = todos.find(t => t.status === 'in_progress');
      if (currentTask) {
        output += `\nCurrently: ${currentTask.activeForm}`;
      }

      return this.success(output, {
        totalTasks: todos.length,
        completed,
        pending,
        inProgress,
        lastUpdated: state.lastUpdated,
      });
    });
  }
}
