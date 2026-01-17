# Architecture

This document provides a comprehensive overview of the OpenAgent system architecture.

## System Overview

OpenAgent follows a **layered architecture** with clear separation of concerns:

```
┌─────────────────────────────────────────────────────────────────────┐
│                         PRESENTATION LAYER                          │
│  ┌─────────────────────────┐    ┌─────────────────────────────────┐ │
│  │    Desktop App          │    │         CLI Interface           │ │
│  │    (Electron)           │    │      (Terminal + Ink)           │ │
│  │                         │    │                                 │ │
│  │  - React UI             │    │  - Streaming output             │ │
│  │  - IPC Bridge           │────│  - Interactive prompts          │ │
│  │  - System Tray          │    │  - Progress indicators          │ │
│  │  - Auto-updates         │    │  - Color/formatting             │ │
│  └─────────────────────────┘    └─────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────────┤
│                        ORCHESTRATION LAYER                          │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │                      Agent Loop                                 ││
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ ││
│  │  │ Main Agent  │  │  Subagent   │  │   Multi-Agent           │ ││
│  │  │    Loop     │──│   Manager   │──│   Orchestrator          │ ││
│  │  └─────────────┘  └─────────────┘  └─────────────────────────┘ ││
│  └─────────────────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────────────┤
│                          TOOL LAYER                                 │
│  ┌──────────────────────────┐  ┌──────────────────────────────────┐│
│  │     Built-in Tools       │  │         MCP Client               ││
│  │  ┌─────┐ ┌─────┐ ┌─────┐ │  │  ┌────────────────────────────┐ ││
│  │  │Read │ │Write│ │Edit │ │  │  │   MCP Registry             │ ││
│  │  └─────┘ └─────┘ └─────┘ │  │  │   - Server connections     │ ││
│  │  ┌─────┐ ┌─────┐ ┌─────┐ │  │  │   - Tool aggregation       │ ││
│  │  │Glob │ │Grep │ │Bash │ │  │  │   - Resource management    │ ││
│  │  └─────┘ └─────┘ └─────┘ │  │  └────────────────────────────┘ ││
│  │  ┌─────┐ ┌─────┐ ┌─────┐ │  │  ┌────────────────────────────┐ ││
│  │  │Web* │ │Ask  │ │Task │ │  │  │   Transport Layer          │ ││
│  │  └─────┘ └─────┘ └─────┘ │  │  │   - STDIO / HTTP+SSE       │ ││
│  └──────────────────────────┘  │  └────────────────────────────┘ ││
│                                └──────────────────────────────────┘│
├─────────────────────────────────────────────────────────────────────┤
│                       LLM ABSTRACTION LAYER                         │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │                      LLM Router                                 ││
│  │  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌──────────────┐ ││
│  │  │  OpenAI    │ │ Anthropic  │ │   Gemini   │ │   Ollama     │ ││
│  │  │  Adapter   │ │  Adapter   │ │  Adapter   │ │   Adapter    │ ││
│  │  └────────────┘ └────────────┘ └────────────┘ └──────────────┘ ││
│  │  ┌────────────────────────────────────────────────────────────┐ ││
│  │  │              OpenAI-Compatible Adapter (fallback)          │ ││
│  │  └────────────────────────────────────────────────────────────┘ ││
│  └─────────────────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────────────┤
│                          CORE LAYER                                 │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌───────────────┐ │
│  │   Context   │ │   Session   │ │ Permission  │ │    Hook       │ │
│  │   Manager   │ │   Manager   │ │   Manager   │ │   Executor    │ │
│  └─────────────┘ └─────────────┘ └─────────────┘ └───────────────┘ │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────────────────┐│
│  │   Config    │ │   State     │ │      Event Bus                 ││
│  │   Loader    │ │   Store     │ │  (Inter-component messaging)   ││
│  └─────────────┘ └─────────────┘ └─────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────┘
```

## Layer Responsibilities

### 1. Presentation Layer

**Desktop App (Electron)**
- Cross-platform GUI application
- Chat interface for conversational interaction
- Settings UI for provider configuration
- MCP server management interface
- IPC communication with CLI agent process

**CLI Interface**
- Terminal-based interaction using React Ink
- Real-time streaming output
- Interactive prompts and confirmations
- Progress indicators for long operations
- Markdown rendering support

### 2. Orchestration Layer

**Agent Loop**
- Core execution loop: gather context → call LLM → execute tools → repeat
- Handles streaming responses from LLM
- Manages tool call parsing and execution
- Detects completion conditions

**Subagent Manager**
- Spawns isolated agents for complex subtasks
- Manages separate context windows per subagent
- Aggregates results back to parent agent
- Handles parallel subagent execution

**Multi-Agent Orchestrator**
- Coordinates multiple specialized agents
- Implements handoff patterns between agents
- Manages shared state across agents
- Supports supervisor/worker architectures

### 3. Tool Layer

**Built-in Tools**
- File operations: Read, Write, Edit
- Search operations: Glob, Grep
- Shell execution: Bash
- Web operations: WebFetch, WebSearch
- Interaction: AskUser, TodoWrite
- Delegation: Task (subagent spawning)

**MCP Client**
- Full MCP protocol implementation
- JSON-RPC 2.0 communication
- Multiple transport support (STDIO, HTTP+SSE)
- Server registry for managing connections
- Tool and resource aggregation

### 4. LLM Abstraction Layer

**LLM Router**
- Provider selection and fallback logic
- Load balancing across providers
- Automatic retry with backoff
- Provider capability detection

**Provider Adapters**
- Uniform interface for all providers
- Provider-specific API handling
- Tool format conversion
- Token counting per provider
- Streaming normalization

### 5. Core Layer

**Context Manager**
- Message history management
- Token counting and budget tracking
- Automatic context compaction
- Summarization of older messages

**Session Manager**
- Session persistence to disk
- Session resume functionality
- Session forking for exploration
- Session history tracking

**Permission Manager**
- Tool permission evaluation
- Allow/deny/ask rule processing
- User approval workflows
- Security boundary enforcement

**Hook Executor**
- Lifecycle event triggering
- Script execution with timeout
- JSON data passing via stdin
- Fail-open error handling

**Config Loader**
- Hierarchical configuration (user → project → local)
- Environment variable support
- Validation against schema
- Hot-reload capabilities

## Data Flow

### Request Processing Flow

```
┌──────────────────────────────────────────────────────────────────┐
│                        USER INPUT                                 │
│                           │                                       │
│                           ▼                                       │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │               HOOK: user_prompt_submit                      │  │
│  │         (Pre-process, validate, transform)                  │  │
│  └────────────────────────────────────────────────────────────┘  │
│                           │                                       │
│                           ▼                                       │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │                  CONTEXT MANAGER                            │  │
│  │         (Add message, check token budget)                   │  │
│  └────────────────────────────────────────────────────────────┘  │
│                           │                                       │
│                           ▼                                       │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │                    LLM ROUTER                               │  │
│  │    (Select provider, send messages + tools, stream)         │  │
│  └────────────────────────────────────────────────────────────┘  │
│                           │                                       │
│           ┌───────────────┴───────────────┐                      │
│           │                               │                      │
│           ▼                               ▼                      │
│  ┌─────────────────┐           ┌─────────────────────┐          │
│  │  TEXT RESPONSE  │           │    TOOL CALLS       │          │
│  │  (Stream to UI) │           │                     │          │
│  └─────────────────┘           └─────────────────────┘          │
│                                           │                      │
│                                           ▼                      │
│                        ┌─────────────────────────────────────┐  │
│                        │       PERMISSION CHECK              │  │
│                        │  (allow / deny / ask user)          │  │
│                        └─────────────────────────────────────┘  │
│                                           │                      │
│                                           ▼                      │
│                        ┌─────────────────────────────────────┐  │
│                        │    HOOK: pre_tool_use               │  │
│                        │  (Validate, modify, block)          │  │
│                        └─────────────────────────────────────┘  │
│                                           │                      │
│                                           ▼                      │
│                        ┌─────────────────────────────────────┐  │
│                        │      TOOL EXECUTION                 │  │
│                        │  (Built-in or MCP server)           │  │
│                        └─────────────────────────────────────┘  │
│                                           │                      │
│                                           ▼                      │
│                        ┌─────────────────────────────────────┐  │
│                        │    HOOK: post_tool_use              │  │
│                        │  (Format, log, trigger actions)     │  │
│                        └─────────────────────────────────────┘  │
│                                           │                      │
│                                           ▼                      │
│                        ┌─────────────────────────────────────┐  │
│                        │      ADD RESULT TO CONTEXT          │  │
│                        │  (Loop back to LLM Router)          │  │
│                        └─────────────────────────────────────┘  │
│                                           │                      │
│                           ┌───────────────┘                      │
│                           │                                       │
│                           ▼                                       │
│                    (Repeat until done)                           │
│                           │                                       │
│                           ▼                                       │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │                    HOOK: stop                               │  │
│  │              (Cleanup, finalize, log)                       │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

### MCP Communication Flow

```
┌─────────────────┐                    ┌─────────────────┐
│   OpenAgent     │                    │   MCP Server    │
│   (MCP Client)  │                    │  (e.g. MySQL)   │
└────────┬────────┘                    └────────┬────────┘
         │                                      │
         │  1. Initialize Request               │
         │  {"method": "initialize", ...}       │
         │─────────────────────────────────────▶│
         │                                      │
         │  2. Initialize Response              │
         │  {"capabilities": {...}}             │
         │◀─────────────────────────────────────│
         │                                      │
         │  3. List Tools Request               │
         │  {"method": "tools/list"}            │
         │─────────────────────────────────────▶│
         │                                      │
         │  4. Tools Response                   │
         │  {"tools": [{name, desc, schema}]}   │
         │◀─────────────────────────────────────│
         │                                      │
         │  5. Call Tool Request                │
         │  {"method": "tools/call",            │
         │   "params": {name, arguments}}       │
         │─────────────────────────────────────▶│
         │                                      │
         │  6. Tool Result                      │
         │  {"content": [{type, text}]}         │
         │◀─────────────────────────────────────│
         │                                      │
```

## Component Interactions

### Desktop App ↔ CLI Agent

```
┌────────────────────┐          ┌────────────────────┐
│   Desktop App      │          │    CLI Agent       │
│   (Electron Main)  │          │   (Child Process)  │
└─────────┬──────────┘          └─────────┬──────────┘
          │                               │
          │  IPC: Start Agent             │
          │  {config, sessionId}          │
          │──────────────────────────────▶│
          │                               │
          │  IPC: User Message            │
          │  {content: "..."}             │
          │──────────────────────────────▶│
          │                               │
          │  IPC: Stream Chunk            │
          │  {type: "text", content: ""}  │
          │◀──────────────────────────────│
          │                               │
          │  IPC: Tool Call               │
          │  {tool: "Read", params: {}}   │
          │◀──────────────────────────────│
          │                               │
          │  IPC: Permission Request      │
          │  {tool: "Bash", command: ""}  │
          │◀──────────────────────────────│
          │                               │
          │  IPC: Permission Response     │
          │  {approved: true}             │
          │──────────────────────────────▶│
          │                               │
          │  IPC: Tool Result             │
          │  {tool: "Read", output: ""}   │
          │◀──────────────────────────────│
          │                               │
          │  IPC: Agent Complete          │
          │  {sessionId, summary}         │
          │◀──────────────────────────────│
```

## Package Dependencies

```
@openagent/cli
    └── @openagent/core
        ├── @openagent/llm
        ├── @openagent/tools
        ├── @openagent/mcp
        └── @openagent/hooks

@openagent/desktop
    ├── @openagent/core
    └── @openagent/ui
        └── (React components)

@openagent/mcp-server-database
    └── (standalone, no internal deps)
```

## Technology Stack

| Component | Technology | Rationale |
|-----------|------------|-----------|
| Runtime | Bun | Fast, TypeScript-native, single binary |
| Language | TypeScript | Type safety, tooling, ecosystem |
| Desktop | Electron | Cross-platform, mature, VS Code uses it |
| CLI UI | React Ink | React patterns in terminal |
| Web UI | React + TailwindCSS | Modern, fast development |
| State | Zustand | Simple, TypeScript-friendly |
| Build | Turborepo | Monorepo management |
| Testing | Vitest | Fast, ESM-native |
| Bundling | esbuild | Fast bundling for CLI |

## Security Boundaries

```
┌─────────────────────────────────────────────────────────────┐
│                    USER SPACE                                │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                 OpenAgent Process                      │  │
│  │                                                        │  │
│  │  ┌──────────────┐    ┌───────────────────────────┐    │  │
│  │  │ Permission   │    │      Tool Execution       │    │  │
│  │  │   Manager    │───▶│    (Sandboxed where       │    │  │
│  │  │              │    │     possible)             │    │  │
│  │  └──────────────┘    └───────────────────────────┘    │  │
│  │                                                        │  │
│  │  ┌──────────────────────────────────────────────────┐ │  │
│  │  │              MCP Server Connections              │ │  │
│  │  │  (Each server runs in separate process)          │ │  │
│  │  └──────────────────────────────────────────────────┘ │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                              │
│  Security Controls:                                          │
│  - Permission rules (allow/deny/ask)                         │
│  - Hook-based validation                                     │
│  - User approval for sensitive operations                    │
│  - File path restrictions                                    │
│  - Command allowlists                                        │
└─────────────────────────────────────────────────────────────┘
```

## Scalability Considerations

1. **Context Window Management**: Automatic compaction prevents context overflow
2. **Parallel Tool Execution**: Independent tools run concurrently
3. **Subagent Isolation**: Complex tasks delegated to separate context windows
4. **MCP Server Scaling**: Each integration runs in separate process
5. **Session Persistence**: Long tasks can be paused and resumed

## Error Handling Strategy

```
┌─────────────────────────────────────────────────────────────┐
│                    Error Categories                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  TRANSIENT ERRORS (Auto-Retry)                              │
│  - Rate limits (429)                                         │
│  - Temporary network failures                                │
│  - Provider overload (503)                                   │
│  → Exponential backoff + jitter                              │
│                                                              │
│  RECOVERABLE ERRORS (User Intervention)                      │
│  - Permission denied                                         │
│  - Invalid tool parameters                                   │
│  - File not found                                            │
│  → Report to user, suggest fix                               │
│                                                              │
│  FATAL ERRORS (Session Termination)                          │
│  - Invalid API key                                           │
│  - Context overflow (unrecoverable)                          │
│  - Internal consistency errors                               │
│  → Save state, report error, exit cleanly                    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Next Steps

- See [IMPLEMENTATION-PHASES.md](IMPLEMENTATION-PHASES.md) for build order
- See [LLM-ABSTRACTION.md](LLM-ABSTRACTION.md) for provider details
- See [TOOL-SYSTEM.md](TOOL-SYSTEM.md) for tool implementation
- See [MCP-CLIENT.md](MCP-CLIENT.md) for MCP protocol details
