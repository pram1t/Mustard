# Mustard — API Reference

REST + WebSocket reference for `@pram1t/mustard-collab-server`. Every route
except `/health` and `/auth/login` requires a Bearer JWT.

Default base URL: `http://127.0.0.1:3200`

---

## Auth

### `POST /auth/login`

Issue a JWT for a participant.

```json
// Request
{ "participantId": "alice", "participantName": "Alice", "type": "human", "roomId": "optional-room-id" }

// 200
{ "token": "eyJ...", "expiresAt": 1734000000, "participantId": "alice", "roomId": "..." }
```

JWTs are HS256, signed with `config.jwtSecret`, and carry a unique
`jti` (so every issue is distinct even in the same second). Default
lifetime 3600s — configurable via `tokenLifetimeSec`.

Use the token as `Authorization: Bearer <token>` on every other route.

### `POST /auth/refresh`

Issue a new JWT for the same subject + roomId, before the current
one expires.

```bash
curl -X POST http://127.0.0.1:3200/auth/refresh \
  -H "authorization: Bearer $OLD_TOKEN"

# 200
{ "token": "eyJ...", "expiresAt": 1734000000, "participantId": "alice", "roomId": "..." }
```

The old token remains valid until its original expiry — there's no
server-side blacklist in V1. Refusal modes are 401 (missing /
invalid / expired Bearer token).

---

## Health

### `GET /health`

```json
// 200 (no auth)
{ "status": "ok", "timestamp": 1734000000000 }
```

---

## Rooms

### `POST /rooms` — create

```json
// Request
{
  "name": "My Room",
  "projectPath": "/repo/x",            // optional
  "config": {                          // optional, all fields optional
    "visibility": "private|team|public",
    "defaultMode": "plan|code|ask|auto",
    "aiEnabled": true,
    "maxAgents": 3
  }
}

// 201
{ "room": { ...Room } }
```

The JWT subject becomes the room's `ownerId`.

### `GET /rooms` — list

```json
// 200
{ "rooms": [ { ...Room } ] }
```

### `GET /rooms/:id` — get one

```json
// 200
{
  "room": { ...Room },
  "participants": [ { ...Participant } ],
  "mode": "plan|code|ask|auto"
}
```

### `DELETE /rooms/:id` — delete

204 on success. **Owner only** — non-owners get 403.

---

## Participants

### `POST /rooms/:id/join`

```json
// Request (all optional)
{ "name": "Alice", "type": "human|ai", "role": "owner|admin|member|viewer" }

// 201
{ "participant": { ...Participant } }
```

The JWT subject becomes the participant's `userId`. Default `name` is
the JWT subject; default `type` is `human`; default `role` is `member`.

### `POST /rooms/:id/participants/:pid/leave`

204 on success.

### `GET /rooms/:id/participants`

```json
// 200
{ "participants": [ { ...Participant } ] }
```

---

## Intents

### `GET /rooms/:id/intents` — list

Optional `?status=pending|approved|rejected|executing|completed|failed|invalidated`.

```json
// 200
{ "intents": [ { ...Intent } ] }
```

### `POST /rooms/:id/intents` — propose

```json
// Request — all fields required
{
  "agentId": "agent-1",
  "summary": "edit src/a.ts",
  "type": "file_read|file_create|file_edit|file_delete|file_rename|command_run|search|analyze|other",
  "action": { ...IntentAction matching the type },
  "rationale": "why this is needed",
  "confidence": 0.9,
  "risk": "safe|moderate|dangerous"
}

// 201
{ "intent": { ...Intent, "status": "pending" } }
```

The intent immediately flows through the `PermissionGateway`. Depending
on mode + risk + sensitive-file match, the intent may be:
- auto-approved/rejected (final state)
- held pending in plan mode
- held pending with an `ApprovalRequest` queued (manual approval)

### `POST /rooms/:id/intents/:iid/approve`

```json
// Request (optional)
{ "approver": "alice" }   // defaults to the JWT subject

// 200
{ "approval": { ...ApprovalRequest, "status": "approved" } }
```

Returns 404 if there's no waiting approval for that intent (e.g. it
was already auto-resolved or in plan mode).

### `POST /rooms/:id/intents/:iid/reject`

```json
// Request (optional)
{ "rejecter": "alice", "reason": "too risky" }

// 200
{ "approval": { ...ApprovalRequest, "status": "rejected" } }
```

---

## Mode

### `GET /rooms/:id/mode`

```json
// 200
{
  "mode": "plan|code|ask|auto",
  "capabilities": { canRead, canWrite, canExecute, canPropose,
                    writeRequiresApproval, executeRequiresApproval,
                    autoApproveSafe },
  "state": { current, previous?, setBy, setAt }
}
```

### `POST /rooms/:id/mode`

```json
// Request
{ "mode": "code" }

// 200
{ "mode": "code", "event": { type: "mode_changed", roomId, oldMode, newMode, changedBy, timestamp } }
```

Changing mode invalidates any in-flight approval requests for the room
(intents are marked `invalidated` via the gateway).

---

## AI agents

### `POST /rooms/:id/agents` — register

```json
// Request
{
  "agentId": "agent-1",
  "name": "Coder",
  "model": "gpt-4o",
  "provider": "openai",
  "allowedActions": ["file_read", "file_edit"]   // optional
}

// 201
{ "agent": { ...RegisteredAgent } }
// 409 on duplicate agentId
```

### `GET /rooms/:id/agents` — list

```json
// 200
{ "agents": [ { ...RegisteredAgent } ] }
```

### `DELETE /rooms/:id/agents/:aid`

204 on success.

---

## WebSocket

### `GET /ws?token=<JWT>&roomId=<id>`

Upgrade to a WebSocket. `token` is required; `roomId` is optional —
when present, the server forwards only events whose `source` matches
that roomId. Without it, every event the server publishes is forwarded.

Auth failures close the socket with code `1008`.

#### Frame format

Every server → client frame is JSON:

```json
{
  "type": "collab.<topic>",
  "source": "<roomId or undefined>",
  "payload": { /* event-specific payload */ },
  "timestamp": 1734000000000
}
```

#### Forwarded topics

| Topic | Payload |
|---|---|
| `collab.room.created` | `{ room: Room }` |
| `collab.room.participant_joined` | `Participant` |
| `collab.room.participant_left` | `Participant` |
| `collab.ai.intent.proposed` | `Intent` |
| `collab.ai.intent.approved` | `Intent` |
| `collab.ai.intent.rejected` | `Intent` |
| `collab.ai.intent.executing` | `Intent` |
| `collab.ai.intent.completed` | `Intent` |
| `collab.ai.intent.failed` | `Intent` |
| `collab.ai.intent.invalidated` | `Intent` |
| `collab.permissions.mode.changed` | `ModeChangeEvent` |

---

## Error shape

Every non-2xx response uses the same body shape:

```json
{
  "error": {
    "code": "INVALID_INPUT|UNAUTHORIZED|FORBIDDEN|NOT_FOUND|CONFLICT|INTERNAL",
    "message": "human-readable detail"
  }
}
```

Common failures:

| Status | When |
|---|---|
| 400 | Missing required field, invalid mode, etc. |
| 401 | No / invalid / expired JWT |
| 403 | Not the room owner (delete) |
| 404 | Room / intent / participant / agent not found |
| 409 | Duplicate agent id |

---

## Type cheatsheet

The full TypeScript types live in `@pram1t/mustard-collab-core`,
`@pram1t/mustard-collab-ai`, and `@pram1t/mustard-collab-permissions`. Quick
reference of the shapes the API surfaces:

```ts
interface Room {
  id: string;
  name: string;
  slug: string;
  projectPath?: string;
  status: 'active' | 'dormant';
  ownerId: string;
  createdAt: string;        // ISO
  updatedAt: string;        // ISO
  config: {
    visibility: 'private' | 'team' | 'public';
    defaultMode: 'plan' | 'code' | 'ask' | 'auto';
    aiEnabled: boolean;
    maxAgents: number;
  };
}

interface Participant {
  id: string;
  roomId: string;
  userId: string;
  name: string;
  type: 'human' | 'ai';
  role: 'owner' | 'admin' | 'member' | 'viewer';
  status: 'online' | 'offline' | 'away';
  joinedAt: string;         // ISO
}

interface Intent {
  id: string;
  agentId: string;
  summary: string;
  type: 'file_read' | 'file_create' | 'file_edit' | 'file_delete'
      | 'file_rename' | 'command_run' | 'search' | 'analyze' | 'other';
  rationale: string;
  confidence: number;       // 0..1
  risk: 'safe' | 'moderate' | 'dangerous';
  status: 'pending' | 'approved' | 'rejected' | 'executing'
        | 'completed' | 'failed' | 'invalidated';
  createdAt: number;        // epoch ms
  resolvedAt?: number;
  resolvedBy?: string;
  rejectionReason?: string;
}
```

---

## Examples

### curl: create + join + propose

```bash
TOKEN=$(curl -s http://127.0.0.1:3200/auth/login \
  -H 'content-type: application/json' \
  -d '{"participantId":"alice"}' | jq -r .token)

ROOM_ID=$(curl -s http://127.0.0.1:3200/rooms \
  -H "authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' \
  -d '{"name":"Demo","config":{"defaultMode":"code"}}' | jq -r .room.id)

curl -s "http://127.0.0.1:3200/rooms/$ROOM_ID/join" \
  -X POST -H "authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' \
  -d '{"name":"Alice","type":"human","role":"owner"}'
```

### Node: WebSocket subscriber

```js
import WebSocket from 'ws';
const socket = new WebSocket(`ws://127.0.0.1:3200/ws?token=${TOKEN}&roomId=${ROOM_ID}`);
socket.on('open', () => console.log('connected'));
socket.on('message', raw => console.log(JSON.parse(raw.toString())));
```
