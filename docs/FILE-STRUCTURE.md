# OpenAgent File Structure

> Complete guide to the codebase architecture and file organization

---

## Overview

OpenAgent is a **monorepo** using npm workspaces with three main directories:

```
openagent/
├── apps/           # Runnable applications (CLI, Desktop)
├── packages/       # Shared libraries and core functionality
├── mcp-servers/    # Custom MCP servers (planned)
└── docs/           # Documentation
```

---

## Root Files

```
openagent/
├── package.json        # Monorepo root - defines workspaces, scripts, shared deps
├── turbo.json          # Turborepo config - build pipeline, caching
├── tsconfig.json       # Base TypeScript config inherited by all packages
├── vitest.config.ts    # Test configuration for Vitest
├── .npmrc              # npm configuration (registry, auth settings)
├── .gitignore          # Git ignore patterns
└── README.md           # Project overview
```

| File | Purpose |
|------|---------|
| `package.json` | Defines workspaces (`apps/*`, `packages/*`, `mcp-servers/*`), root scripts (`build`, `dev`, `test`), shared devDependencies |
| `turbo.json` | Configures Turborepo build orchestration - parallel builds, dependency ordering, caching |
| `tsconfig.json` | Base TypeScript settings - all packages extend this for consistency |

---

## Apps Directory

Applications that users run directly.

```
apps/
├── cli/                    # Command-line interface
│   ├── src/
│   │   └── index.ts        # Main CLI entry point
│   ├── package.json        # CLI dependencies (@pram1t/mustard-* packages)
│   └── tsconfig.json       # TypeScript config extending root
│
└── desktop/                # Desktop app (planned - Electron/Tauri)
    └── (future)
```

### `apps/cli/`

The primary way to interact with OpenAgent. A single-file CLI that:

| File | Purpose |
|------|---------|
| `src/index.ts` | Main entry point - parses args, creates provider, runs agent loop, handles MCP subcommands |

**Key responsibilities:**
- Parse command-line arguments (`--provider`, `--model`, `--base-url`, etc.)
- Initialize the appropriate LLM provider (OpenAI, Anthropic, Gemini, Ollama, OpenAI-compatible)
- Create the agent loop with tools
- Handle MCP server management (`mcp add`, `mcp remove`, `mcp list`)
- Stream agent output to terminal
- Graceful error handling

---

## Packages Directory

Shared libraries that make up the core functionality.

```
packages/
├── core/           # Agent loop, orchestration, context management
├── llm/            # LLM provider abstraction layer
├── tools/          # Built-in tools (Bash, Read, Write, etc.)
├── mcp/            # Model Context Protocol client
├── config/         # Configuration loading and validation
├── logger/         # Structured logging (Pino-based)
├── hooks/          # Event hooks system (placeholder)
└── test-utils/     # Shared test utilities
```

---

### `packages/core/` - Agent Core

The brain of OpenAgent. Manages the conversation loop, tool execution, and context.

```
packages/core/
├── src/
│   ├── index.ts                # Package entry - exports public API
│   │
│   ├── agent/                  # Agent loop logic
│   │   ├── index.ts            # Re-exports from agent module
│   │   ├── loop.ts             # AgentLoop class - main orchestration engine
│   │   ├── types.ts            # Agent types (AgentConfig, AgentEvent, AgentState)
│   │   ├── execution.ts        # Tool execution logic
│   │   └── system-prompt.ts    # OS-aware system prompt generation
│   │
│   └── context/                # Conversation context management
│       ├── index.ts            # Re-exports from context module
│       ├── manager.ts          # ContextManager class - memory, compaction
│       └── types.ts            # Context types (ContextConfig, ContextState)
│
├── package.json
└── tsconfig.json
```

| File | Purpose |
|------|---------|
| `agent/loop.ts` | **AgentLoop** class - the main orchestration engine. Receives user input, calls LLM, executes tools, streams events. Handles max iterations, abort signals, context compaction. |
| `agent/types.ts` | Type definitions: `AgentConfig`, `AgentEvent` (text, tool_call, tool_result, error, done), `AgentState`, `RunOptions` |
| `agent/execution.ts` | `executeTools()` function - runs tools in parallel, handles errors, returns results |
| `agent/system-prompt.ts` | Generates OS-aware system prompts. Detects Windows/Mac/Linux, sets appropriate shell (cmd.exe vs bash), configures path handling |
| `context/manager.ts` | **ContextManager** class - manages conversation history, token counting, automatic compaction when context gets too long |
| `context/types.ts` | Context configuration types: max tokens, compaction thresholds |

---

### `packages/llm/` - LLM Abstraction

Provider-agnostic interface for interacting with any LLM backend.

```
packages/llm/
├── src/
│   ├── index.ts                # Package entry - exports all adapters and types
│   ├── types.ts                # Core LLM types (Message, ToolCall, StreamChunk, etc.)
│   ├── router.ts               # LLMRouter - routes requests to providers
│   │
│   ├── adapters/               # Provider implementations
│   │   ├── openai.ts           # OpenAI GPT models (gpt-4o, gpt-4-turbo, etc.)
│   │   ├── anthropic.ts        # Anthropic Claude models (claude-3-opus, sonnet, haiku)
│   │   ├── gemini.ts           # Google Gemini models (gemini-1.5-pro, flash)
│   │   ├── ollama.ts           # Local Ollama models (llama3.2, qwen2.5-coder, etc.)
│   │   └── openai-compatible.ts # Any OpenAI-compatible API (LM Studio, vLLM, etc.)
│   │
│   └── __tests__/              # Unit tests
│       ├── mocks.ts            # Mock providers for testing
│       └── router.test.ts      # Router tests
│
├── package.json
└── tsconfig.json
```

| File | Purpose |
|------|---------|
| `types.ts` | Core types: `Message` (user/assistant/tool), `ToolCall`, `ToolDefinition`, `StreamChunk` (text/tool_call/usage/error/done), `LLMProvider` interface |
| `router.ts` | **LLMRouter** class - wraps providers, handles streaming, routes chat requests. Could support multiple providers with fallback (future) |
| `adapters/openai.ts` | **OpenAIProvider** - uses official OpenAI SDK, supports streaming, tool calling. Default model: `gpt-4o` |
| `adapters/anthropic.ts` | **AnthropicProvider** - uses Anthropic SDK, converts between message formats, supports streaming. Default model: `claude-sonnet-4-20250514` |
| `adapters/gemini.ts` | **GeminiProvider** - uses Google Generative AI SDK, handles function calling format differences. Default model: `gemini-1.5-pro` |
| `adapters/ollama.ts` | **OllamaProvider** - connects to local Ollama server, OpenAI-compatible API. Default model: `qwen2.5-coder:7b` |
| `adapters/openai-compatible.ts` | **OpenAICompatibleProvider** - generic adapter for any OpenAI-compatible endpoint (LM Studio, vLLM, etc.) |

**Key abstractions:**
- All providers implement `LLMProvider` interface
- All providers return `AsyncGenerator<StreamChunk>` for streaming
- Tool definitions are normalized to OpenAI format internally

---

### `packages/tools/` - Built-in Tools

File operations, shell execution, and search capabilities.

```
packages/tools/
├── src/
│   ├── index.ts                # Package entry - exports all tools and registry
│   ├── types.ts                # Tool types (Tool, ToolResult, ExecutionContext)
│   ├── base.ts                 # BaseTool class - extend this to create tools
│   ├── registry.ts             # ToolRegistry - manages tool collection
│   ├── security.ts             # Path sanitization, command validation
│   │
│   ├── builtin/                # Built-in tool implementations
│   │   ├── index.ts            # Exports all builtin tools
│   │   ├── bash.ts             # Shell command execution
│   │   ├── read.ts             # File reading
│   │   ├── write.ts            # File writing/creation
│   │   ├── edit.ts             # File editing (find/replace)
│   │   ├── glob.ts             # File pattern matching
│   │   └── grep.ts             # Content search (regex)
│   │
│   └── __tests__/              # Unit tests
│       ├── bash.test.ts
│       ├── read.test.ts
│       ├── write.test.ts
│       ├── edit.test.ts
│       ├── glob.test.ts
│       ├── grep.test.ts
│       ├── registry.test.ts
│       └── security.test.ts
│
├── package.json
└── tsconfig.json
```

| File | Purpose |
|------|---------|
| `types.ts` | Core types: `Tool` interface, `ToolResult` (success, output, error), `ExecutionContext` (cwd, sessionId, homeDir) |
| `base.ts` | **BaseTool** abstract class - provides common functionality, parameter validation. Extend to create custom tools |
| `registry.ts` | **ToolRegistry** class - registers tools, gets definitions for LLM, executes by name. `createDefaultRegistry()` creates registry with all built-in tools |
| `security.ts` | Security utilities: `sanitizePath()` prevents path traversal, `validateCommand()` blocks dangerous commands, `auditLog()` for tracking |
| `builtin/bash.ts` | **BashTool** - executes shell commands. Detects OS, uses appropriate shell (cmd.exe on Windows, bash on Unix). Timeout support, output capture |
| `builtin/read.ts` | **ReadTool** - reads file contents. Supports offset/limit for large files, line numbers in output |
| `builtin/write.ts` | **WriteTool** - creates/overwrites files. Creates parent directories if needed |
| `builtin/edit.ts` | **EditTool** - find/replace in files. Requires exact match, prevents accidental edits |
| `builtin/glob.ts` | **GlobTool** - finds files by pattern. Uses fast-glob, respects gitignore |
| `builtin/grep.ts` | **GrepTool** - searches file contents. Regex support, context lines, multiple output modes |

---

### `packages/mcp/` - Model Context Protocol Client

Connect to external tool servers using the MCP protocol.

```
packages/mcp/
├── src/
│   ├── index.ts                # Package entry - exports client, registry, types
│   ├── types.ts                # MCP protocol types (JSON-RPC, tools, resources)
│   ├── client.ts               # MCPClient - connects to single server
│   ├── registry.ts             # MCPRegistry - manages multiple servers
│   │
│   └── transport/              # Communication layer
│       ├── index.ts            # Transport exports
│       ├── types.ts            # Transport interface
│       ├── stdio.ts            # STDIO transport (spawn process, communicate via stdin/stdout)
│       └── http.ts             # HTTP transport (REST API with optional SSE)
│
├── package.json
└── tsconfig.json
```

| File | Purpose |
|------|---------|
| `types.ts` | MCP protocol types: JSON-RPC request/response, `MCPTool`, `MCPResource`, `MCPPrompt`, server configs, error types |
| `client.ts` | **MCPClient** class - connects to one MCP server, handles initialization handshake, lists/calls tools, reads resources |
| `registry.ts` | **MCPRegistry** class - manages multiple MCP servers, aggregates tools (prefixed with server name), routes tool calls |
| `transport/stdio.ts` | **StdioTransport** - spawns child process, sends JSON-RPC via stdin, receives via stdout. Used for local MCP servers |
| `transport/http.ts` | **HttpTransport** - HTTP POST for requests, optional SSE for streaming. Used for remote MCP servers |

**MCP Flow:**
1. Registry creates clients for each configured server
2. Client connects via transport (stdio or http)
3. Client performs initialize handshake
4. Client lists available tools
5. Registry aggregates tools from all servers
6. When agent calls MCP tool, registry routes to correct server

---

### `packages/config/` - Configuration

Load and validate configuration from files and environment.

```
packages/config/
├── src/
│   ├── index.ts                # Package entry
│   ├── schema.ts               # Configuration schema (Zod)
│   ├── loader.ts               # Load config from files, env, defaults
│   │
│   └── __tests__/
│       └── config.test.ts
│
├── package.json
└── tsconfig.json
```

| File | Purpose |
|------|---------|
| `schema.ts` | Zod schemas defining valid configuration structure. Includes defaults, validation rules |
| `loader.ts` | `loadConfig()` function - loads from `~/.openagent/config.json`, environment variables, with fallback defaults. `validateStartup()` checks required API keys |

**Config sources (in priority order):**
1. Environment variables (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, etc.)
2. Config file (`~/.openagent/config.json`)
3. Built-in defaults

---

### `packages/logger/` - Logging

Structured logging using Pino.

```
packages/logger/
├── src/
│   ├── index.ts                # Package entry - exports logger functions
│   ├── types.ts                # Logger types (LogLevel, LoggerConfig)
│   ├── factory.ts              # Logger factory - creates configured loggers
│   │
│   └── __tests__/
│       └── logger.test.ts
│
├── package.json
└── tsconfig.json
```

| File | Purpose |
|------|---------|
| `types.ts` | Log level enum, logger config interface |
| `factory.ts` | `createLogger()` - creates Pino logger with pretty printing in dev, JSON in production |
| `index.ts` | Exports `createLogger()`, `setDefaultLogger()`, `getLogger()` for global logger access |

---

### `packages/hooks/` - Event Hooks (Placeholder)

Future home of the hook system for extending agent behavior.

```
packages/hooks/
├── src/
│   └── index.ts                # Placeholder export
├── package.json
└── tsconfig.json
```

**Planned features:**
- Pre/post tool execution hooks
- Message transformation hooks
- Custom validation hooks

---

### `packages/test-utils/` - Test Utilities

Shared utilities for testing across packages.

```
packages/test-utils/
├── src/
│   └── index.ts                # Test helpers, mock factories
├── package.json
└── tsconfig.json
```

---

## Docs Directory

Project documentation.

```
docs/
├── FILE-STRUCTURE.md       # This file - codebase overview
├── CONFIGURATION.md        # Configuration options reference
├── LOGGING.md              # Logging setup and usage
├── SECURITY.md             # Security considerations
├── TESTING.md              # Testing guide
└── TEST-REPORT-*.md        # Test run reports
```

---

## Data Flow

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                              USER INPUT                                       │
│                           "Fix the bug in auth"                              │
└─────────────────────────────────────┬────────────────────────────────────────┘
                                      │
                                      ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                               CLI (apps/cli)                                  │
│  • Parses arguments                                                          │
│  • Creates LLM provider                                                      │
│  • Initializes tools                                                         │
│  • Starts agent loop                                                         │
└─────────────────────────────────────┬────────────────────────────────────────┘
                                      │
                                      ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                           AGENT LOOP (packages/core)                          │
│  • Manages conversation context                                              │
│  • Sends messages to LLM                                                     │
│  • Executes tool calls                                                       │
│  • Streams events                                                            │
└──────────────┬──────────────────────────────────────────┬────────────────────┘
               │                                          │
               ▼                                          ▼
┌──────────────────────────────┐          ┌─────────────────────────────────────┐
│     LLM ROUTER (packages/llm) │          │     TOOL REGISTRY (packages/tools)  │
│  • Routes to provider         │          │  • Built-in: Bash, Read, Write...   │
│  • OpenAI / Anthropic / etc.  │          │  • MCP tools from external servers  │
│  • Streams responses          │          │  • Executes, returns results        │
└───────────────────────────────┘          └─────────────────────────────────────┘
                                                           │
                                                           ▼
                                           ┌─────────────────────────────────────┐
                                           │      MCP REGISTRY (packages/mcp)    │
                                           │  • Connects to MCP servers          │
                                           │  • Aggregates external tools        │
                                           └─────────────────────────────────────┘
```

---

## Package Dependencies

```
@pram1t/mustard-cli
    ├── @pram1t/mustard-core
    │       ├── @pram1t/mustard-llm
    │       ├── @pram1t/mustard-tools
    │       └── @pram1t/mustard-logger
    ├── @pram1t/mustard-llm
    ├── @pram1t/mustard-tools
    ├── @pram1t/mustard-mcp
    ├── @pram1t/mustard-config
    └── @pram1t/mustard-logger
```

---

## Build & Development

```bash
# Install dependencies
npm install

# Build all packages (uses Turborepo for caching)
npm run build

# Run tests
npm test

# Run tests with watch mode
npm run test:watch

# Run with coverage
npm run test:coverage

# Development mode (watch for changes)
npm run dev
```

---

## Adding New Packages

1. Create directory: `packages/my-package/`
2. Add `package.json` with name `@pram1t/mustard-my-package`
3. Add `tsconfig.json` extending root config
4. Add `src/index.ts` as entry point
5. Run `npm install` to link workspace

---

## Future Directories (Planned)

```
openagent/
├── mcp-servers/            # Custom MCP servers for specific integrations
│   ├── github/             # GitHub API tools
│   ├── database/           # Database query tools
│   └── browser/            # Browser automation tools
│
├── apps/
│   ├── desktop/            # Electron/Tauri desktop app
│   └── web/                # Web-based interface
│
└── packages/
    ├── workers/            # Multi-worker system (Phase A)
    ├── orchestration/      # Task queue, message bus
    └── ui/                 # Shared UI components
```

---

## Summary

| Directory | Purpose | Status |
|-----------|---------|--------|
| `apps/cli` | Command-line interface | ✅ Complete |
| `apps/desktop` | Desktop application | Planned |
| `packages/core` | Agent loop, context | ✅ Complete |
| `packages/llm` | LLM providers (5 adapters) | ✅ Complete |
| `packages/tools` | Built-in tools (6 tools) | ✅ Complete |
| `packages/mcp` | MCP client | ✅ Complete |
| `packages/config` | Configuration | ✅ Complete |
| `packages/logger` | Logging | ✅ Complete |
| `packages/hooks` | Event hooks | Placeholder |
| `packages/test-utils` | Test utilities | ✅ Complete |
| `mcp-servers/*` | Custom MCP servers | Planned |
| `docs/` | Documentation | In Progress |
