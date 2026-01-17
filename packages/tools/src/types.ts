/**
 * Tool System Types
 *
 * Defines the interfaces for tools, execution context, and results.
 */

// ============================================================================
// JSON Schema Types (for tool parameters)
// ============================================================================

/**
 * JSON Schema type definition
 */
export interface JSONSchema {
  type: string;
  description?: string;
  properties?: Record<string, JSONSchema>;
  required?: string[];
  items?: JSONSchema;
  enum?: unknown[];
  default?: unknown;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  format?: string;
  additionalProperties?: boolean | JSONSchema;
}

/**
 * Tool parameter schema (always an object)
 */
export interface ToolParameters {
  type: 'object';
  properties: Record<string, JSONSchema>;
  required?: string[];
  additionalProperties?: boolean;
}

// ============================================================================
// Execution Context
// ============================================================================

/**
 * Configuration passed to tools
 */
export interface ToolConfig {
  /** Environment variables */
  env?: Record<string, string>;
  /** Maximum output size in characters */
  maxOutputSize?: number;
  /** Default timeout in milliseconds */
  defaultTimeout?: number;
}

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

  /** Tool configuration */
  config: ToolConfig;

  /** Abort signal for cancellation */
  signal?: AbortSignal;
}

// ============================================================================
// Tool Result
// ============================================================================

/**
 * Metadata about tool execution
 */
export interface ToolResultMetadata {
  /** Files that were modified */
  modifiedFiles?: string[];
  /** Approximate tokens used in output */
  tokensUsed?: number;
  /** Execution time in milliseconds */
  executionTime?: number;
  /** Exit code (for command execution) */
  exitCode?: number;
  /** Allow additional custom properties */
  [key: string]: unknown;
}

/**
 * Result from tool execution
 */
export interface ToolResult {
  /** Whether execution succeeded */
  success: boolean;

  /** Output content (string for display, object for structured data) */
  output: string | object;

  /** Error message if failed */
  error?: string;

  /** Additional metadata */
  metadata?: ToolResultMetadata;
}

// ============================================================================
// Tool Definition
// ============================================================================

/**
 * Tool definition interface
 * All tools must implement this interface
 */
export interface Tool {
  /** Unique tool name */
  readonly name: string;

  /** Description for LLM to understand when to use this tool */
  readonly description: string;

  /** JSON Schema for parameters */
  readonly parameters: ToolParameters;

  /**
   * Execute the tool
   * @param params - Validated parameters from LLM
   * @param context - Execution context
   * @returns Promise resolving to tool result
   */
  execute(params: Record<string, unknown>, context: ExecutionContext): Promise<ToolResult>;
}

// ============================================================================
// Tool Definition (for LLM)
// ============================================================================

/**
 * Simplified tool definition for sending to LLM
 */
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: ToolParameters;
}

// ============================================================================
// Tool Registry Types
// ============================================================================

/**
 * Options for tool execution
 */
export interface ExecuteOptions {
  /** Timeout in milliseconds */
  timeout?: number;
  /** Abort signal */
  signal?: AbortSignal;
}

/**
 * Tool registry interface
 */
export interface IToolRegistry {
  /** Register a tool */
  register(tool: Tool): void;

  /** Unregister a tool */
  unregister(name: string): boolean;

  /** Get a tool by name */
  get(name: string): Tool | undefined;

  /** Get all registered tools */
  getAll(): Tool[];

  /** Get tool definitions for LLM */
  getDefinitions(): ToolDefinition[];

  /** Check if a tool is registered */
  has(name: string): boolean;

  /** Execute a tool by name */
  execute(
    name: string,
    params: Record<string, unknown>,
    context: ExecutionContext,
    options?: ExecuteOptions
  ): Promise<ToolResult>;
}
