# Thin Client Architecture

## Principle

The desktop app is a **presentation-only** client. All agent logic, tool execution, LLM routing, and configuration management live in the `@pram1t/mustard-*` workspace packages. The desktop process delegates to these packages through a minimal service layer.

## What the Desktop Does

- Renders the UI (React in the renderer process)
- Forwards user messages to services via IPC
- Streams agent events to the renderer via one-way IPC
- Manages the Electron window lifecycle
- Validates IPC senders and origins

## What the Desktop Does NOT Do

- Run agent logic or manage conversation state
- Transform, filter, or shape agent events (beyond type adaptation)
- Make LLM API calls directly
- Execute tools or manage tool registries
- Implement business rules or conditional routing in IPC handlers

## Service Layer

Three services wrap the workspace packages as thin delegation:

```
AgentService  → @pram1t/mustard-core   (AgentLoop lifecycle, event streaming)
ConfigService → @pram1t/mustard-config (read/write config, provider listing)
MCPService    → @pram1t/mustard-mcp    (server management, connect/disconnect)
```

Services are initialized once at startup (`initializeServices()`) and accessed via getter functions (`getAgentService()`, etc.). They throw if called before initialization.

## Event Flow

```
User types message
    ↓
Renderer → preload (window.api.chat) → IPC invoke → agent handler
    ↓
AgentService.chat(message) → returns { success: true } immediately
    ↓
Detached async: AgentLoop.run(message) yields CoreAgentEvents
    ↓
Event Adapter: CoreAgentEvent → DesktopAgentEvent (or null if dropped)
    ↓
emitEvent() → webContents.send('agent:event') → preload → Renderer callback
```

## Event Adapter

Maps 12 core event types to 7 desktop event types:

| Core Event | Desktop Event | Notes |
|---|---|---|
| text | TextEvent | Direct mapping |
| tool_call | ToolCallEvent | Enriched with risk assessment |
| tool_result | ToolResultEvent | Direct mapping |
| error | ErrorEvent | Error code classified from message |
| done | DoneEvent | Direct mapping |
| thinking | ThinkingEvent | Direct mapping |
| permission_ask | ToolCallEvent | With `requiresConfirmation: true` |
| permission_denied | ErrorEvent | With `PERMISSION_DENIED` code |
| compaction | null | Logged, dropped |
| hook_triggered | null | Logged, dropped |
| hook_blocked | null | Logged, dropped |
| hook_output | null | Logged, dropped |

## Tool Security

Every tool call event is enriched with a risk assessment before reaching the renderer:

- **Low risk** (no confirmation): Read, Glob, Grep, TodoRead, etc.
- **Medium risk** (no confirmation): Write, Edit, NotebookEdit, etc.
- **High risk** (requires confirmation): Bash, Task, WebFetch, WebSearch, all MCP tools

## Security Boundaries

1. **API keys never reach the renderer** — ConfigService returns `hasApiKey: boolean`, never the actual key
2. **IPC sender validation** — every handler validates the sender is the main window
3. **Origin validation** — only `file://` and `app://` origins permitted
4. **Tool confirmation** — high-risk tools require user approval before execution
5. **MCP tools always high risk** — any tool containing `__` (MCP separator) requires confirmation
