# Mustard

> *Cuts the mustard.*
>
> An open collaborative IDE for human + AI development.

Mustard is a collaborative coding environment where humans and AI agents share a room, propose intents, and ship code together — with a permission gateway between every intent and its execution. It's also a self-contained, **LLM-agnostic** agentic coding assistant that works with any provider — OpenAI, Anthropic, Gemini, Ollama, or any OpenAI-compatible endpoint.

Think of it as an open alternative to Claude Code that **works with the model of your choice** and lets multiple humans and AI agents pair-program in real time.

## Features

- **LLM-agnostic** — Swap providers with a flag. Supports OpenAI, Anthropic, Google Gemini, Ollama, and any OpenAI-compatible API.
- **Real-time collaboration** — Multi-participant rooms with permissioned AI intents, live event bridge over WebSocket, and a Next.js workspace UI. See [docs/MUSTARD-GETTING-STARTED.md](docs/MUSTARD-GETTING-STARTED.md).
- **Permission gateway** — Every AI action flows through the gateway → mode policy → manual or auto approval. Sensitive-file detection always overrides mode.
- **20+ built-in tools** — File I/O (Read, Write, Edit, MultiEdit, Glob, Grep), shell execution (Bash, KillShell, ListShells), web access (WebFetch, WebSearch), task management (TodoWrite, TodoRead), notebooks (NotebookEdit), subagents (Task, TaskOutput, TaskStop), and more.
- **MCP client** — Connect to any Model Context Protocol server over stdio or HTTP to extend the tool set.
- **Hook system** — Register lifecycle hooks to run custom logic before/after tool calls, on errors, and at session boundaries.
- **Permission modes** — plan / code / ask / auto, with countdown auto-approval and sensitive-file gating.
- **Session persistence** — Resume previous conversations where you left off.
- **Subagent system** — Delegate work to specialized subagents (Explore, Plan, Bash, general-purpose).
- **Multi-worker orchestration** — Break large tasks into parallel workstreams with 10 specialized worker roles.
- **Persistent memory** — SQLite-backed memory with FTS5 full-text search for long-term context.
- **Yjs document sync** — Live shared text via `setupWSConnection`, with SQLite checkpoint persistence.
- **JWT auth + refresh tokens** — HS256 with `jti`, `/auth/refresh` endpoint.
- **Desktop app** — Electron-based desktop UI alongside the CLI.

### Collab quick links

- [Getting started](docs/MUSTARD-GETTING-STARTED.md) — server + CLI + web UI in 5 minutes
- [API reference](docs/MUSTARD-API.md) — REST + WebSocket
- [Integration guide](docs/MUSTARD-INTEGRATION.md) — package map, runtime topology, event flow

The Collab stack ships as `@mustard/collab-core`, `@mustard/collab-sync`, `@mustard/collab-presence`, `@mustard/collab-ai`, `@mustard/collab-permissions`, `@mustard/collab-memory`, and `@mustard/collab-server`. The CLI exposes `mustard collab ...` subcommands; the web app lives at `apps/web` (Next.js 15) with `/collab` and `/collab/[id]` routes.

## Quick Start

```bash
# Clone the repo
git clone https://github.com/pram1t/mustard.git
cd mustard

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
npx mustard "Hello, who are you?"
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

Then use `mustard` directly from your terminal.

> **Coming soon:** `npm i -g @mustard/cli` for one-line install once polish-v1 ships.

## Usage

### Basic conversation

```bash
mustard "Explain what this project does"
```

### Choose a provider and model

```bash
mustard --provider anthropic "Refactor this function"
mustard --provider ollama --model llama3.2 "Write unit tests for utils.ts"
mustard --provider openai --model gpt-4o "Summarize the changes"
```

### Multi-worker orchestration

```bash
mustard --orchestrate "Build a REST API with auth, tests, and docs"
```

### Project configuration

```bash
# Initialize a .mustard/ config folder in the current project
mustard init

# Manage configuration
mustard config list
mustard config set provider anthropic
mustard config set model claude-sonnet-4-20250514
```

### Collaboration

```bash
# Start the collab server
node -e "import('./packages/collab-server/dist/index.js').then(async m => { const { app } = await m.createApp({ config: { jwtSecret: 'dev-secret' } }); await app.listen({ host: '127.0.0.1', port: 3200 }); })"

# Cache a JWT and create a room
mustard collab login --as alice
mustard collab room create "Demo Room"
mustard collab tail <room-id>
```

### Plans

```bash
mustard plans list
```

### MCP servers

```bash
# Add an MCP server
mustard mcp add filesystem \
  --type stdio \
  --command "npx @modelcontextprotocol/server-filesystem"

# List configured servers
mustard mcp list
```

## Architecture

Mustard is structured as a monorepo managed by [Turborepo](https://turbo.build/repo):

```
mustard/
├── apps/
│   ├── cli/              # Command-line interface
│   ├── desktop/          # Electron desktop app
│   └── web/              # Next.js workspace UI (/collab, /collab/[id])
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
│   ├── server/           # HTTP server
│   ├── collab-core/      # Collab rooms, participants, types
│   ├── collab-sync/      # Yjs CRDT + WebSocket provider
│   ├── collab-presence/  # Cursors, awareness, follow
│   ├── collab-ai/        # IntentEngine, ZoneManager, AgentRegistry
│   ├── collab-permissions/ # ModeManager, ApprovalManager, Gateway
│   ├── collab-memory/    # Ephemeral / Session / Project / Team
│   ├── collab-server/    # Fastify + WS server, JWT, Yjs sync
│   └── test-utils/       # Shared testing utilities
└── mcp-servers/          # MCP server implementations
```

### Key design principles

1. **LLM-agnostic core** — The `@mustard/llm` package provides a unified interface. Adding a new provider means implementing a single adapter.
2. **Modular packages** — Each concern (tools, config, hooks, MCP, memory, collab) lives in its own package with a clear API boundary.
3. **Permissioned by default** — Every AI action flows through the permission gateway. Sensitive files always require manual approval.
4. **CLI-first** — Features land in the CLI first; the desktop and web apps are presentation layers over the same core.
5. **Extensible via MCP** — Any MCP-compatible server can add new tools without touching the core codebase.

## Environment Variables

| Variable | Provider |
|---|---|
| `OPENAI_API_KEY` | OpenAI / OpenAI-compatible |
| `ANTHROPIC_API_KEY` | Anthropic |
| `GOOGLE_API_KEY` | Google Gemini |

For Ollama, no API key is needed — just ensure the Ollama server is running locally.

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

1. Create a directory under `packages/` with a `package.json` scoped to `@mustard/`.
2. Add it to the root `workspaces` list if needed.
3. Run `npm install` from the repo root.
4. Import from other packages using the `@mustard/<name>` specifier.

## Contributing

Contributions are welcome. Please:

1. Fork the repo and create a feature branch.
2. Write tests for new functionality.
3. Ensure `npm test` and `npm run build` pass.
4. Open a pull request with a clear description of the change.

## License

[MIT](./LICENSE)
