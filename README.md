# OpenAgent

**An open-source, LLM-agnostic agentic coding assistant**

OpenAgent is a full-featured alternative to Claude Code and Claude Desktop that allows you to use **any LLM provider** (OpenAI, Claude, Gemini, local LLMs) and connect to **any external service** via the Model Context Protocol (MCP).

## Vision

- **LLM Freedom**: Use OpenAI GPT-4o, Claude Opus, Gemini, Ollama, or any OpenAI-compatible API
- **Universal Integrations**: Connect to databases, Slack, GitHub, Gmail, CRMs, ERPs via MCP
- **Desktop + CLI**: Electron desktop app for configuration + powerful CLI agent for coding
- **Open Source**: Full transparency, community-driven, no vendor lock-in

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    OPENAGENT PLATFORM                        │
├─────────────────────────────────────────────────────────────┤
│  Desktop App (Electron)  ──▶  CLI Agent (TypeScript + Bun)  │
│  - Chat UI                    - Agent Loop                   │
│  - Settings                   - Tool System                  │
│  - MCP Manager                - LLM Abstraction              │
│  - Provider Config            - Context Management           │
├─────────────────────────────────────────────────────────────┤
│                    MCP Server Ecosystem                      │
│  [Database] [GitHub] [Slack] [Gmail] [Custom APIs]          │
├─────────────────────────────────────────────────────────────┤
│                      LLM Providers                           │
│  [OpenAI] [Claude] [Gemini] [Ollama] [Any OpenAI-compat]    │
└─────────────────────────────────────────────────────────────┘
```

## Quick Start

### Installation

```bash
# Install CLI globally
npm install -g openagent

# Or run desktop app
# Download from releases page
```

### Basic Usage

```bash
# Start interactive session
openagent

# One-shot query
openagent "What files are in this directory?"

# With specific provider
openagent --provider openai "Explain this codebase"

# Resume previous session
openagent --resume <session-id>
```

### Configure LLM Provider

```bash
# Set up provider via CLI
openagent config set provider openai
openagent config set openai.apiKey sk-...
openagent config set openai.model gpt-4o

# Or edit config file directly
# ~/.openagent/config.json
```

### Add MCP Integrations

```bash
# Add database connection
openagent mcp add database --type mysql --connection "mysql://user:pass@localhost/db"

# Add GitHub integration
openagent mcp add github --token ghp_...

# List active integrations
openagent mcp list
```

## Documentation

| Document | Description |
|----------|-------------|
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | Complete system architecture and data flow |
| [LLM-ABSTRACTION.md](docs/LLM-ABSTRACTION.md) | LLM provider interface and adapters |
| [TOOL-SYSTEM.md](docs/TOOL-SYSTEM.md) | Built-in tools and custom tool creation |
| [MCP-CLIENT.md](docs/MCP-CLIENT.md) | MCP protocol implementation guide |
| [AGENT-LOOP.md](docs/AGENT-LOOP.md) | Core agent loop and orchestration |
| [CONTEXT-MANAGEMENT.md](docs/CONTEXT-MANAGEMENT.md) | Token counting and context compaction |
| [HOOK-SYSTEM.md](docs/HOOK-SYSTEM.md) | Hook events and extensibility |
| [PERMISSION-SYSTEM.md](docs/PERMISSION-SYSTEM.md) | Permission rules and security |
| [SUBAGENT-SYSTEM.md](docs/SUBAGENT-SYSTEM.md) | Subagent spawning and types |
| [DESKTOP-APP.md](docs/DESKTOP-APP.md) | Electron desktop application |
| [CLI-INTERFACE.md](docs/CLI-INTERFACE.md) | CLI commands and options |
| [CONFIGURATION.md](docs/CONFIGURATION.md) | Configuration files and environment |
| [IMPLEMENTATION-PHASES.md](docs/IMPLEMENTATION-PHASES.md) | Step-by-step build guide |

## Technical Specifications

- [specs/llm-provider-interface.ts](specs/llm-provider-interface.ts) - LLM provider TypeScript interface
- [specs/tool-interface.ts](specs/tool-interface.ts) - Tool system type definitions
- [specs/mcp-types.ts](specs/mcp-types.ts) - MCP protocol types
- [specs/agent-types.ts](specs/agent-types.ts) - Agent and context types
- [specs/config-schema.json](specs/config-schema.json) - Configuration JSON schema

## Templates

- [templates/llm-adapter-template.ts](templates/llm-adapter-template.ts) - Template for new LLM adapters
- [templates/tool-template.ts](templates/tool-template.ts) - Template for custom tools
- [templates/mcp-server-template.ts](templates/mcp-server-template.ts) - Template for MCP servers

## Project Structure

```
openagent/
├── apps/
│   ├── desktop/          # Electron desktop app
│   └── cli/              # CLI entry point
├── packages/
│   ├── core/             # Core agent runtime
│   ├── llm/              # LLM abstraction layer
│   ├── tools/            # Tool system
│   ├── mcp/              # MCP client
│   ├── hooks/            # Hook system
│   └── ui/               # Shared UI components
├── mcp-servers/          # Built-in MCP servers
│   └── database/         # MySQL/PostgreSQL server
├── docs/                 # Documentation
├── specs/                # TypeScript specifications
└── templates/            # Code templates
```

## Supported LLM Providers

| Provider | Status | Features |
|----------|--------|----------|
| OpenAI | Full | GPT-4o, GPT-4, GPT-3.5, tool use, streaming |
| Anthropic | Full | Claude Opus, Sonnet, Haiku, tool use, streaming |
| Google | Full | Gemini Pro, Gemini Flash, tool use |
| Ollama | Full | Any local model, tool use varies by model |
| OpenAI-Compatible | Full | Any API with OpenAI format |

## Built-in Tools

| Tool | Description |
|------|-------------|
| `Read` | Read file contents with line numbers |
| `Write` | Create or overwrite files |
| `Edit` | Surgical string replacement in files |
| `Glob` | Fast file pattern matching |
| `Grep` | Regex content search across files |
| `Bash` | Execute shell commands |
| `WebFetch` | HTTP requests to URLs |
| `WebSearch` | Web search integration |
| `AskUser` | Interactive user prompts |
| `TodoWrite` | Task tracking and management |
| `Task` | Spawn subagents for parallel work |

## MCP Integrations

OpenAgent supports the Model Context Protocol for external integrations:

- **Databases**: MySQL, PostgreSQL, SQLite, MongoDB
- **Version Control**: GitHub, GitLab, Bitbucket
- **Communication**: Slack, Discord, Email
- **Productivity**: Google Drive, Notion, Jira
- **Custom APIs**: Any REST/GraphQL service via MCP

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and guidelines.

## License

MIT License - See [LICENSE](LICENSE) for details.

## Acknowledgments

Inspired by:
- [Claude Code](https://claude.ai/code) - Anthropic's coding agent
- [OpenHands](https://github.com/OpenHands/OpenHands) - Open-source AI agent
- [Aider](https://aider.chat/) - AI pair programming
- [Continue](https://continue.dev/) - IDE AI assistant
- [Model Context Protocol](https://modelcontextprotocol.io/) - Anthropic's integration standard
