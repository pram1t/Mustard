# Implementation Phases

This document provides a step-by-step guide to building OpenAgent from scratch.

## Prerequisites

Before starting:
- Node.js 18+ or Bun 1.0+
- Git
- A code editor
- API keys for at least one LLM provider

## Phase 1: Project Foundation

**Goal**: Set up monorepo structure and basic tooling.

### Step 1.1: Initialize Monorepo

```bash
# Create project directory
mkdir openagent && cd openagent

# Initialize with bun
bun init

# Install Turborepo
bun add -D turbo

# Create workspace structure
mkdir -p apps/cli apps/desktop packages/{core,llm,tools,mcp,hooks,ui}
mkdir -p mcp-servers/database
mkdir -p docs specs templates
```

### Step 1.2: Configure Workspaces

```json
// package.json
{
  "name": "openagent",
  "private": true,
  "workspaces": [
    "apps/*",
    "packages/*",
    "mcp-servers/*"
  ],
  "scripts": {
    "build": "turbo build",
    "dev": "turbo dev",
    "test": "turbo test",
    "lint": "turbo lint"
  },
  "devDependencies": {
    "turbo": "^2.0.0",
    "typescript": "^5.0.0",
    "@types/node": "^20.0.0"
  }
}
```

```json
// turbo.json
{
  "$schema": "https://turbo.build/schema.json",
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "test": {
      "dependsOn": ["build"]
    }
  }
}
```

### Step 1.3: Create Base Package Configs

```json
// packages/llm/package.json
{
  "name": "@openagent/llm",
  "version": "0.0.1",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch"
  },
  "dependencies": {
    "openai": "^4.0.0"
  }
}
```

### Verification

```bash
# Should run without errors
bun install
bun run build
```

---

## Phase 2: LLM Abstraction Layer

**Goal**: Create provider-agnostic LLM interface with OpenAI adapter.

### Step 2.1: Define Core Types

Create `packages/llm/src/types.ts` with:
- Message types
- Tool definition types
- Stream chunk types
- Provider interface

See [specs/llm-provider-interface.ts](../specs/llm-provider-interface.ts)

### Step 2.2: Implement OpenAI Adapter

Create `packages/llm/src/adapters/openai.ts`:
- Implement LLMProvider interface
- Handle chat completions
- Parse tool calls
- Stream responses

### Step 2.3: Create Provider Router

Create `packages/llm/src/router.ts`:
- Provider registration
- Fallback logic
- Retry with backoff

### Verification

```typescript
// Test script
import { OpenAIProvider } from '@openagent/llm';

const provider = new OpenAIProvider({ apiKey: process.env.OPENAI_API_KEY });

for await (const chunk of provider.chat({
  messages: [{ role: 'user', content: 'Hello!' }]
})) {
  console.log(chunk);
}
```

---

## Phase 3: Core Tool System

**Goal**: Implement built-in tools.

### Step 3.1: Define Tool Interface

Create `packages/tools/src/interface.ts`:
- Tool definition type
- ToolResult type
- ExecutionContext type

See [specs/tool-interface.ts](../specs/tool-interface.ts)

### Step 3.2: Implement Basic Tools

In order:
1. `Read` - File reading
2. `Write` - File creation
3. `Edit` - String replacement
4. `Bash` - Shell execution
5. `Glob` - File pattern matching
6. `Grep` - Content search

### Step 3.3: Create Tool Registry

Create `packages/tools/src/registry.ts`:
- Tool registration
- Tool lookup
- Execution orchestration

### Verification

```typescript
import { createDefaultRegistry } from '@openagent/tools';

const registry = createDefaultRegistry();
const result = await registry.execute('Read', {
  file_path: '/path/to/file.txt'
}, context);

console.log(result);
```

---

## Phase 4: Agent Loop

**Goal**: Create the core agent orchestration.

### Step 4.1: Context Manager

Create `packages/core/src/context/manager.ts`:
- Message storage
- Token counting
- Compaction logic

### Step 4.2: Main Agent Loop

Create `packages/core/src/agent/loop.ts`:
- Message handling
- Tool call parsing
- Tool execution
- Result integration

### Step 4.3: Basic CLI

Create `apps/cli/src/index.ts`:
- Argument parsing
- Agent initialization
- Input/output handling

### Verification

```bash
# Build and link CLI
cd apps/cli && bun link

# Test basic interaction
openagent "What files are in the current directory?"
```

---

## Phase 5: Additional LLM Providers

**Goal**: Add Anthropic, Gemini, and Ollama support.

### Step 5.1: Anthropic Adapter

Create `packages/llm/src/adapters/anthropic.ts`

### Step 5.2: Gemini Adapter

Create `packages/llm/src/adapters/gemini.ts`

### Step 5.3: Ollama Adapter

Create `packages/llm/src/adapters/ollama.ts`

### Step 5.4: OpenAI-Compatible Adapter

Create `packages/llm/src/adapters/openai-compatible.ts`

### Verification

```bash
# Test each provider
openagent --provider anthropic "Hello"
openagent --provider gemini "Hello"
openagent --provider ollama "Hello"
```

---

## Phase 6: MCP Client

**Goal**: Implement Model Context Protocol client.

### Step 6.1: MCP Types

Create `packages/mcp/src/types.ts`

See [specs/mcp-types.ts](../specs/mcp-types.ts)

### Step 6.2: Transport Layer

Create:
- `packages/mcp/src/transport/stdio.ts`
- `packages/mcp/src/transport/http.ts`

### Step 6.3: MCP Client

Create `packages/mcp/src/client.ts`:
- Connection management
- Tool listing
- Tool execution

### Step 6.4: MCP Registry

Create `packages/mcp/src/registry.ts`:
- Server management
- Tool aggregation

### Verification

```bash
# Add and test MCP server
openagent mcp add test-server --type stdio --command "npx @test/mcp-server"
openagent mcp tools test-server
```

---

## Phase 7: Hook System

**Goal**: Implement lifecycle hooks.

### Step 7.1: Hook Types

Create `packages/hooks/src/system.ts`

### Step 7.2: Hook Executor

Create `packages/hooks/src/executor.ts`:
- Event matching
- Script execution
- Result handling

### Step 7.3: Integration

Integrate hooks into agent loop

### Verification

```bash
# Create test hook
echo 'console.log(JSON.stringify({ blocked: false }))' > ~/.openagent/hooks/test.js

# Configure hook
openagent config set hooks.session_start '[{"command": "node ~/.openagent/hooks/test.js"}]'

# Verify hook runs
openagent "test"
```

---

## Phase 8: Permission System

**Goal**: Implement tool permission controls.

### Step 8.1: Permission Types

Create `packages/core/src/permissions/types.ts`

### Step 8.2: Permission Manager

Create `packages/core/src/permissions/manager.ts`:
- Rule matching
- Approval workflow

### Step 8.3: CLI Integration

Add permission flags to CLI

### Verification

```bash
# Test permission modes
openagent --mode strict "Write to test.txt"
openagent --allow Write "Write to test.txt"
```

---

## Phase 9: Session Management

**Goal**: Implement session persistence and resume.

### Step 9.1: Session Storage

Create `packages/core/src/context/session.ts`:
- Save/load sessions
- Session listing

### Step 9.2: CLI Commands

Add session subcommands:
- `openagent session list`
- `openagent session show <id>`
- `openagent --resume <id>`

### Verification

```bash
# Create and resume session
openagent "Start a task"
# Note the session ID

openagent --resume <id> "Continue the task"
```

---

## Phase 10: Subagent System

**Goal**: Implement subagent spawning.

### Step 10.1: Subagent Manager

Create `packages/core/src/agent/subagent.ts`

### Step 10.2: Task Tool

Implement full Task tool in `packages/tools/src/builtin/task.ts`

### Verification

```typescript
// Test subagent spawning
openagent "Explore the codebase and find all API endpoints"
// Should spawn Explore subagents
```

---

## Phase 11: Desktop Application

**Goal**: Create Electron desktop app.

### Step 11.1: Electron Setup

```bash
cd apps/desktop
bun add electron electron-builder
bun add -D @electron/rebuild
```

### Step 11.2: Main Process

Create:
- `apps/desktop/src/main/index.ts`
- `apps/desktop/src/main/window.ts`
- `apps/desktop/src/main/ipc.ts`

### Step 11.3: Renderer (React)

Create React app in `apps/desktop/src/renderer/`

### Step 11.4: Build Configuration

Configure `electron-builder.json`

### Verification

```bash
cd apps/desktop
bun run dev
# Desktop app should open
```

---

## Phase 12: Polish & Distribution

**Goal**: Production-ready release.

### Step 12.1: Documentation

- Write README
- Add examples
- Create getting started guide

### Step 12.2: Testing

- Add unit tests
- Add integration tests
- Add E2E tests for CLI

### Step 12.3: Build & Publish

```bash
# Build CLI
cd apps/cli
bun run build
npm publish

# Build desktop
cd apps/desktop
bun run build:mac
bun run build:win
bun run build:linux
```

### Verification

- Install from npm
- Download installers
- Test fresh installation

---

## Development Tips

### Quick Iteration

```bash
# Watch mode for all packages
bun run dev

# Test changes immediately
openagent "test prompt"
```

### Debugging

```bash
# Enable debug logging
OPENAGENT_LOG_LEVEL=debug openagent "test"

# Inspect LLM requests
OPENAGENT_LOG_LEVEL=debug openagent --provider openai "test" 2>&1 | grep -i request
```

### Testing Providers

```bash
# Test each provider in isolation
openagent --provider openai "2+2"
openagent --provider anthropic "2+2"
openagent --provider ollama "2+2"
```

---

## Milestone Checklist

- [ ] Phase 1: Project structure set up
- [ ] Phase 2: Can chat with OpenAI
- [ ] Phase 3: Can read/write files
- [ ] Phase 4: Full agent loop working
- [ ] Phase 5: All providers working
- [ ] Phase 6: MCP servers connectable
- [ ] Phase 7: Hooks executing
- [ ] Phase 8: Permissions enforced
- [ ] Phase 9: Sessions persist
- [ ] Phase 10: Subagents spawn
- [ ] Phase 11: Desktop app runs
- [ ] Phase 12: Published and documented

---

## Next Steps After v1.0

- [ ] Multi-agent orchestration (Cowork-style)
- [ ] More MCP servers (Slack, Gmail, etc.)
- [ ] IDE extensions (VS Code, JetBrains)
- [ ] Cloud deployment option
- [ ] Plugin marketplace
