/**
 * MCP Protocol Types
 *
 * Type definitions for the Model Context Protocol (MCP).
 * Based on JSON-RPC 2.0 specification.
 */

// ============================================================================
// JSON-RPC 2.0 Base Types
// ============================================================================

/**
 * JSON-RPC 2.0 request
 */
export interface JSONRPCRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: Record<string, unknown>;
}

/**
 * JSON-RPC 2.0 notification (no id, no response expected)
 */
export interface JSONRPCNotification {
  jsonrpc: '2.0';
  method: string;
  params?: Record<string, unknown>;
}

/**
 * JSON-RPC 2.0 success response
 */
export interface JSONRPCSuccessResponse {
  jsonrpc: '2.0';
  id: string | number;
  result: unknown;
}

/**
 * JSON-RPC 2.0 error response
 */
export interface JSONRPCErrorResponse {
  jsonrpc: '2.0';
  id: string | number | null;
  error: JSONRPCError;
}

/**
 * JSON-RPC 2.0 error object
 */
export interface JSONRPCError {
  code: number;
  message: string;
  data?: unknown;
}

/**
 * Union type for any JSON-RPC response
 */
export type JSONRPCResponse = JSONRPCSuccessResponse | JSONRPCErrorResponse;

/**
 * Union type for any JSON-RPC message
 */
export type JSONRPCMessage = JSONRPCRequest | JSONRPCNotification | JSONRPCResponse;

// Standard JSON-RPC error codes
export const JSONRPC_ERROR_CODES = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
} as const;

// ============================================================================
// MCP Protocol Types
// ============================================================================

/**
 * MCP protocol version
 */
export const MCP_VERSION = '2024-11-05';

/**
 * Client information sent during initialization
 */
export interface ClientInfo {
  name: string;
  version: string;
}

/**
 * Server information received during initialization
 */
export interface ServerInfo {
  name: string;
  version: string;
}

/**
 * Server capabilities
 */
export interface ServerCapabilities {
  tools?: {
    listChanged?: boolean;
  };
  resources?: {
    subscribe?: boolean;
    listChanged?: boolean;
  };
  prompts?: {
    listChanged?: boolean;
  };
  logging?: Record<string, never>;
}

/**
 * Client capabilities
 */
export interface ClientCapabilities {
  roots?: {
    listChanged?: boolean;
  };
  sampling?: Record<string, never>;
}

/**
 * Initialize request params
 */
export interface InitializeParams {
  protocolVersion: string;
  capabilities: ClientCapabilities;
  clientInfo: ClientInfo;
}

/**
 * Initialize response result
 */
export interface InitializeResult {
  protocolVersion: string;
  capabilities: ServerCapabilities;
  serverInfo: ServerInfo;
}

// ============================================================================
// Tool Types
// ============================================================================

/**
 * JSON Schema for tool parameters
 */
export interface JSONSchema {
  type?: string;
  properties?: Record<string, JSONSchema>;
  required?: string[];
  description?: string;
  items?: JSONSchema;
  enum?: unknown[];
  default?: unknown;
  [key: string]: unknown;
}

/**
 * MCP Tool definition
 */
export interface MCPTool {
  name: string;
  description?: string;
  inputSchema: JSONSchema;
}

/**
 * List tools response
 */
export interface ListToolsResult {
  tools: MCPTool[];
}

/**
 * Tool call request params
 */
export interface CallToolParams {
  name: string;
  arguments?: Record<string, unknown>;
}

/**
 * Content types in tool results
 */
export interface TextContent {
  type: 'text';
  text: string;
}

export interface ImageContent {
  type: 'image';
  data: string;
  mimeType: string;
}

export interface ResourceContent {
  type: 'resource';
  resource: {
    uri: string;
    mimeType?: string;
    text?: string;
    blob?: string;
  };
}

export type ContentItem = TextContent | ImageContent | ResourceContent;

/**
 * Tool call response
 */
export interface CallToolResult {
  content: ContentItem[];
  isError?: boolean;
}

// ============================================================================
// Resource Types
// ============================================================================

/**
 * MCP Resource definition
 */
export interface MCPResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

/**
 * List resources response
 */
export interface ListResourcesResult {
  resources: MCPResource[];
}

/**
 * Read resource request params
 */
export interface ReadResourceParams {
  uri: string;
}

/**
 * Resource contents
 */
export interface ResourceContents {
  uri: string;
  mimeType?: string;
  text?: string;
  blob?: string;
}

/**
 * Read resource response
 */
export interface ReadResourceResult {
  contents: ResourceContents[];
}

// ============================================================================
// Prompt Types
// ============================================================================

/**
 * Prompt argument definition
 */
export interface PromptArgument {
  name: string;
  description?: string;
  required?: boolean;
}

/**
 * MCP Prompt definition
 */
export interface MCPPrompt {
  name: string;
  description?: string;
  arguments?: PromptArgument[];
}

/**
 * List prompts response
 */
export interface ListPromptsResult {
  prompts: MCPPrompt[];
}

/**
 * Get prompt request params
 */
export interface GetPromptParams {
  name: string;
  arguments?: Record<string, string>;
}

/**
 * Prompt message
 */
export interface PromptMessage {
  role: 'user' | 'assistant';
  content: TextContent | ImageContent | ResourceContent;
}

/**
 * Get prompt response
 */
export interface GetPromptResult {
  description?: string;
  messages: PromptMessage[];
}

// ============================================================================
// Server Configuration
// ============================================================================

/**
 * STDIO server configuration
 */
export interface StdioServerConfig {
  type: 'stdio';
  command: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
}

/**
 * HTTP server configuration
 */
export interface HttpServerConfig {
  type: 'http';
  url: string;
  headers?: Record<string, string>;
}

/**
 * Server configuration (union type)
 */
export type ServerConfig = StdioServerConfig | HttpServerConfig;

/**
 * MCP server state
 */
export interface MCPServerState {
  name: string;
  config: ServerConfig;
  connected: boolean;
  capabilities?: ServerCapabilities;
  serverInfo?: ServerInfo;
  tools?: MCPTool[];
  resources?: MCPResource[];
  prompts?: MCPPrompt[];
}

// ============================================================================
// Error Types
// ============================================================================

/**
 * MCP-specific error
 */
export class MCPError extends Error {
  constructor(
    message: string,
    public readonly code: number,
    public readonly data?: unknown
  ) {
    super(message);
    this.name = 'MCPError';
  }

  static fromJSONRPC(error: JSONRPCError): MCPError {
    return new MCPError(error.message, error.code, error.data);
  }
}

/**
 * Transport error
 */
export class TransportError extends Error {
  constructor(message: string, public readonly cause?: Error) {
    super(message);
    this.name = 'TransportError';
  }
}

/**
 * Connection error
 */
export class ConnectionError extends TransportError {
  constructor(message: string, cause?: Error) {
    super(message, cause);
    this.name = 'ConnectionError';
  }
}

/**
 * Timeout error
 */
export class TimeoutError extends TransportError {
  constructor(message: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}
