/**
 * Built-in Tools Index
 *
 * Exports all built-in tools for the OpenAgent tool system.
 * Phase 11: Extended Tools - 14 new tools for Claude Code parity + innovation
 */

// File operations
export { ReadTool } from './read.js';
export { WriteTool } from './write.js';
export { EditTool } from './edit.js';
export { MultiEditTool } from './multi-edit.js';
export { NotebookEditTool } from './notebook.js';

// Search operations
export { GlobTool } from './glob.js';
export { GrepTool } from './grep.js';

// Shell operations
export { BashTool } from './bash.js';
export { KillShellTool, ListShellsTool } from './shell-control.js';

// Subagent operations
export { TaskTool } from './task.js';
export { TaskOutputTool, TaskStopTool } from './task-control.js';

// Web operations
export { WebFetchTool } from './web-fetch.js';
export { WebSearchTool } from './web-search.js';

// Task management
export { TodoWriteTool, TodoReadTool } from './todo.js';

// User interaction
export { AskUserQuestionTool } from './ask-user.js';

// Innovation tools (beyond Claude Code)
export { DiffTool } from './diff.js';
export { GitTool } from './git.js';
export { TestRunnerTool } from './test-runner.js';
export { APIClientTool } from './api-client.js';

/**
 * List of all built-in tool names
 */
export const BUILTIN_TOOL_NAMES = [
  // Core file operations
  'Read',
  'Write',
  'Edit',
  'MultiEdit',
  'NotebookEdit',

  // Search
  'Glob',
  'Grep',

  // Shell
  'Bash',
  'KillShell',
  'ListShells',

  // Subagents & Tasks
  'Task',
  'TaskOutput',
  'TaskStop',

  // Web
  'WebFetch',
  'WebSearch',

  // Task management
  'TodoWrite',
  'TodoRead',

  // User interaction
  'AskUserQuestion',

  // Innovation tools
  'Diff',
  'Git',
  'TestRunner',
  'APIClient',
] as const;

export type BuiltinToolName = (typeof BUILTIN_TOOL_NAMES)[number];

/**
 * Helper exports for task/shell control
 */
export {
  registerTaskController,
  updateTaskOutput,
} from './task-control.js';

export {
  registerShellProcess,
  unregisterShellProcess,
  getActiveShells,
} from './shell-control.js';
