# IPC Architecture

## Design Principles

1. **Transport Only** — IPC handlers forward messages without transformation. No business logic, no conditional routing, no message shaping.
2. **Sender Validation** — Every handler validates the sender is the main window via `validateSender()`.
3. **Channel Allowlist** — All 20 channels are defined in `src/shared/ipc-channels.ts`. No dynamic channel creation.
4. **Minimal Surface** — 20 channels, 15 preload methods. Both at their design limits.

## Channel Reference

| Channel | Category | Direction | Request | Response |
|---|---|---|---|---|
| `agent:chat` | Agent | invoke | `{ message: string }` | `{ success: boolean }` |
| `agent:stop` | Agent | invoke | void | `{ success: boolean }` |
| `agent:event` | Agent | send (one-way) | — | `AgentEvent` |
| `agent:status` | Agent | invoke | void | `AgentStatus` |
| `config:get` | Config | invoke | void | `AppConfig` |
| `config:set` | Config | invoke | `{ config: Record }` | `{ success: boolean }` |
| `config:getProviders` | Config | invoke | void | `ProviderInfo[]` |
| `config:getModels` | Config | invoke | `{ provider: string }` | `ModelInfo[]` |
| `mcp:list` | MCP | invoke | void | `MCPServerInfo[]` |
| `mcp:add` | MCP | invoke | `{ server: MCPServerConfig }` | `{ success, serverId }` |
| `mcp:remove` | MCP | invoke | `{ serverId: string }` | `{ success: boolean }` |
| `mcp:status` | MCP | invoke | `{ serverId: string }` | `MCPServerStatus` |
| `mcp:restart` | MCP | invoke | `{ serverId: string }` | `{ success: boolean }` |
| `window:minimize` | Window | invoke | void | void |
| `window:maximize` | Window | invoke | void | void |
| `window:close` | Window | invoke | void | void |
| `window:isMaximized` | Window | invoke | void | `boolean` |
| `app:version` | App | invoke | void | `string` |
| `app:checkUpdate` | App | invoke | void | `UpdateInfo \| null` |
| `app:quit` | App | invoke | void | void |

## Event Flow

```
Request/Response (invoke):
  Renderer  →  preload (ipcRenderer.invoke)  →  main (ipcMain.handle)
     ↑                                              │
     └──────────────── return value ────────────────┘

One-way Events (send):
  Main  →  emitEvent()  →  webContents.send(agent:event)  →  preload (ipcRenderer.on)  →  Renderer callback
```

## Handler Pattern

Every handler follows this exact structure:

```typescript
ipcMain.handle(IPC_CHANNELS.XXX, async (event, payload) => {
  validateSender(event);           // MUST be first line
  return service.method(payload);  // Direct delegation, no logic
});
```

Constraints:
- Max 10 lines per handler body
- `validateSender(event)` must be the first statement
- No business logic, conditional routing, or message transformation
- All channel constants from `IPC_CHANNELS`, no hardcoded strings

## Preload Contract

The preload exposes 15 methods via `window.api`:

| Method | Channel | Payload Wrapping |
|---|---|---|
| `chat(message)` | `agent:chat` | `{ message }` |
| `stop()` | `agent:stop` | — |
| `onEvent(callback)` | `agent:event` | `ipcRenderer.on` + unsubscribe |
| `getStatus()` | `agent:status` | — |
| `getConfig()` | `config:get` | — |
| `setConfig(config)` | `config:set` | `{ config }` |
| `getProviders()` | `config:getProviders` | — |
| `getModels(providerId)` | `config:getModels` | `{ provider: providerId }` |
| `getMCPServers()` | `mcp:list` | — |
| `setMCPServer(server)` | `mcp:add` | `{ server }` → extracts `.serverId` |
| `removeMCPServer(id)` | `mcp:remove` | `{ serverId }` |
| `minimize()` | `window:minimize` | — |
| `toggleMaximize()` | `window:maximize` | — |
| `close()` | `window:close` | — |
| `getAppInfo()` | `app:version` | Composes with `process.platform`/`arch` |

## Anti-Patterns

Do NOT:
- Add business logic inside handlers (transform data, validate payloads beyond sender)
- Create handlers longer than 10 lines
- Use hardcoded channel strings instead of `IPC_CHANNELS.XXX`
- Register handlers for `agent:event` (it's one-way from main to renderer)
- Skip `validateSender()` in any handler
- Add new channels without updating `ipc-channels.ts` allowlist

## Stub Status

All handlers currently return stub data. Real service integration by phase:

| Handler Group | Service | Integration Phase |
|---|---|---|
| Agent (chat, stop, status) | @openagent/core AgentLoop | Phase 5 |
| Config (get, set, providers, models) | @openagent/config | Phase 5+ |
| MCP (list, add, remove, status, restart) | @openagent/mcp | Phase 8+ |
| Window (minimize, maximize, close) | BrowserWindow | Already functional |
| App (version) | `app.getVersion()` | Already functional |
| App (checkUpdate) | Auto-updater | Phase 19 |

## Security

- Sender validation rejects requests from non-main-window webContents
- Origin validation rejects requests from `http://` or `https://` origins
- Only `file://` and `app://` origins are permitted
- `agent:event` has no handler — it's send-only from main process
- Event emitter silently drops events if window is null or destroyed
- All types defined in `src/shared/` — no runtime type exposure to renderer

## Testing

```bash
cd apps/desktop && npx vitest run
```

Tests cover:
- Sender validation (7 tests): null frame, null window, wrong sender, origin checks
- Handler registration (10 tests): channel counts, allowlist membership, total handlers
- Event emitter (6 tests): send channel, null/destroyed window, invalid events, status convenience
