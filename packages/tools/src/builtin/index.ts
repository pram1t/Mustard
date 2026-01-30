/**
 * Built-in Tools Index
 *
 * Exports all built-in tools for the OpenAgent tool system.
 */

// File operations
export { ReadTool } from './read.js';
export { WriteTool } from './write.js';
export { EditTool } from './edit.js';

// Search operations
export { GlobTool } from './glob.js';
export { GrepTool } from './grep.js';

// Shell operations
export { BashTool } from './bash.js';

// Subagent operations
export { TaskTool } from './task.js';

// Web operations
// export { WebFetchTool } from './web-fetch';

// Interaction
// export { AskUserTool } from './ask-user';

/**
 * List of all built-in tool names
 */
export const BUILTIN_TOOL_NAMES = [
  'Read',
  'Write',
  'Edit',
  'Glob',
  'Grep',
  'Bash',
  'WebFetch',
  'AskUser',
  'Task',
] as const;

export type BuiltinToolName = (typeof BUILTIN_TOOL_NAMES)[number];
