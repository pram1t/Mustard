# OpenAgent

An open-source, LLM-agnostic agentic coding assistant. Use any LLM provider -- OpenAI, Anthropic, Gemini, Ollama, or any OpenAI-compatible endpoint -- to get an AI coding agent that reads, writes, and edits your codebase, runs commands, searches the web, and orchestrates multi-step tasks.

Think of it as an open-source alternative to Claude Code that works with the model of your choice.

## Features

- **LLM-agnostic** -- Swap providers with a flag. Supports OpenAI, Anthropic, Google Gemini, Ollama, and any OpenAI-compatible API.
- **20+ built-in tools** -- File I/O (Read, Write, Edit, MultiEdit, Glob, Grep), shell execution (Bash, KillShell, ListShells), web access (WebFetch, WebSearch), task management (TodoWrite, TodoRead), notebooks (NotebookEdit), subagents (Task, TaskOutput, TaskStop), and more.
- **MCP client** -- Connect to any Model Context Protocol server over stdio or HTTP to extend the tool set.
- **Hook system** -- Register lifecycle hooks to run custom logic before/after tool calls, on errors, and at session boundaries.
- **Permission modes** -- Three built-in modes (permissive, default, strict) to control which tools require user approval.
- **Session persistence** -- Resume previous conversations where you left off.
- **Subagent system** -- Delegate work to specialized subagents (Explore, Plan, Bash, general-purpose).
- **Multi-worker orchestration** -- Break large tasks into parallel workstreams with 10 specialized worker roles.
- **Persistent memory** -- SQLite-backed memory with FTS5 full-text search for long-term context.
- **Desktop app** -- Electron-based desktop UI alongside the CLI.
- **Real-time collaboration** -- Multi-participant rooms with permissioned AI intents, live event bridge over WebSocket, and a Next.js workspace UI. See [docs/COLLAB-GETTING-STARTED.md](docs/COLLAB-GETTING-STARTED.md).

### Collab quick links

- [Getting started](docs/COLLAB-GETTING-STARTED.md) — server + CLI + web UI in 5 minutes
- [API reference](docs/COLLAB-API.md) — REST + WebSocket
- [Integration guide](docs/COLLAB-INTEGRATION.md) — package map, runtime topology, event flow

The Collab stack ships as `@openagent/collab-core`, `@openagent/collab-sync`, `@openagent/collab-presence`, `@openagent/collab-ai`, `@openagent/collab-permissions`, `@openagent/collab-memory`, and `@openagent/collab-server`. The CLI exposes `openagent collab ...` subcommands; the web app lives at `apps/web` (Next.js 15) with `/collab` and `/collab/[id]` routes.

## Quick Start

```bash
# Clone the repo
git clone https://github.com/pram1t/openagent.git
cd openagent

# Install dependencies
npm install

# Build all packages
npm run build

# Set at least one API key
export OPENAI_API_KEY="sk-..."
# or
export ANTHROPIC_API_KEY="sk-ant-..."
# or
export GOOGLE_API_KEY="..."

# Run the CLI
npx openagent "Hello, who are you?"
```

## Installation

**Prerequisites:** Node.js >= 20, npm >= 10.

```bash
npm install
npm run build
```

To install the CLI globally from the monorepo:

```bash
npm link --workspace=apps/cli
```

Then use `openagent` directly from your terminal.

## Usage

### Basic conversation

```bash
openagent "Explain what this project does"
```

### Choose a provider and model

```bash
openagent --provider anthropic "Refactor this function"
openagent --provider ollama --model llama3.2 "Write unit tests for utils.ts"
openagent --provider openai --model gpt-4o "Summarize the changes"
```

### Multi-worker orchestration

```bash
openagent --orchestrate "Build a REST API with auth, tests, and docs"
```

### Project configuration

```bash
# Initialize a .openagent/ config folder in the current project
openagent init

# Manage configuration
openagent config list
openagent config set provider anthropic
openagent config set model claude-sonnet-4-20250514
```

### Plans

```bash
openagent plans list
```

### MCP servers

```bash
# Add an MCP server
openagent mcp add filesystem \
  --type stdio \
  --command "npx @modelcontextprotocol/server-filesystem"

# List configured servers
openagent mcp list
```

## Architecture

OpenAgent is structured as a monorepo managed by [Turborepo](https://turbo.build/repo):

```
openagent/
├── apps/
│   ├── cli/              # Command-line interface
│   └── desktop/          # Electron desktop app
├── packages/
│   ├── core/             # Agent loop, permissions, sessions
│   ├── llm/              # LLM provider abstraction layer
│   ├── tools/            # 20+ built-in tools
│   ├── config/           # Configuration management
│   ├── logger/           # Structured logging (Pino)
│   ├── hooks/            # Lifecycle hook system
│   ├── mcp/              # Model Context Protocol client
│   ├── worker/           # Specialized AI workers (10 roles)
│   ├── orchestrator/     # Multi-worker coordination
│   ├── memory/           # Persistent memory (SQLite + FTS5)
│   ├── artifact/         # Versioned artifacts & handoffs
│   ├── queue/            # Priority task queue
│   ├── message-bus/      # Event bus with pattern matching
│   └── test-utils/       # Shared testing utilities
└── mcp-servers/          # MCP server implementations
```

### Key design principles

1. **LLM-agnostic core** -- The `@openagent/llm` package provides a unified interface. Adding a new provider means implementing a single adapter.
2. **Modular packages** -- Each concern (tools, config, hooks, MCP, memory) lives in its own package with a clear API boundary.
3. **CLI-first** -- Features land in the CLI first; the desktop app is a thin presentation layer over the same core.
4. **Extensible via MCP** -- Any MCP-compatible server can add new tools without touching the core codebase.

## Environment Variables

| Variable | Provider |
|---|---|
| `OPENAI_API_KEY` | OpenAI / OpenAI-compatible |
| `ANTHROPIC_API_KEY` | Anthropic |
| `GOOGLE_API_KEY` | Google Gemini |

For Ollama, no API key is needed -- just ensure the Ollama server is running locally.

## Development

```bash
# Install dependencies
npm install

# Build all packages
npm run build

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Dev mode (watch + rebuild)
npm run dev

# Lint
npm run lint
```

### Adding a new package

1. Create a directory under `packages/` with a `package.json` scoped to `@openagent/`.
2. Add it to the root `workspaces` list if needed.
3. Run `npm install` from the repo root.
4. Import from other packages using the `@openagent/<name>` specifier.

## Contributing

Contributions are welcome. Please:

1. Fork the repo and create a feature branch.
2. Write tests for new functionality.
3. Ensure `npm test` and `npm run build` pass.
4. Open a pull request with a clear description of the change.

## License

[MIT](./LICENSE)
