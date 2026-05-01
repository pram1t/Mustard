/**
 * @mustard/mcp
 *
 * Model Context Protocol (MCP) client for OpenAgent.
 * Allows connecting to external tool servers and using their capabilities.
 */

export const version = '0.0.0';

// ============================================================================
// Types
// ============================================================================

export type {
  // JSON-RPC types
  JSONRPCRequest,
  JSONRPCNotification,
  JSONRPCResponse,
  JSONRPCSuccessResponse,
  JSONRPCErrorResponse,
  JSONRPCError,
  JSONRPCMessage,

  // MCP types
  ClientInfo,
  ServerInfo,
  ServerCapabilities,
  ClientCapabilities,
  InitializeParams,
  InitializeResult,

  // Tool types
  JSONSchema,
  MCPTool,
  ListToolsResult,
  CallToolParams,
  CallToolResult,
  TextContent,
  ImageContent,
  ResourceContent,
  ContentItem,

  // Resource types
  MCPResource,
  ListResourcesResult,
  ReadResourceParams,
  ReadResourceResult,
  ResourceContents,

  // Prompt types
  MCPPrompt,
  PromptArgument,
  ListPromptsResult,
  GetPromptParams,
  GetPromptResult,
  PromptMessage,

  // Server config types
  ServerConfig,
  StdioServerConfig,
  HttpServerConfig,
  MCPServerState,
} from './types.js';

export {
  // Error types
  MCPError,
  TransportError,
  ConnectionError,
  TimeoutError,

  // Constants
  MCP_VERSION,
  JSONRPC_ERROR_CODES,
} from './types.js';

// ============================================================================
// Transport
// ============================================================================

export type { Transport, TransportState } from './transport/index.js';
export { StdioTransport, HttpTransport, DEFAULT_TIMEOUT } from './transport/index.js';

// ============================================================================
// Client
// ============================================================================

export { MCPClient } from './client.js';
export type { MCPClientOptions } from './client.js';

// ============================================================================
// Registry
// ============================================================================

export { MCPRegistry, createRegistry } from './registry.js';
export type { AggregatedTool } from './registry.js';
