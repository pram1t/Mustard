/**
 * Tool System Interface Specification
 *
 * This file defines the types and interfaces for the tool system.
 * All tools (built-in and custom) must conform to these interfaces.
 */

import type { JSONSchema } from './llm-provider-interface';

// ============================================================================
// EXECUTION CONTEXT
// ============================================================================

/**
 * Context provided to tool execution
 */
export interface ExecutionContext {
  /** Current working directory */
  cwd: string;

  /** Session ID for tracking */
  sessionId: string;

  /** User home directory */
  homeDir: string;

  /** Agent configuration */
  config: AgentConfig;

  /** Permission manager for nested checks */
  permissions: PermissionManager;

  /** Hook executor for lifecycle events */
  hooks: HookExecutor;

  /** Abort signal for cancellation */
  signal?: AbortSignal;

  /** Environment variables */
  env?: Record<string, string>;
}

/**
 * Agent configuration (subset relevant to tools)
 */
export interface AgentConfig {
  /** LLM provider configuration */
  llm: {
    provider: string;
    model: string;
  };

  /** Permission configuration */
  permissions: {
    mode: 'default' | 'strict' | 'permissive';
  };

  /** Custom environment variables */
  env?: Record<string, string>;
}

/**
 * Permission manager interface (for nested permission checks)
 */
export interface PermissionManager {
  check(tool: string, params: Record<string, unknown>): Promise<'allow' | 'deny' | 'ask'>;
  requestApproval(tool: string, params: Record<string, unknown>): Promise<boolean>;
}

/**
 * Hook executor interface
 */
export interface HookExecutor {
  trigger(event: string, data: Record<string, unknown>): Promise<{ blocked: boolean }>;
}

// ============================================================================
// TOOL RESULT
// ============================================================================

/**
 * Metadata about tool execution
 */
export interface ToolResultMetadata {
  /** Files that were modified */
  modifiedFiles?: string[];

  /** Tokens consumed (for context tracking) */
  tokensUsed?: number;

  /** Execution time in milliseconds */
  executionTime?: number;

  /** Additional tool-specific metadata */
  [key: string]: unknown;
}

/**
 * Result from tool execution
 */
export interface ToolResult {
  /** Whether execution succeeded */
  success: boolean;

  /** Output content (string for display, object for structured data) */
  output: string | Record<string, unknown>;

  /** Error message if failed */
  error?: string;

  /** Additional metadata */
  metadata?: ToolResultMetadata;
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

/**
 * Tool parameter schema
 */
export interface ToolParameters {
  type: 'object';
  properties: Record<string, JSONSchema>;
  required?: string[];
  additionalProperties?: boolean;
}

/**
 * Tool definition
 */
export interface Tool {
  /** Unique tool name */
  name: string;

  /**
   * Description for LLM to understand when to use
   *
   * Should be clear, concise, and include:
   * - What the tool does
   * - When to use it
   * - Any important constraints
   */
  description: string;

  /** JSON Schema for parameters */
  parameters: ToolParameters;

  /**
   * Execute the tool
   *
   * @param params - Validated parameters from LLM
   * @param context - Execution context
   * @returns Tool result
   */
  execute(
    params: Record<string, unknown>,
    context: ExecutionContext
  ): Promise<ToolResult>;
}

// ============================================================================
// TOOL REGISTRY
// ============================================================================

/**
 * Tool definition for LLM (without execute function)
 */
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: ToolParameters;
}

/**
 * Tool registry interface
 */
export interface ToolRegistry {
  /**
   * Register a tool
   */
  register(tool: Tool): void;

  /**
   * Get a tool by name
   */
  get(name: string): Tool | undefined;

  /**
   * Get all registered tools
   */
  getAll(): Tool[];

  /**
   * Get tool definitions for LLM
   */
  getDefinitions(): ToolDefinition[];

  /**
   * Execute a tool by name
   */
  execute(
    name: string,
    params: Record<string, unknown>,
    context: ExecutionContext
  ): Promise<ToolResult>;
}

// ============================================================================
// BUILT-IN TOOL TYPES
// ============================================================================

/**
 * Read tool parameters
 */
export interface ReadParams {
  file_path: string;
  offset?: number;
  limit?: number;
}

/**
 * Write tool parameters
 */
export interface WriteParams {
  file_path: string;
  content: string;
}

/**
 * Edit tool parameters
 */
export interface EditParams {
  file_path: string;
  old_string: string;
  new_string: string;
  replace_all?: boolean;
}

/**
 * Bash tool parameters
 */
export interface BashParams {
  command: string;
  timeout?: number;
  run_in_background?: boolean;
  description?: string;
}

/**
 * Glob tool parameters
 */
export interface GlobParams {
  pattern: string;
  path?: string;
}

/**
 * Grep tool parameters
 */
export interface GrepParams {
  pattern: string;
  path?: string;
  glob?: string;
  type?: string;
  output_mode?: 'files_with_matches' | 'content' | 'count';
  case_insensitive?: boolean;
}

/**
 * WebFetch tool parameters
 */
export interface WebFetchParams {
  url: string;
  prompt: string;
}

/**
 * AskUser tool parameters
 */
export interface AskUserQuestion {
  question: string;
  header: string;
  options: Array<{
    label: string;
    description: string;
  }>;
  multiSelect: boolean;
}

export interface AskUserParams {
  questions: AskUserQuestion[];
}

/**
 * Task tool parameters
 */
export interface TaskParams {
  description: string;
  prompt: string;
  subagent_type: 'Explore' | 'Plan' | 'Bash' | 'general-purpose';
  run_in_background?: boolean;
  max_turns?: number;
  model?: 'sonnet' | 'opus' | 'haiku';
  resume?: string;
}

// ============================================================================
// TOOL BUILDER HELPERS
// ============================================================================

/**
 * Helper function to create a tool
 */
export function createTool(config: {
  name: string;
  description: string;
  parameters: ToolParameters;
  execute: (params: Record<string, unknown>, context: ExecutionContext) => Promise<ToolResult>;
}): Tool {
  return config;
}

/**
 * Helper to create success result
 */
export function successResult(output: string | Record<string, unknown>, metadata?: ToolResultMetadata): ToolResult {
  return {
    success: true,
    output,
    metadata,
  };
}

/**
 * Helper to create error result
 */
export function errorResult(error: string, output: string = ''): ToolResult {
  return {
    success: false,
    output,
    error,
  };
}
