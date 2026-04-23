# OpenAgent Collab — Integration Guide

> How the Collab-V1 packages plug together end-to-end.

---

## Package map

| Package | Role |
|---|---|
| `@openagent/collab-core` | Rooms, participants, invitations, shared types |
| `@openagent/collab-sync` | Yjs CRDT document + WebSocket sync provider (file-level edits — wired in Phase 12+) |
| `@openagent/collab-presence` | Cursors, awareness, activity, follow |
| `@openagent/collab-ai` | IntentEngine, ZoneManager, RateLimiter, AgentRegistry, ContextBridge, bus adapter |
| `@openagent/collab-permissions` | ModeManager, ApprovalManager, RiskAssessor, SensitiveFileDetector, PermissionGateway |
| `@openagent/collab-memory` | EphemeralMemory + SQLite-backed Session/Project/Team layers + ContextAssembler + Summarizer |
| `@openagent/collab-server` | Fastify HTTP + WebSocket server, RoomRegistry, JWT auth |
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
                          │        @openagent/collab-server         │
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

- HMAC-SHA256, sign + verify in `@openagent/collab-server/jwt`
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

## Out of scope for V1

These are deliberately deferred to the Super-V2 plan or a later
collab-v2 cycle:

- **Yjs document sync** — `setupWSConnection` integration with
  `@openagent/collab-sync` so `apps/web` can render a Monaco editor
  with live cursors. The wire protocol is in place; only the document
  binding is pending.
- **WebRTC signaling / P2P** — Activity 8.6 in the original plan
- **Checkpoint persistence** — server-side Yjs state snapshots
- **Multi-server scale-out** — Redis pub/sub bridge between bus
  instances
- **Production-grade auth** — refresh tokens, RS256, JWKS, key
  rotation; current HS256 is fine for self-hosted single-server
- **Per-org policy limits** — mode allowlist enforced at the server
  level (currently enforced at the gateway level only)
