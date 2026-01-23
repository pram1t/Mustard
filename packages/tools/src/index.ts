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
} from './types.js';

// ============================================================================
// Base Tool
// ============================================================================

export { BaseTool, createTool } from './base.js';

// ============================================================================
// Registry
// ============================================================================

export { ToolRegistry, createDefaultRegistry, createTestContext } from './registry.js';

// ============================================================================
// Built-in Tools
// ============================================================================

export { BUILTIN_TOOL_NAMES } from './builtin/index.js';
export type { BuiltinToolName } from './builtin/index.js';

// File operations
export { ReadTool } from './builtin/read.js';
export { WriteTool } from './builtin/write.js';
export { EditTool } from './builtin/edit.js';

// Search operations
export { GlobTool } from './builtin/glob.js';
export { GrepTool } from './builtin/grep.js';

// Shell operations
export { BashTool } from './builtin/bash.js';

// ============================================================================
// Security Utilities
// ============================================================================

export {
  sanitizePath,
  validateRegexPattern,
  validateCommand,
  auditLog,
} from './security.js';

// Note: The following tools are planned but not yet implemented:
// export { WebFetchTool } from './builtin/web-fetch';
// export { AskUserTool } from './builtin/ask-user';
// export { TaskTool } from './builtin/task';
