# MCP Client Implementation

This document describes how OpenAgent implements the Model Context Protocol (MCP) to connect to external services.

## Overview

MCP (Model Context Protocol) is an open standard by Anthropic that enables AI applications to connect with external systems. OpenAgent implements the MCP client specification to connect to any MCP server.

## MCP Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         OpenAgent (MCP Host)                         │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │                        MCP Registry                            │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │  │
│  │  │ MCP Client  │  │ MCP Client  │  │ MCP Client  │            │  │
│  │  │  (MySQL)    │  │  (GitHub)   │  │  (Slack)    │            │  │
│  │  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘            │  │
│  └─────────┼────────────────┼────────────────┼───────────────────┘  │
│            │                │                │                       │
├────────────┼────────────────┼────────────────┼───────────────────────┤
│            │                │                │   Transport Layer     │
│      ┌─────▼─────┐    ┌─────▼─────┐    ┌─────▼─────┐                │
│      │   STDIO   │    │   STDIO   │    │   HTTP    │                │
│      │ Transport │    │ Transport │    │   +SSE    │                │
│      └─────┬─────┘    └─────┬─────┘    └─────┬─────┘                │
└────────────┼────────────────┼────────────────┼───────────────────────┘
             │                │                │
             ▼                ▼                ▼
      ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
      │ MySQL MCP   │  │ GitHub MCP  │  │  Slack MCP  │
      │   Server    │  │   Server    │  │   Server    │
      └─────────────┘  └─────────────┘  └─────────────┘
```

## Core Types

```typescript
// packages/mcp/src/types.ts

/**
 * JSON-RPC 2.0 Request
 */
interface JSONRPCRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: Record<string, unknown>;
}

/**
 * JSON-RPC 2.0 Response
 */
interface JSONRPCResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

/**
 * JSON-RPC 2.0 Notification (no id, no response expected)
 */
interface JSONRPCNotification {
  jsonrpc: '2.0';
  method: string;
  params?: Record<string, unknown>;
}

/**
 * MCP Server Capabilities
 */
interface ServerCapabilities {
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
  logging?: {};
  experimental?: Record<string, unknown>;
}

/**
 * MCP Tool Definition
 */
interface MCPTool {
  name: string;
  description?: string;
  inputSchema: {
    type: 'object';
    properties?: Record<string, unknown>;
    required?: string[];
  };
}

/**
 * MCP Resource
 */
interface MCPResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

/**
 * MCP Resource Content
 */
interface MCPResourceContent {
  uri: string;
  mimeType?: string;
  text?: string;
  blob?: string; // Base64 encoded
}

/**
 * Tool Call Result
 */
interface MCPToolResult {
  content: Array<{
    type: 'text' | 'image' | 'resource';
    text?: string;
    data?: string;
    mimeType?: string;
  }>;
  isError?: boolean;
}
```

## Transport Layer

### STDIO Transport

For local MCP servers that run as child processes.

```typescript
// packages/mcp/src/transport/stdio.ts

import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import type { JSONRPCRequest, JSONRPCResponse, JSONRPCNotification } from '../types';

export class StdioTransport extends EventEmitter {
  private process: ChildProcess | null = null;
  private buffer: string = '';
  private requestId: number = 0;
  private pendingRequests: Map<string | number, {
    resolve: (value: any) => void;
    reject: (error: Error) => void;
  }> = new Map();

  constructor(
    private command: string,
    private args: string[] = [],
    private options: { cwd?: string; env?: Record<string, string> } = {}
  ) {
    super();
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.process = spawn(this.command, this.args, {
        cwd: this.options.cwd,
        env: { ...process.env, ...this.options.env },
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      this.process.stdout?.on('data', (data) => {
        this.handleData(data.toString());
      });

      this.process.stderr?.on('data', (data) => {
        // Log stderr but don't treat as protocol data
        console.error('[MCP Server stderr]:', data.toString());
      });

      this.process.on('error', (error) => {
        reject(error);
      });

      this.process.on('close', (code) => {
        this.emit('close', code);
      });

      // Give server time to start
      setTimeout(resolve, 100);
    });
  }

  async send(request: JSONRPCRequest): Promise<JSONRPCResponse> {
    if (!this.process?.stdin) {
      throw new Error('Transport not connected');
    }

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(request.id, { resolve, reject });

      const message = JSON.stringify(request) + '\n';
      this.process!.stdin!.write(message);

      // Timeout after 30 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(request.id)) {
          this.pendingRequests.delete(request.id);
          reject(new Error('Request timed out'));
        }
      }, 30000);
    });
  }

  sendNotification(notification: JSONRPCNotification): void {
    if (!this.process?.stdin) {
      throw new Error('Transport not connected');
    }

    const message = JSON.stringify(notification) + '\n';
    this.process.stdin.write(message);
  }

  nextRequestId(): number {
    return ++this.requestId;
  }

  async close(): Promise<void> {
    if (this.process) {
      this.process.kill('SIGTERM');
      this.process = null;
    }
  }

  private handleData(data: string): void {
    this.buffer += data;

    // Process complete JSON lines
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.trim()) continue;

      try {
        const message = JSON.parse(line);

        if ('id' in message && this.pendingRequests.has(message.id)) {
          // Response to a request
          const { resolve, reject } = this.pendingRequests.get(message.id)!;
          this.pendingRequests.delete(message.id);

          if (message.error) {
            reject(new Error(message.error.message));
          } else {
            resolve(message);
          }
        } else if (!('id' in message)) {
          // Notification from server
          this.emit('notification', message);
        }
      } catch (error) {
        console.error('Failed to parse MCP message:', error);
      }
    }
  }
}
```

### HTTP+SSE Transport

For remote MCP servers.

```typescript
// packages/mcp/src/transport/http.ts

import { EventEmitter } from 'events';
import type { JSONRPCRequest, JSONRPCResponse, JSONRPCNotification } from '../types';

export class HttpTransport extends EventEmitter {
  private sseConnection: EventSource | null = null;
  private sessionId: string | null = null;
  private requestId: number = 0;

  constructor(
    private baseURL: string,
    private headers: Record<string, string> = {}
  ) {
    super();
  }

  async connect(): Promise<void> {
    // Establish SSE connection for server-to-client messages
    const sseURL = new URL('/sse', this.baseURL);

    return new Promise((resolve, reject) => {
      this.sseConnection = new EventSource(sseURL.toString());

      this.sseConnection.onopen = () => {
        resolve();
      };

      this.sseConnection.onerror = (error) => {
        reject(error);
      };

      this.sseConnection.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.emit('notification', message);
        } catch (error) {
          console.error('Failed to parse SSE message:', error);
        }
      };
    });
  }

  async send(request: JSONRPCRequest): Promise<JSONRPCResponse> {
    const response = await fetch(this.baseURL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
        ...this.headers,
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type') || '';

    if (contentType.includes('text/event-stream')) {
      // Streaming response
      return this.handleStreamingResponse(response);
    } else {
      // Regular JSON response
      return await response.json();
    }
  }

  sendNotification(notification: JSONRPCNotification): void {
    fetch(this.baseURL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.headers,
      },
      body: JSON.stringify(notification),
    }).catch((error) => {
      console.error('Failed to send notification:', error);
    });
  }

  nextRequestId(): number {
    return ++this.requestId;
  }

  async close(): Promise<void> {
    if (this.sseConnection) {
      this.sseConnection.close();
      this.sseConnection = null;
    }
  }

  private async handleStreamingResponse(response: Response): Promise<JSONRPCResponse> {
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let result: JSONRPCResponse | null = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Parse SSE format
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') continue;

          try {
            result = JSON.parse(data);
          } catch {
            // Continue accumulating
          }
        }
      }
    }

    if (!result) {
      throw new Error('No response received');
    }

    return result;
  }
}
```

## MCP Client

```typescript
// packages/mcp/src/client.ts

import type { StdioTransport } from './transport/stdio';
import type { HttpTransport } from './transport/http';
import type {
  ServerCapabilities,
  MCPTool,
  MCPResource,
  MCPResourceContent,
  MCPToolResult,
} from './types';

type Transport = StdioTransport | HttpTransport;

export class MCPClient {
  private transport: Transport;
  private capabilities: ServerCapabilities | null = null;
  private initialized: boolean = false;

  constructor(transport: Transport) {
    this.transport = transport;
  }

  /**
   * Initialize the MCP connection
   */
  async initialize(): Promise<ServerCapabilities> {
    if (this.initialized) {
      return this.capabilities!;
    }

    await this.transport.connect();

    const response = await this.transport.send({
      jsonrpc: '2.0',
      id: this.transport.nextRequestId(),
      method: 'initialize',
      params: {
        protocolVersion: '2025-06-18',
        capabilities: {
          roots: { listChanged: true },
          sampling: {},
        },
        clientInfo: {
          name: 'OpenAgent',
          version: '1.0.0',
        },
      },
    });

    this.capabilities = response.result as ServerCapabilities;

    // Send initialized notification
    this.transport.sendNotification({
      jsonrpc: '2.0',
      method: 'notifications/initialized',
    });

    this.initialized = true;
    return this.capabilities;
  }

  /**
   * List available tools from the server
   */
  async listTools(): Promise<MCPTool[]> {
    if (!this.initialized) {
      await this.initialize();
    }

    const response = await this.transport.send({
      jsonrpc: '2.0',
      id: this.transport.nextRequestId(),
      method: 'tools/list',
    });

    return (response.result as { tools: MCPTool[] }).tools;
  }

  /**
   * Call a tool on the server
   */
  async callTool(name: string, arguments_: Record<string, unknown>): Promise<MCPToolResult> {
    if (!this.initialized) {
      await this.initialize();
    }

    const response = await this.transport.send({
      jsonrpc: '2.0',
      id: this.transport.nextRequestId(),
      method: 'tools/call',
      params: {
        name,
        arguments: arguments_,
      },
    });

    return response.result as MCPToolResult;
  }

  /**
   * List available resources
   */
  async listResources(): Promise<MCPResource[]> {
    if (!this.initialized) {
      await this.initialize();
    }

    const response = await this.transport.send({
      jsonrpc: '2.0',
      id: this.transport.nextRequestId(),
      method: 'resources/list',
    });

    return (response.result as { resources: MCPResource[] }).resources;
  }

  /**
   * Read a resource by URI
   */
  async readResource(uri: string): Promise<MCPResourceContent> {
    if (!this.initialized) {
      await this.initialize();
    }

    const response = await this.transport.send({
      jsonrpc: '2.0',
      id: this.transport.nextRequestId(),
      method: 'resources/read',
      params: { uri },
    });

    return (response.result as { contents: MCPResourceContent[] }).contents[0];
  }

  /**
   * Close the connection
   */
  async close(): Promise<void> {
    await this.transport.close();
    this.initialized = false;
  }
}
```

## MCP Registry

```typescript
// packages/mcp/src/registry.ts

import { MCPClient } from './client';
import { StdioTransport } from './transport/stdio';
import { HttpTransport } from './transport/http';
import type { MCPTool } from './types';
import type { Tool, ToolResult, ExecutionContext } from '@openagent/tools';

interface ServerConfig {
  name: string;
  type: 'stdio' | 'http';

  // For stdio
  command?: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;

  // For http
  url?: string;
  headers?: Record<string, string>;
}

export class MCPRegistry {
  private servers: Map<string, { config: ServerConfig; client: MCPClient }> = new Map();

  /**
   * Add and connect to an MCP server
   */
  async addServer(config: ServerConfig): Promise<void> {
    if (this.servers.has(config.name)) {
      throw new Error(`Server '${config.name}' already registered`);
    }

    let transport;

    if (config.type === 'stdio') {
      if (!config.command) {
        throw new Error('STDIO transport requires command');
      }
      transport = new StdioTransport(
        config.command,
        config.args,
        { cwd: config.cwd, env: config.env }
      );
    } else if (config.type === 'http') {
      if (!config.url) {
        throw new Error('HTTP transport requires url');
      }
      transport = new HttpTransport(config.url, config.headers);
    } else {
      throw new Error(`Unknown transport type: ${config.type}`);
    }

    const client = new MCPClient(transport);
    await client.initialize();

    this.servers.set(config.name, { config, client });
  }

  /**
   * Remove and disconnect from an MCP server
   */
  async removeServer(name: string): Promise<void> {
    const server = this.servers.get(name);
    if (server) {
      await server.client.close();
      this.servers.delete(name);
    }
  }

  /**
   * Get all tools from all connected servers
   */
  async getAllTools(): Promise<Tool[]> {
    const tools: Tool[] = [];

    for (const [serverName, { client }] of this.servers) {
      const mcpTools = await client.listTools();

      for (const mcpTool of mcpTools) {
        tools.push(this.wrapMCPTool(serverName, mcpTool, client));
      }
    }

    return tools;
  }

  /**
   * Get a specific client by server name
   */
  getClient(name: string): MCPClient | undefined {
    return this.servers.get(name)?.client;
  }

  /**
   * Wrap an MCP tool as an OpenAgent Tool
   */
  private wrapMCPTool(serverName: string, mcpTool: MCPTool, client: MCPClient): Tool {
    return {
      // Prefix tool name with server name to avoid conflicts
      name: `mcp__${serverName}__${mcpTool.name}`,

      description: mcpTool.description || `MCP tool from ${serverName}`,

      parameters: {
        type: 'object',
        properties: mcpTool.inputSchema.properties || {},
        required: mcpTool.inputSchema.required,
      },

      async execute(params: Record<string, unknown>): Promise<ToolResult> {
        try {
          const result = await client.callTool(mcpTool.name, params);

          // Convert MCP result to OpenAgent format
          const output = result.content
            .map((c) => {
              if (c.type === 'text') return c.text;
              if (c.type === 'image') return `[Image: ${c.mimeType}]`;
              return JSON.stringify(c);
            })
            .join('\n');

          return {
            success: !result.isError,
            output,
            error: result.isError ? output : undefined,
          };
        } catch (error) {
          return {
            success: false,
            output: '',
            error: `MCP tool error: ${error}`,
          };
        }
      },
    };
  }
}
```

## Example: Database MCP Server

See [templates/mcp-server-template.ts](../templates/mcp-server-template.ts) for a complete template.

Basic structure for a MySQL MCP server:

```typescript
// mcp-servers/database/src/index.ts

import mysql from 'mysql2/promise';

class DatabaseMCPServer {
  private connection: mysql.Connection | null = null;

  async connect(config: { host: string; user: string; password: string; database: string }) {
    this.connection = await mysql.createConnection(config);
  }

  getTools() {
    return [
      {
        name: 'query',
        description: 'Execute a read-only SQL query',
        inputSchema: {
          type: 'object',
          properties: {
            sql: { type: 'string', description: 'SQL query to execute' },
          },
          required: ['sql'],
        },
      },
      {
        name: 'inspect',
        description: 'Get schema for a table',
        inputSchema: {
          type: 'object',
          properties: {
            table: { type: 'string', description: 'Table name' },
          },
          required: ['table'],
        },
      },
      {
        name: 'sample',
        description: 'Get sample rows from a table',
        inputSchema: {
          type: 'object',
          properties: {
            table: { type: 'string', description: 'Table name' },
            limit: { type: 'number', description: 'Number of rows' },
          },
          required: ['table'],
        },
      },
    ];
  }

  async handleToolCall(name: string, args: Record<string, unknown>) {
    switch (name) {
      case 'query':
        return this.executeQuery(args.sql as string);
      case 'inspect':
        return this.inspectTable(args.table as string);
      case 'sample':
        return this.sampleTable(args.table as string, args.limit as number);
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }

  private async executeQuery(sql: string) {
    // Only allow SELECT, SHOW, DESCRIBE, EXPLAIN
    const upperSQL = sql.trim().toUpperCase();
    if (!['SELECT', 'SHOW', 'DESCRIBE', 'EXPLAIN'].some(cmd => upperSQL.startsWith(cmd))) {
      throw new Error('Only read-only queries are allowed');
    }

    const [rows] = await this.connection!.execute(sql);
    return { content: [{ type: 'text', text: JSON.stringify(rows, null, 2) }] };
  }

  private async inspectTable(table: string) {
    const [columns] = await this.connection!.execute(
      `DESCRIBE ${mysql.escapeId(table)}`
    );
    return { content: [{ type: 'text', text: JSON.stringify(columns, null, 2) }] };
  }

  private async sampleTable(table: string, limit: number = 10) {
    const [rows] = await this.connection!.execute(
      `SELECT * FROM ${mysql.escapeId(table)} LIMIT ?`,
      [limit]
    );
    return { content: [{ type: 'text', text: JSON.stringify(rows, null, 2) }] };
  }
}
```

## Configuration

MCP servers are configured in `~/.openagent/config.json`:

```json
{
  "mcp": {
    "servers": {
      "mysql-main": {
        "type": "stdio",
        "command": "npx",
        "args": ["@openagent/mcp-server-database"],
        "env": {
          "DATABASE_URL": "mysql://user:pass@localhost/mydb"
        }
      },
      "github": {
        "type": "stdio",
        "command": "npx",
        "args": ["@modelcontextprotocol/server-github"],
        "env": {
          "GITHUB_TOKEN": "ghp_..."
        }
      },
      "remote-api": {
        "type": "http",
        "url": "https://api.example.com/mcp",
        "headers": {
          "Authorization": "Bearer ..."
        }
      }
    }
  }
}
```

## CLI Commands

```bash
# Add a new MCP server
openagent mcp add mysql-db --type stdio --command "npx @openagent/mcp-server-database" --env DATABASE_URL=mysql://...

# List connected servers
openagent mcp list

# List tools from a server
openagent mcp tools mysql-db

# Remove a server
openagent mcp remove mysql-db
```

## Next Steps

- See [TOOL-SYSTEM.md](TOOL-SYSTEM.md) for how MCP tools integrate
- See [CONFIGURATION.md](CONFIGURATION.md) for config file details
- See [templates/mcp-server-template.ts](../templates/mcp-server-template.ts) for creating servers
