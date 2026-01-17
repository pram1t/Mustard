/**
 * @openagent/tools
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

  // Result types
  ToolResultMetadata,
  ToolResult,

  // Tool types
  Tool,
  ToolDefinition,

  // Registry types
  ExecuteOptions,
  IToolRegistry,
} from './types';

// ============================================================================
// Base Tool
// ============================================================================

export { BaseTool, createTool } from './base';

// ============================================================================
// Registry
// ============================================================================

export { ToolRegistry, createDefaultRegistry, createTestContext } from './registry';

// ============================================================================
// Built-in Tools
// ============================================================================

export { BUILTIN_TOOL_NAMES } from './builtin';
export type { BuiltinToolName } from './builtin';

// File operations
export { ReadTool } from './builtin/read';
export { WriteTool } from './builtin/write';
export { EditTool } from './builtin/edit';

// Search operations
export { GlobTool } from './builtin/glob';
export { GrepTool } from './builtin/grep';

// Shell operations
export { BashTool } from './builtin/bash';

// Note: The following tools are planned but not yet implemented:
// export { WebFetchTool } from './builtin/web-fetch';
// export { AskUserTool } from './builtin/ask-user';
// export { TaskTool } from './builtin/task';
