# Getting Started — OpenAgent Collab

Get a local Collab room up and running in ~5 minutes.

---

## Prerequisites

- Node.js ≥ 20
- The `openagent` monorepo cloned + built once: `npm install && npm run build`

---

## 1. Start the Collab server

The Phase-8 server (`@openagent/collab-server`) needs a JWT secret.
Anything random works for dev:

```js
// dev-server.mjs
import { createApp } from './packages/collab-server/dist/index.js';

const { app, config } = await createApp({
  config: {
    jwtSecret: 'change-me-in-prod',
    port: 3200,
    host: '127.0.0.1',
  },
});

await app.listen({ port: config.port, host: config.host });
console.log(`✓ Collab server on http://${config.host}:${config.port}`);
```

```bash
node dev-server.mjs
# → ✓ Collab server on http://127.0.0.1:3200
```

That's the whole server. It exposes REST under `/`, WebSocket at `/ws`,
and a `/health` ping.

---

## 2. Use the CLI

The CLI ships with `openagent collab` for interacting with that server.

```bash
# Tell the CLI where to find the server (or pass --base on each call).
export OPENAGENT_COLLAB_URL=http://127.0.0.1:3200

# Cache a JWT for `alice` — token persists in
# ~/.openagent/collab/tokens.json
openagent collab login --as alice

# Create a room
openagent collab room create "Demo Room"
# → Demo Room  (id: 6f2a...)
#     mode:       plan
#     visibility: private

# List rooms
openagent collab room list

# Join the room
openagent collab room join <id>

# Switch the room into auto mode (safe ops auto-approve via countdown)
openagent collab mode set <id> auto

# In another terminal: stream live events
openagent collab tail <id>
# ↪ tailing ws://127.0.0.1:3200/ws?token=...&roomId=...
# ✓ connected
# 2026-04-23T16:00:01.000Z [<roomId>] collab.permissions.mode.changed
```

CLI cheatsheet:

| Command | What it does |
|---|---|
| `collab login` | Cache a JWT |
| `collab logout` | Clear cached token |
| `collab room create <name>` | Create a room |
| `collab room list` | List rooms |
| `collab room get <id>` | Show room + participants + mode |
| `collab room delete <id>` | Delete (owner only) |
| `collab room join <id>` | Join a room |
| `collab room leave <id> <pid>` | Leave a room |
| `collab mode get <id>` | Show current mode |
| `collab mode set <id> <mode>` | Change mode (plan/code/ask/auto) |
| `collab tail [roomId]` | Stream live events |

Add `--json` to any command to get JSON instead of pretty text.

---

## 3. Use the web UI

Start the Next.js workspace (`apps/web`):

```bash
cd apps/web
npm run dev
# Next.js on http://localhost:3000  (or whatever port it picks)
```

Open `http://localhost:3000/collab`. First time you'll be prompted for
your participant id and the server URL (defaults to `http://127.0.0.1:3200`
— matching the CLI). Identity is persisted in `localStorage`.

From there:

- The **Rooms** view lists everything you created and lets you create a new one
- Click any room → **Room detail** view: mode selector, intents list, live event log on the right
- Pending intents show **Approve / Reject** buttons
- Mode switches propagate live to anyone else watching the same room

---

## 4. Permission modes — the 30-second version

| Mode | What happens to proposed intents |
|---|---|
| **Plan** | Stays pending — proposals are documentation; nothing executes |
| **Code** | Manual approval required for every write |
| **Ask** | Discussion only — proposals get auto-rejected (no execution) |
| **Auto** | Safe ops auto-approve after a 10s countdown; moderate after 30s; dangerous still need manual approval |

**Always-manual override**: any intent touching a sensitive file
(`.env`, `*.pem`, `~/.ssh/*`, etc. — see `DEFAULT_SENSITIVE_PATTERNS`)
requires manual approval regardless of mode.

---

## 5. What's in the box

- **Permissioned proposals**: every AI action is an Intent that flows
  through the gateway → mode policy → manual or auto approval
- **Live event stream**: every state change reaches every connected
  participant via the WebSocket bridge
- **Cross-room isolation**: WS clients can filter to a single room
- **JWT auth** with token caching in the CLI
- **In-memory rooms** by default; persistence and Yjs file sync are
  on the roadmap (see `docs/COLLAB-INTEGRATION.md` → Out of scope for V1)

---

## Next reading

- [`docs/COLLAB-API.md`](./COLLAB-API.md) — REST + WebSocket reference
- [`docs/COLLAB-INTEGRATION.md`](./COLLAB-INTEGRATION.md) — package map + runtime topology + event flow
