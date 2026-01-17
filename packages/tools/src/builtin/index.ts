/**
 * Built-in Tools Index
 *
 * Exports all built-in tools for the OpenAgent tool system.
 */

// File operations
export { ReadTool } from './read';
export { WriteTool } from './write';
export { EditTool } from './edit';

// Search operations
export { GlobTool } from './glob';
export { GrepTool } from './grep';

// Shell operations
export { BashTool } from './bash';

// Web operations
// export { WebFetchTool } from './web-fetch';

// Interaction
// export { AskUserTool } from './ask-user';

// Subagents
// export { TaskTool } from './task';

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
