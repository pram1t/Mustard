/**
 * @mustard/tools
 *
 * Tool system for OpenAgent.
 * Provides built-in tools and registry for managing tool execution.
 */

export const version = '0.0.0';

// ============================================================================
// Type Exports
// ============================================================================

export type {
  // JSON Schema types
  JSONSchema,
  ToolParameters,

  // Execution types
  ToolConfig,
  ExecutionContext,
  ISubagentManager,

  // Result types
  ToolResultMetadata,
  ToolResult,

  // Tool types
  Tool,
  ToolDefinition,

  // Registry types
  ExecuteOptions,
  IToolRegistry,
} from './types.js';

// ============================================================================
// Base Tool
// ============================================================================

export { BaseTool, createTool } from './base.js';

// ============================================================================
// Registry
// ============================================================================

export { ToolRegistry, createDefaultRegistry, createTestContext } from './registry.js';
export type { CreateRegistryOptions } from './registry.js';

// ============================================================================
// Built-in Tools
// ============================================================================

export { BUILTIN_TOOL_NAMES } from './builtin/index.js';
export type { BuiltinToolName } from './builtin/index.js';

// File operations
export { ReadTool } from './builtin/read.js';
export { WriteTool } from './builtin/write.js';
export { EditTool } from './builtin/edit.js';
export { MultiEditTool } from './builtin/multi-edit.js';
export { NotebookEditTool } from './builtin/notebook.js';

// Search operations
export { GlobTool } from './builtin/glob.js';
export { GrepTool } from './builtin/grep.js';

// Shell operations
export { BashTool } from './builtin/bash.js';
export { KillShellTool, ListShellsTool } from './builtin/shell-control.js';

// Subagent operations
export { TaskTool } from './builtin/task.js';
export { TaskOutputTool, TaskStopTool } from './builtin/task-control.js';

// Web operations (Phase 11)
export { WebFetchTool } from './builtin/web-fetch.js';
export { WebSearchTool } from './builtin/web-search.js';

// Task management (Phase 11)
export { TodoWriteTool, TodoReadTool } from './builtin/todo.js';

// User interaction (Phase 11)
export { AskUserQuestionTool } from './builtin/ask-user.js';

// Innovation tools (Phase 11 - beyond Claude Code)
export { DiffTool } from './builtin/diff.js';
export { GitTool } from './builtin/git.js';
export { TestRunnerTool } from './builtin/test-runner.js';
export { APIClientTool } from './builtin/api-client.js';

// ============================================================================
// Helper Exports
// ============================================================================

export {
  registerTaskController,
  updateTaskOutput,
} from './builtin/task-control.js';

export {
  registerShellProcess,
  unregisterShellProcess,
  getActiveShells,
} from './builtin/shell-control.js';

// ============================================================================
// Security Utilities
// ============================================================================

export {
  sanitizePath,
  validateRegexPattern,
  validateCommand,
  auditLog,
} from './security.js';
