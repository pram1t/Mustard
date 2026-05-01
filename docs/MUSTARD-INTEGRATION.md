# Mustard — Integration Guide

> How the Collab-V1 packages plug together end-to-end.

---

## Package map

| Package | Role |
|---|---|
| `@pram1t/mustard-collab-core` | Rooms, participants, invitations, shared types |
| `@pram1t/mustard-collab-sync` | Yjs CRDT document + WebSocket sync provider (file-level edits — wired in Phase 12+) |
| `@pram1t/mustard-collab-presence` | Cursors, awareness, activity, follow |
| `@pram1t/mustard-collab-ai` | IntentEngine, ZoneManager, RateLimiter, AgentRegistry, ContextBridge, bus adapter |
| `@pram1t/mustard-collab-permissions` | ModeManager, ApprovalManager, RiskAssessor, SensitiveFileDetector, PermissionGateway |
| `@pram1t/mustard-collab-memory` | EphemeralMemory + SQLite-backed Session/Project/Team layers + ContextAssembler + Summarizer |
| `@pram1t/mustard-collab-server` | Fastify HTTP + WebSocket server, RoomRegistry, JWT auth |
| `apps/web` | Next.js workspace UI (`/collab`, `/collab/[id]`) — CollabClient + useCollabSocket |
| `apps/cli` | `openagent collab ...` subcommands + token cache |

---

## Runtime topology

```
┌───────────────────────────────────────────────────────────────────────┐
│                          Browser (apps/web)                           │
│   ┌──────────────────────────────────────┐                            │
│   │  CollabClient (REST)  ───── HTTP ───────┐                         │
│   │  useCollabSocket      ───── WS ─────┐   │                         │
│   └──────────────────────────────────────┘   │   │                    │
└──────────────────────────────────────────────│───│────────────────────┘
                                               │   │
┌──────────────────────────────────────────────│───│────────────────────┐
│                          CLI (apps/cli)      │   │                    │
│   ┌──────────────────────────────────────┐   │   │                    │
│   │  openagent collab room ... ────────────┘                          │
│   │  openagent collab tail ────────────────────┘                      │
│   │  Token cache: ~/.openagent/collab/tokens.json                     │
│   └──────────────────────────────────────┘                            │
└───────────────────────────────────────────────────────────────────────┘
                                               │
                          ┌────────────────────▼────────────────────┐
                          │        @pram1t/mustard-collab-server         │
                          │                                          │
                          │   Fastify app ┬─ /auth/login            │
                          │               ├─ /rooms/...             │
                          │               ├─ /rooms/:id/intents/... │
                          │               ├─ /rooms/:id/mode        │
                          │               ├─ /rooms/:id/agents/...  │
                          │               └─ /ws  (WebSocket)       │
                          │                                          │
                          │   RoomRegistry ─ per-room context:       │
                          │     ├─ IntentEngine                      │
                          │     ├─ ZoneManager / RateLimiter         │
                          │     │      AgentRegistry                  │
                          │     ├─ ModeManager                       │
                          │     ├─ ApprovalManager                   │
                          │     ├─ PermissionGateway                 │
                          │     └─ EphemeralMemory                   │
                          │                                          │
                          │   Shared EventBus ─ topics:              │
                          │     collab.ai.intent.*                   │
                          │     collab.permissions.mode.*            │
                          │     collab.room.*                        │
                          └──────────────────────────────────────────┘
```

---

## Auth (JWT)

- HMAC-SHA256, sign + verify in `@pram1t/mustard-collab-server/jwt`
- Issued by `POST /auth/login` with `{ participantId, roomId? }`
- Required on every other route via the `auth: true` route-config flag
- Tokens carry `sub` (participant id) and optional `roomId`
- WS upgrades validated via `?token=` query param
- CLI caches tokens at `~/.openagent/collab/tokens.json` keyed by participantId; auto-renews on expiry

---

## Event flow (proposed → approved)

```
1. Client POST /rooms/:id/intents
       ↓
2. RoomContext.intentEngine.propose() emits 'proposed' (local)
       ↓
3. Bus adapter publishes collab.ai.intent.proposed (source=roomId)
       ↓
4. PermissionGateway listener fires (synchronous)
       ↓
5. RiskAssessor.assess + SensitiveFileDetector.check
       ↓
6. permissionChecker.decide(mode, intent, assessment, sensitive)
       ↓
   Decision is one of:
     auto_approve     → engine.approve(...)        → 'approved' published
     auto_reject      → engine.reject(...)         → 'rejected' published
     hold_pending     → no-op (plan mode docs only)
     require_approval → approvalManager.open(req)  → countdown timer + bus event
       ↓
7. Manual /approve or /reject (or countdown fires) → engine.approve/reject
       ↓
8. WS clients subscribed to collab.ai.intent.* receive every transition
```

---

## Mode change cascade

```
POST /rooms/:id/mode { mode: 'auto' }
       ↓
ModeManager.setMode emits 'changed'
       ↓
Bus adapter publishes collab.permissions.mode.changed
       ↓
PermissionGateway 'mode_changed' listener:
       └─ cancels every in-flight ApprovalRequest for this room
       └─ engine.invalidate(intentId) on each linked intent
       ↓
WS clients receive both the mode.changed event AND
the resulting intent.invalidated cascade
```

---

## Sensitive file gating

`PermissionGateway` always pulls a `SensitiveFileDetector.check(path)` for every
file-touching intent. A non-null match overrides whatever the mode would say:
the gateway opens an `ApprovalRequest` with `countdownSec=0` (manual approval
only, even in `auto` mode). This is asserted by the Phase-11 integration test
"intents touching .env stay pending in auto mode (no countdown)".

---

## End-to-end smoke test

```bash
# Terminal 1 — start the server
cd packages/collab-server && npm run build
node -e "import('./dist/index.js').then(async m => {
  const { app } = await m.createApp({ config: { jwtSecret: 'dev-secret' } });
  await app.listen({ host: '127.0.0.1', port: 3200 });
  console.log('listening :3200');
})"

# Terminal 2 — drive the CLI
export OPENAGENT_COLLAB_URL=http://127.0.0.1:3200
openagent collab login --as alice
openagent collab room create "Demo"
openagent collab room list
openagent collab room get <id>
openagent collab mode set <id> auto

# Terminal 3 — tail live events
openagent collab tail <roomId>

# Browser — visit http://localhost:3200's web UI peer (if you start
# apps/web on :3201 etc, point its baseUrl to :3200)
```

---

## Shipped in Phase 13 + 14 (closing the largest deferred items)

- **Yjs document sync** — ✅ DONE. `/yjs` upgrade endpoint via
  y-websocket's `setupWSConnection`. JWT-authenticated. Per-room
  Y.Doc keyed by roomId. Web UI ships a SharedNotepad demo binding a
  Y.Text to a textarea — multi-participant live edit with server-side
  persistence.
- **Server-side Yjs checkpoint persistence** — ✅ DONE.
  `SqliteYjsPersistence` stores full encoded Y.Doc state per docName
  (debounced writes, default 250ms). State survives server restart.
- **Refresh tokens** — ✅ DONE. `POST /auth/refresh` accepts a
  still-valid Bearer JWT and returns a new token with a fresh
  lifetime, preserving sub + roomId. JWTs now include a `jti` so
  every issued token is unique even within the same second.

## Still out of scope for V1

These remain deferred to the Super-V2 plan or a later collab-v2
cycle:

- **Monaco editor binding** — SharedNotepad ships a textarea demo;
  full Monaco with multi-cursor presence is a UX phase
- **WebRTC signaling / P2P** — Activity 8.6 in the original plan
- **Multi-server scale-out** — Redis pub/sub bridge between bus
  instances
- **Production-grade auth hardening** — RS256, JWKS, key rotation
  (HS256 + refresh is fine for self-hosted single-server)
- **Server-side token revocation** — refresh issues new tokens but
  doesn't blacklist old ones; old tokens remain valid until their
  original expiry
- **Per-org policy limits** — mode allowlist enforced at the server
  level (currently enforced at the gateway level only)
- **Conflict-merge prompts in CLI** (needs Yjs CLI client work)
- **Terminal output sharing**
