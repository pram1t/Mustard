/**
 * MCP (Model Context Protocol) Type Specification
 *
 * This file defines the types for MCP client implementation.
 * Based on the MCP specification version 2025-06-18.
 */

// ============================================================================
// JSON-RPC 2.0 TYPES
// ============================================================================

/**
 * JSON-RPC 2.0 Request
 */
export interface JSONRPCRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: Record<string, unknown>;
}

/**
 * JSON-RPC 2.0 Response (success)
 */
export interface JSONRPCSuccessResponse {
  jsonrpc: '2.0';
  id: string | number;
  result: unknown;
}

/**
 * JSON-RPC 2.0 Error
 */
export interface JSONRPCError {
  code: number;
  message: string;
  data?: unknown;
}

/**
 * JSON-RPC 2.0 Response (error)
 */
export interface JSONRPCErrorResponse {
  jsonrpc: '2.0';
  id: string | number;
  error: JSONRPCError;
}

/**
 * JSON-RPC 2.0 Response (either success or error)
 */
export type JSONRPCResponse = JSONRPCSuccessResponse | JSONRPCErrorResponse;

/**
 * JSON-RPC 2.0 Notification (no response expected)
 */
export interface JSONRPCNotification {
  jsonrpc: '2.0';
  method: string;
  params?: Record<string, unknown>;
}

// ============================================================================
// MCP INITIALIZATION
// ============================================================================

/**
 * Client capabilities sent during initialization
 */
export interface ClientCapabilities {
  roots?: {
    listChanged?: boolean;
  };
  sampling?: Record<string, unknown>;
  experimental?: Record<string, unknown>;
}

/**
 * Server capabilities received during initialization
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
  logging?: Record<string, unknown>;
  experimental?: Record<string, unknown>;
}

/**
 * Client info sent during initialization
 */
export interface ClientInfo {
  name: string;
  version: string;
}

/**
 * Server info received during initialization
 */
export interface ServerInfo {
  name: string;
  version: string;
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
  instructions?: string;
}

// ============================================================================
// MCP TOOLS
// ============================================================================

/**
 * Tool input schema (JSON Schema)
 */
export interface MCPToolInputSchema {
  type: 'object';
  properties?: Record<string, unknown>;
  required?: string[];
  additionalProperties?: boolean;
}

/**
 * MCP Tool definition
 */
export interface MCPTool {
  /** Tool name (1-128 characters) */
  name: string;

  /** Human-readable description */
  description?: string;

  /** JSON Schema for inputs */
  inputSchema: MCPToolInputSchema;
}

/**
 * List tools response
 */
export interface ListToolsResult {
  tools: MCPTool[];
  nextCursor?: string;
}

/**
 * Tool call content types
 */
export interface TextToolContent {
  type: 'text';
  text: string;
}

export interface ImageToolContent {
  type: 'image';
  data: string; // Base64 encoded
  mimeType: string;
}

export interface ResourceToolContent {
  type: 'resource';
  resource: {
    uri: string;
    mimeType?: string;
    text?: string;
    blob?: string;
  };
}

export type ToolContent = TextToolContent | ImageToolContent | ResourceToolContent;

/**
 * Tool call result
 */
export interface MCPToolResult {
  content: ToolContent[];
  isError?: boolean;
}

/**
 * Call tool request params
 */
export interface CallToolParams {
  name: string;
  arguments?: Record<string, unknown>;
}

// ============================================================================
// MCP RESOURCES
// ============================================================================

/**
 * MCP Resource definition
 */
export interface MCPResource {
  /** Resource URI */
  uri: string;

  /** Human-readable name */
  name: string;

  /** Description */
  description?: string;

  /** MIME type */
  mimeType?: string;
}

/**
 * List resources response
 */
export interface ListResourcesResult {
  resources: MCPResource[];
  nextCursor?: string;
}

/**
 * Resource content
 */
export interface MCPResourceContent {
  uri: string;
  mimeType?: string;
  text?: string;
  blob?: string; // Base64 encoded
}

/**
 * Read resource response
 */
export interface ReadResourceResult {
  contents: MCPResourceContent[];
}

// ============================================================================
// MCP PROMPTS
// ============================================================================

/**
 * Prompt argument definition
 */
export interface MCPPromptArgument {
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
  arguments?: MCPPromptArgument[];
}

/**
 * List prompts response
 */
export interface ListPromptsResult {
  prompts: MCPPrompt[];
  nextCursor?: string;
}

// ============================================================================
// TRANSPORT TYPES
// ============================================================================

/**
 * Transport interface
 */
export interface MCPTransport {
  /** Connect to the server */
  connect(): Promise<void>;

  /** Send a request and wait for response */
  send(request: JSONRPCRequest): Promise<JSONRPCResponse>;

  /** Send a notification (no response expected) */
  sendNotification(notification: JSONRPCNotification): void;

  /** Generate next request ID */
  nextRequestId(): number | string;

  /** Close the connection */
  close(): Promise<void>;

  /** Event emitter for notifications */
  on(event: 'notification', listener: (notification: JSONRPCNotification) => void): void;
  on(event: 'close', listener: (code?: number) => void): void;
}

// ============================================================================
// SERVER CONFIGURATION
// ============================================================================

/**
 * STDIO transport configuration
 */
export interface StdioServerConfig {
  type: 'stdio';
  command: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
}

/**
 * HTTP transport configuration
 */
export interface HttpServerConfig {
  type: 'http';
  url: string;
  headers?: Record<string, string>;
}

/**
 * Server configuration (either STDIO or HTTP)
 */
export type MCPServerConfig = StdioServerConfig | HttpServerConfig;

/**
 * Named server configuration for registry
 */
export interface NamedServerConfig extends MCPServerConfig {
  name: string;
}

// ============================================================================
// CLIENT INTERFACE
// ============================================================================

/**
 * MCP Client interface
 */
export interface MCPClient {
  /** Initialize the connection */
  initialize(): Promise<ServerCapabilities>;

  /** List available tools */
  listTools(): Promise<MCPTool[]>;

  /** Call a tool */
  callTool(name: string, arguments_: Record<string, unknown>): Promise<MCPToolResult>;

  /** List available resources */
  listResources(): Promise<MCPResource[]>;

  /** Read a resource */
  readResource(uri: string): Promise<MCPResourceContent>;

  /** List available prompts */
  listPrompts(): Promise<MCPPrompt[]>;

  /** Close the connection */
  close(): Promise<void>;
}

// ============================================================================
// REGISTRY INTERFACE
// ============================================================================

/**
 * MCP Registry interface
 */
export interface MCPRegistry {
  /** Add and connect to a server */
  addServer(config: NamedServerConfig): Promise<void>;

  /** Remove and disconnect from a server */
  removeServer(name: string): Promise<void>;

  /** Get a client by server name */
  getClient(name: string): MCPClient | undefined;

  /** Get all tools from all connected servers */
  getAllTools(): Promise<MCPTool[]>;

  /** Get all resources from all connected servers */
  getAllResources(): Promise<MCPResource[]>;
}
