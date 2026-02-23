# Getting Started with OpenAgent

OpenAgent is an LLM-agnostic agentic coding assistant. This guide walks you through installation, configuration, and your first interaction.

## Prerequisites

- **Node.js** 20 or later
- **npm** 10 or later

Verify your environment:

```bash
node --version   # v20.x or higher
npm --version    # 10.x or higher
```

## Installation

```bash
# Clone the repository
git clone https://github.com/openagent/openagent.git
cd openagent

# Install dependencies (npm workspaces)
npm install

# Build all packages and apps
npm run build
```

## Configuration

OpenAgent requires at least one LLM provider API key. Set the appropriate environment variable for your provider:

```bash
# OpenAI
export OPENAI_API_KEY="sk-..."

# Anthropic
export ANTHROPIC_API_KEY="sk-ant-..."

# Google Gemini
export GOOGLE_API_KEY="AI..."
```

You can set these in your shell profile (`~/.bashrc`, `~/.zshrc`, etc.) or in a `.env` file in the project root.

## First Chat

Run a quick test to confirm everything works:

```bash
# During development (uses tsx for TypeScript execution)
npx tsx apps/cli/src/index.ts "Hello"

# After building
node apps/cli/dist/index.js "Hello"
```

You should see the assistant respond to your greeting.

## Choosing a Provider

Use the `--provider` flag to select which LLM backend to use:

```bash
# OpenAI (default)
openagent --provider openai "Explain async/await"

# Anthropic
openagent --provider anthropic "Explain async/await"

# Google Gemini
openagent --provider gemini "Explain async/await"

# Ollama (local models)
openagent --provider ollama "Explain async/await"

# OpenAI-compatible endpoint
openagent --provider openai-compatible --base-url http://localhost:8080/v1 "Explain async/await"
```

You can also specify a model directly:

```bash
openagent --provider anthropic --model claude-sonnet-4-20250514 "Write a function to sort an array"
```

## Project Configuration

Initialize a project-level configuration:

```bash
openagent init
```

This creates a `.openagent/` folder in your project root containing configuration files. OpenAgent resolves configuration using the following hierarchy (highest priority first):

1. **CLI flags** -- command-line arguments
2. **Environment variables** -- `OPENAI_API_KEY`, `OPENAGENT_MODEL`, etc.
3. **Project config** -- `.openagent/config.json` in the current project
4. **Global config** -- `~/.openagent/config.json`
5. **Default values** -- built-in defaults

## Adding MCP Servers

OpenAgent supports the Model Context Protocol (MCP) for extending agent capabilities with external tool servers.

```bash
# Add an MCP server by name and command
openagent mcp add my-server --command "npx -y @my-org/mcp-server"

# Add with environment variables
openagent mcp add db-server --command "npx -y @my-org/db-mcp" --env DB_HOST=localhost --env DB_PORT=5432

# Add with arguments
openagent mcp add file-server --command "node" --args "./server.js" "--port" "3001"

# List configured MCP servers
openagent mcp list

# Remove an MCP server
openagent mcp remove my-server
```

## Permission Modes

OpenAgent supports three permission modes that control how tools are authorized:

### Permissive Mode

All tool calls are automatically approved. Suitable for trusted environments.

```bash
openagent --permissions permissive "Refactor this file"
```

### Default Mode

Destructive operations (file writes, shell commands) require user approval. Read operations are auto-approved.

```bash
openagent "Refactor this file"
```

### Strict Mode

Every tool call requires explicit user approval.

```bash
openagent --permissions strict "Refactor this file"
```

## Sessions

OpenAgent automatically saves conversation sessions so you can resume later.

```bash
# Resume the most recent session
openagent --resume

# List all saved sessions
openagent session list

# Show details of a specific session
openagent session show <session-id>

# Delete a session
openagent session delete <session-id>
```

Sessions preserve the full conversation history, tool call results, and context.

## Multi-Worker Mode

For complex tasks, OpenAgent can orchestrate multiple worker agents in parallel using the `--orchestrate` flag:

```bash
openagent --orchestrate "Refactor the authentication module, add tests, and update the docs"
```

In orchestration mode, a coordinator agent breaks down the task and delegates subtasks to up to 10 specialized worker roles. Each worker operates independently with its own context and tool access, and results are aggregated by the coordinator.

This is particularly effective for:

- Large refactoring tasks spanning multiple files
- Tasks that combine code changes with test writing and documentation
- Parallel investigation of multiple approaches

---

For more details, see the [API documentation](./api/README.md) and the [Contributing guide](../CONTRIBUTING.md).
