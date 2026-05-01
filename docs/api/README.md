# OpenAgent API Documentation

This document provides an overview of OpenAgent's public APIs, interfaces, and extension points.

## LLM Provider Interface

To create a custom LLM provider, implement the `LLMProvider` interface from `@pram1t/mustard-llm`:

```typescript
import { LLMProvider, ChatMessage, ChatResponse, TokenCount } from '@pram1t/mustard-llm';

export class MyProvider implements LLMProvider {
  readonly name = 'my-provider';

  async chat(messages: ChatMessage[], options?: ChatOptions): Promise<ChatResponse> {
    // Send messages to your LLM backend and return a ChatResponse.
    // Must handle streaming if options.stream is true.
  }

  async countTokens(messages: ChatMessage[]): Promise<TokenCount> {
    // Return token count for the given messages.
    // Used for context window management and compaction decisions.
  }

  async validate(): Promise<boolean> {
    // Verify that the provider is correctly configured
    // (e.g., API key is set, endpoint is reachable).
    // Return true if valid, false otherwise.
  }
}
```

Register the provider in the LLM router so it can be selected via `--provider`:

```typescript
import { registerProvider } from '@pram1t/mustard-llm';
import { MyProvider } from './my-provider';

registerProvider('my-provider', () => new MyProvider());
```

## Tool Interface

To create a custom tool, implement the `Tool` interface from `@pram1t/mustard-tools`:

```typescript
import { Tool, ToolResult } from '@pram1t/mustard-tools';

export const myTool: Tool = {
  name: 'my_tool',
  description: 'A short description of what the tool does.',
  parameters: {
    type: 'object',
    properties: {
      input: { type: 'string', description: 'The input value' },
    },
    required: ['input'],
  },

  async execute(params: { input: string }): Promise<ToolResult> {
    // Perform the tool's action and return a result.
    const output = await doSomething(params.input);
    return { content: output };
  },
};
```

Register the tool in the tool registry:

```typescript
import { registerTool } from '@pram1t/mustard-tools';
import { myTool } from './my-tool';

registerTool(myTool);
```

## Configuration Schema

Key configuration options that can be set in `.openagent/config.json`, environment variables, or CLI flags:

| Option | Type | Default | Description |
|---|---|---|---|
| `model` | `string` | `"gpt-4o"` | Model identifier to use |
| `provider` | `string` | `"openai"` | LLM provider name |
| `permissions` | `"permissive" \| "default" \| "strict"` | `"default"` | Permission mode for tool execution |
| `mcpServers` | `Record<string, McpServerConfig>` | `{}` | MCP server configurations |
| `hooks` | `HookConfig[]` | `[]` | Lifecycle hooks (pre/post tool execution) |
| `systemPrompt` | `string` | Built-in prompt | Custom system prompt override |
| `maxTokens` | `number` | Provider default | Maximum tokens for responses |
| `temperature` | `number` | `0` | Sampling temperature |
| `contextWindow` | `number` | Model default | Context window size override |
| `compaction` | `boolean` | `true` | Enable automatic context compaction |

### McpServerConfig

```typescript
interface McpServerConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
  enabled?: boolean;
}
```

### HookConfig

```typescript
interface HookConfig {
  event: 'pre_tool' | 'post_tool' | 'pre_chat' | 'post_chat';
  command: string;
  tools?: string[];       // Filter to specific tool names
  blocking?: boolean;     // Whether to wait for hook completion
}
```

## CLI Commands Reference

### Main Command

```
openagent [options] [prompt]
```

| Flag | Description |
|---|---|
| `--provider <name>` | LLM provider (openai, anthropic, gemini, ollama, openai-compatible) |
| `--model <id>` | Model identifier |
| `--permissions <mode>` | Permission mode (permissive, default, strict) |
| `--base-url <url>` | Base URL for openai-compatible provider |
| `--resume` | Resume the most recent session |
| `--session <id>` | Resume a specific session |
| `--orchestrate` | Enable multi-worker orchestration mode |
| `--system-prompt <text>` | Override the system prompt |
| `--max-tokens <n>` | Maximum response tokens |
| `--temperature <n>` | Sampling temperature |
| `--verbose` | Enable verbose logging |
| `--no-stream` | Disable streaming output |

### Subcommands

| Command | Description |
|---|---|
| `openagent init` | Initialize project configuration (.openagent/) |
| `openagent mcp add <name>` | Add an MCP server |
| `openagent mcp remove <name>` | Remove an MCP server |
| `openagent mcp list` | List configured MCP servers |
| `openagent session list` | List saved sessions |
| `openagent session show <id>` | Show session details |
| `openagent session delete <id>` | Delete a session |
| `openagent config get <key>` | Get a configuration value |
| `openagent config set <key> <value>` | Set a configuration value |

## Event Types

OpenAgent emits `AgentEvent` objects during execution. All events share a common shape with a discriminated `type` field:

| Event Type | Description | Key Fields |
|---|---|---|
| `text` | Streamed text chunk from the LLM | `content: string` |
| `tool_call` | Agent is invoking a tool | `toolName: string`, `args: object`, `callId: string` |
| `tool_result` | Result returned from a tool | `callId: string`, `content: string`, `isError: boolean` |
| `error` | An error occurred | `message: string`, `code?: string` |
| `done` | Agent has finished processing | `usage?: TokenUsage` |
| `thinking` | Model is reasoning (for models that support it) | `content: string` |
| `compaction` | Context was compacted to fit within limits | `originalTokens: number`, `compactedTokens: number` |
| `hook_triggered` | A lifecycle hook was triggered | `hook: string`, `event: string` |
| `hook_blocked` | A hook blocked the operation | `hook: string`, `reason: string` |
| `permission_denied` | User denied a tool permission request | `toolName: string` |
| `permission_ask` | Agent is requesting permission for a tool | `toolName: string`, `args: object` |

### Subscribing to Events

```typescript
import { createAgent } from '@pram1t/mustard-core';

const agent = createAgent({ provider: 'openai' });

for await (const event of agent.run('Hello')) {
  switch (event.type) {
    case 'text':
      process.stdout.write(event.content);
      break;
    case 'tool_call':
      console.log(`Calling tool: ${event.toolName}`);
      break;
    case 'error':
      console.error(`Error: ${event.message}`);
      break;
    case 'done':
      console.log('Complete.');
      break;
  }
}
```

## Package Exports

### @pram1t/mustard-core

The main orchestration package. Entry point for creating and running agents.

- `createAgent(config)` -- Create an agent instance
- `Agent` -- Agent class
- `AgentEvent` -- Event type union
- `AgentConfig` -- Configuration type
- `Session` -- Session management

### @pram1t/mustard-llm

LLM provider abstraction and routing.

- `LLMProvider` -- Provider interface
- `ChatMessage`, `ChatResponse` -- Message types
- `registerProvider(name, factory)` -- Register a provider
- `createProvider(name, config)` -- Instantiate a provider
- `TokenCount`, `TokenUsage` -- Token tracking types

### @pram1t/mustard-tools

Built-in tools and the tool registration system.

- `Tool` -- Tool interface
- `ToolResult` -- Result type
- `registerTool(tool)` -- Register a tool
- `getToolRegistry()` -- Get all registered tools
- Built-in tools: `read_file`, `write_file`, `edit_file`, `shell`, `glob`, `grep`, `list_dir`

### @pram1t/mustard-mcp

Model Context Protocol client for connecting to MCP servers.

- `McpClient` -- MCP client class
- `McpServerConfig` -- Server configuration type
- `connectServer(config)` -- Connect to an MCP server
- `discoverTools(client)` -- List tools from a server

### @pram1t/mustard-config

Configuration loading, merging, and validation.

- `loadConfig(options)` -- Load and merge configuration
- `ConfigSchema` -- Zod schema for validation
- `resolveConfig(overrides)` -- Resolve final config from all sources
- `getDefaultConfig()` -- Get built-in defaults

### @pram1t/mustard-logger

Structured logging with configurable levels.

- `createLogger(options)` -- Create a logger instance
- `Logger` -- Logger interface (debug, info, warn, error)
- `LogLevel` -- Log level enum

### @pram1t/mustard-hooks

Lifecycle hook system for pre/post tool and chat events.

- `HookRunner` -- Executes hooks
- `HookConfig` -- Hook configuration type
- `registerHook(config)` -- Register a hook

### @pram1t/mustard-test-utils

Shared testing utilities for the monorepo.

- `createMockProvider()` -- Mock LLM provider
- `createMockTool()` -- Mock tool
- `createTestAgent(overrides)` -- Pre-configured agent for tests
- `captureEvents(agent)` -- Capture all events from a run
