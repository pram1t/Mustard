/**
 * MCP Server Template
 *
 * Use this template to create a new MCP server that can be connected to OpenAgent.
 * This implements the Model Context Protocol for external integrations.
 */

import * as readline from 'readline';

// =============================================================================
// MCP TYPES
// =============================================================================

interface JSONRPCRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: Record<string, unknown>;
}

interface JSONRPCResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

interface MCPToolResult {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
}

// =============================================================================
// YOUR MCP SERVER
// =============================================================================

/**
 * Your MCP Server Implementation
 *
 * Replace "MyService" with your service name (e.g., "Database", "Slack", etc.)
 */
class MyServiceMCPServer {
  // Store any connections or state here
  private client: any = null;

  /**
   * Initialize your service connection
   */
  async initialize(config: Record<string, unknown>): Promise<void> {
    // Example: Connect to your service
    // this.client = await connectToService(config);

    console.error('[MyService MCP] Initialized'); // Log to stderr, not stdout!
  }

  /**
   * Define the tools your server provides
   */
  getTools(): MCPTool[] {
    return [
      {
        name: 'my_service_action',
        description: 'Performs an action in MyService. Describe what it does clearly.',
        inputSchema: {
          type: 'object',
          properties: {
            param1: {
              type: 'string',
              description: 'Description of parameter 1',
            },
            param2: {
              type: 'number',
              description: 'Description of parameter 2',
            },
          },
          required: ['param1'],
        },
      },
      {
        name: 'my_service_query',
        description: 'Queries data from MyService. Returns results in a structured format.',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'The query to execute',
            },
            limit: {
              type: 'number',
              description: 'Maximum number of results to return',
            },
          },
          required: ['query'],
        },
      },
      // Add more tools as needed
    ];
  }

  /**
   * Handle tool calls
   */
  async handleToolCall(
    name: string,
    args: Record<string, unknown>
  ): Promise<MCPToolResult> {
    switch (name) {
      case 'my_service_action':
        return this.handleAction(args);

      case 'my_service_query':
        return this.handleQuery(args);

      default:
        return {
          content: [{ type: 'text', text: `Unknown tool: ${name}` }],
          isError: true,
        };
    }
  }

  /**
   * Handle the action tool
   */
  private async handleAction(args: Record<string, unknown>): Promise<MCPToolResult> {
    const { param1, param2 = 0 } = args as { param1: string; param2?: number };

    try {
      // Implement your action logic here
      // Example:
      // const result = await this.client.doAction(param1, param2);

      const result = `Action performed with ${param1} and ${param2}`;

      return {
        content: [{ type: 'text', text: result }],
      };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Action failed: ${error}` }],
        isError: true,
      };
    }
  }

  /**
   * Handle the query tool
   */
  private async handleQuery(args: Record<string, unknown>): Promise<MCPToolResult> {
    const { query, limit = 10 } = args as { query: string; limit?: number };

    try {
      // Implement your query logic here
      // Example:
      // const results = await this.client.query(query, limit);

      const results = [
        { id: 1, name: 'Result 1' },
        { id: 2, name: 'Result 2' },
      ];

      return {
        content: [{ type: 'text', text: JSON.stringify(results, null, 2) }],
      };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Query failed: ${error}` }],
        isError: true,
      };
    }
  }

  /**
   * Cleanup when server shuts down
   */
  async cleanup(): Promise<void> {
    // Close connections, cleanup resources
    // Example:
    // await this.client?.close();
    console.error('[MyService MCP] Cleaned up');
  }
}

// =============================================================================
// MCP SERVER RUNNER (STDIO Transport)
// =============================================================================

async function runMCPServer() {
  const server = new MyServiceMCPServer();
  let initialized = false;

  // Create readline interface for STDIO
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false,
  });

  /**
   * Send a JSON-RPC response
   */
  function sendResponse(response: JSONRPCResponse): void {
    // IMPORTANT: Use stdout for protocol, stderr for logging
    process.stdout.write(JSON.stringify(response) + '\n');
  }

  /**
   * Handle incoming JSON-RPC requests
   */
  async function handleRequest(request: JSONRPCRequest): Promise<void> {
    try {
      switch (request.method) {
        // Initialize handshake
        case 'initialize': {
          // Initialize with config from environment
          await server.initialize({
            // Read config from environment variables
            apiKey: process.env.MY_SERVICE_API_KEY,
            url: process.env.MY_SERVICE_URL,
          });

          sendResponse({
            jsonrpc: '2.0',
            id: request.id,
            result: {
              protocolVersion: '2025-06-18',
              capabilities: {
                tools: { listChanged: false },
              },
              serverInfo: {
                name: 'my-service-mcp',
                version: '1.0.0',
              },
            },
          });
          break;
        }

        // List available tools
        case 'tools/list': {
          sendResponse({
            jsonrpc: '2.0',
            id: request.id,
            result: {
              tools: server.getTools(),
            },
          });
          break;
        }

        // Call a tool
        case 'tools/call': {
          const { name, arguments: args } = request.params as {
            name: string;
            arguments?: Record<string, unknown>;
          };

          const result = await server.handleToolCall(name, args || {});

          sendResponse({
            jsonrpc: '2.0',
            id: request.id,
            result,
          });
          break;
        }

        // Unknown method
        default: {
          sendResponse({
            jsonrpc: '2.0',
            id: request.id,
            error: {
              code: -32601,
              message: `Unknown method: ${request.method}`,
            },
          });
        }
      }
    } catch (error) {
      sendResponse({
        jsonrpc: '2.0',
        id: request.id,
        error: {
          code: -32603,
          message: `Internal error: ${error}`,
        },
      });
    }
  }

  // Handle incoming lines
  rl.on('line', async (line) => {
    if (!line.trim()) return;

    try {
      const request = JSON.parse(line) as JSONRPCRequest;

      // Handle notifications (no id, no response)
      if (!('id' in request)) {
        if (request.method === 'notifications/initialized') {
          initialized = true;
          console.error('[MyService MCP] Client initialized');
        }
        return;
      }

      await handleRequest(request);
    } catch (error) {
      console.error('[MyService MCP] Parse error:', error);
    }
  });

  // Handle close
  rl.on('close', async () => {
    await server.cleanup();
    process.exit(0);
  });

  // Handle signals
  process.on('SIGTERM', async () => {
    await server.cleanup();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    await server.cleanup();
    process.exit(0);
  });

  console.error('[MyService MCP] Server started, waiting for connections...');
}

// Run the server
runMCPServer().catch((error) => {
  console.error('[MyService MCP] Fatal error:', error);
  process.exit(1);
});

// =============================================================================
// CONFIGURATION EXAMPLE
// =============================================================================

/*
Add to OpenAgent config (~/.openagent/config.json):

{
  "mcp": {
    "servers": {
      "my-service": {
        "type": "stdio",
        "command": "node",
        "args": ["path/to/this/server.js"],
        "env": {
          "MY_SERVICE_API_KEY": "your-api-key",
          "MY_SERVICE_URL": "https://api.myservice.com"
        }
      }
    }
  }
}

Or add via CLI:

openagent mcp add my-service \
  --type stdio \
  --command "node path/to/server.js" \
  --env MY_SERVICE_API_KEY=your-key \
  --env MY_SERVICE_URL=https://api.myservice.com
*/

// =============================================================================
// BEST PRACTICES
// =============================================================================

/*
1. LOGGING
   - Always use stderr for logs (console.error)
   - Never use stdout for logs (it's for protocol messages only)
   - Include [ServerName] prefix for clarity

2. ERROR HANDLING
   - Return isError: true in tool results for failures
   - Provide clear error messages
   - Don't crash on individual request failures

3. TOOL DESIGN
   - Keep tools focused on single actions
   - Use clear, descriptive names
   - Document parameters thoroughly
   - Include sensible defaults

4. SECURITY
   - Validate all inputs
   - Use environment variables for secrets
   - Implement read-only mode where appropriate
   - Don't expose sensitive data in error messages

5. RESOURCE MANAGEMENT
   - Clean up connections on shutdown
   - Handle SIGTERM and SIGINT
   - Implement connection pooling if needed

6. PERFORMANCE
   - Stream large results if possible
   - Set reasonable timeouts
   - Cache where appropriate
*/
