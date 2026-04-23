import { describe, it, expect } from 'vitest';
import { createApp } from '../app.js';
import type { LoginResponse } from '../types.js';

const SECRET = 'test-secret-change-me';

async function makeApp() {
  const r = await createApp({ config: { jwtSecret: SECRET } });
  return r;
}

async function login(
  app: Awaited<ReturnType<typeof makeApp>>['app'],
  participantId = 'alice',
  roomId?: string,
): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: { participantId, roomId },
  });
  return (res.json() as LoginResponse).token;
}

function authHeaders(token: string) {
  return { authorization: `Bearer ${token}` };
}

// =============================================================================
// Rooms
// =============================================================================

describe('POST /rooms', () => {
  it('creates a room with the JWT subject as owner', async () => {
    const { app } = await makeApp();
    const token = await login(app);
    const res = await app.inject({
      method: 'POST',
      url: '/rooms',
      headers: authHeaders(token),
      payload: { name: 'My Room', projectPath: '/repo/x' },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.room.name).toBe('My Room');
    expect(body.room.ownerId).toBe('alice');
    expect(body.room.projectPath).toBe('/repo/x');
    await app.close();
  });

  it('rejects body without name', async () => {
    const { app } = await makeApp();
    const token = await login(app);
    const res = await app.inject({
      method: 'POST',
      url: '/rooms',
      headers: authHeaders(token),
      payload: {},
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it('requires auth', async () => {
    const { app } = await makeApp();
    const res = await app.inject({
      method: 'POST',
      url: '/rooms',
      payload: { name: 'X' },
    });
    expect(res.statusCode).toBe(401);
    await app.close();
  });
});

describe('GET /rooms + /rooms/:id', () => {
  it('lists rooms for an authenticated user', async () => {
    const { app } = await makeApp();
    const token = await login(app);
    await app.inject({
      method: 'POST',
      url: '/rooms',
      headers: authHeaders(token),
      payload: { name: 'A' },
    });
    await app.inject({
      method: 'POST',
      url: '/rooms',
      headers: authHeaders(token),
      payload: { name: 'B' },
    });

    const res = await app.inject({
      method: 'GET',
      url: '/rooms',
      headers: authHeaders(token),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().rooms).toHaveLength(2);
    await app.close();
  });

  it('GET /rooms/:id returns the room + participants + mode', async () => {
    const { app } = await makeApp();
    const token = await login(app);
    const created = await app.inject({
      method: 'POST',
      url: '/rooms',
      headers: authHeaders(token),
      payload: { name: 'A' },
    });
    const roomId = created.json().room.id;
    const res = await app.inject({
      method: 'GET',
      url: `/rooms/${roomId}`,
      headers: authHeaders(token),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.room.id).toBe(roomId);
    expect(body.mode).toBe('plan');
    expect(Array.isArray(body.participants)).toBe(true);
    await app.close();
  });

  it('GET /rooms/:id returns 404 for unknown id', async () => {
    const { app } = await makeApp();
    const token = await login(app);
    const res = await app.inject({
      method: 'GET',
      url: '/rooms/nope',
      headers: authHeaders(token),
    });
    expect(res.statusCode).toBe(404);
    await app.close();
  });
});

describe('DELETE /rooms/:id', () => {
  it('owner can delete', async () => {
    const { app } = await makeApp();
    const token = await login(app, 'alice');
    const created = await app.inject({
      method: 'POST',
      url: '/rooms',
      headers: authHeaders(token),
      payload: { name: 'A' },
    });
    const id = created.json().room.id;
    const res = await app.inject({
      method: 'DELETE',
      url: `/rooms/${id}`,
      headers: authHeaders(token),
    });
    expect(res.statusCode).toBe(204);
    await app.close();
  });

  it('non-owner gets 403', async () => {
    const { app } = await makeApp();
    const ownerToken = await login(app, 'alice');
    const otherToken = await login(app, 'bob');
    const created = await app.inject({
      method: 'POST',
      url: '/rooms',
      headers: authHeaders(ownerToken),
      payload: { name: 'A' },
    });
    const id = created.json().room.id;
    const res = await app.inject({
      method: 'DELETE',
      url: `/rooms/${id}`,
      headers: authHeaders(otherToken),
    });
    expect(res.statusCode).toBe(403);
    await app.close();
  });
});

// =============================================================================
// Participants
// =============================================================================

describe('POST /rooms/:id/join + participants', () => {
  it('joins the room as the JWT subject + lists in /participants', async () => {
    const { app } = await makeApp();
    const token = await login(app, 'alice');
    const created = await app.inject({
      method: 'POST',
      url: '/rooms',
      headers: authHeaders(token),
      payload: { name: 'A' },
    });
    const id = created.json().room.id;

    const join = await app.inject({
      method: 'POST',
      url: `/rooms/${id}/join`,
      headers: authHeaders(token),
      payload: { name: 'Alice', type: 'human', role: 'owner' },
    });
    expect(join.statusCode).toBe(201);
    const participant = join.json().participant;
    expect(participant.userId).toBe('alice');
    expect(participant.role).toBe('owner');

    const list = await app.inject({
      method: 'GET',
      url: `/rooms/${id}/participants`,
      headers: authHeaders(token),
    });
    expect(list.json().participants).toHaveLength(1);

    const leave = await app.inject({
      method: 'POST',
      url: `/rooms/${id}/participants/${participant.id}/leave`,
      headers: authHeaders(token),
    });
    expect(leave.statusCode).toBe(204);

    const list2 = await app.inject({
      method: 'GET',
      url: `/rooms/${id}/participants`,
      headers: authHeaders(token),
    });
    expect(list2.json().participants).toHaveLength(0);
    await app.close();
  });
});

// =============================================================================
// Mode
// =============================================================================

describe('GET/POST /rooms/:id/mode', () => {
  it('reads + sets the current mode', async () => {
    const { app } = await makeApp();
    const token = await login(app);
    const created = await app.inject({
      method: 'POST',
      url: '/rooms',
      headers: authHeaders(token),
      payload: { name: 'A' },
    });
    const id = created.json().room.id;

    const get1 = await app.inject({
      method: 'GET',
      url: `/rooms/${id}/mode`,
      headers: authHeaders(token),
    });
    expect(get1.json().mode).toBe('plan');

    const set = await app.inject({
      method: 'POST',
      url: `/rooms/${id}/mode`,
      headers: authHeaders(token),
      payload: { mode: 'code' },
    });
    expect(set.statusCode).toBe(200);
    expect(set.json().mode).toBe('code');

    const get2 = await app.inject({
      method: 'GET',
      url: `/rooms/${id}/mode`,
      headers: authHeaders(token),
    });
    expect(get2.json().mode).toBe('code');
    await app.close();
  });

  it('rejects an invalid mode value', async () => {
    const { app } = await makeApp();
    const token = await login(app);
    const created = await app.inject({
      method: 'POST',
      url: '/rooms',
      headers: authHeaders(token),
      payload: { name: 'A' },
    });
    const id = created.json().room.id;
    const res = await app.inject({
      method: 'POST',
      url: `/rooms/${id}/mode`,
      headers: authHeaders(token),
      payload: { mode: 'wrong' },
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });
});

// =============================================================================
// Intents
// =============================================================================

describe('POST /rooms/:id/intents + approve/reject', () => {
  // No fake timers here — fake timers hang Fastify's async pipeline.

  it('proposes an intent in code mode and approves it manually', async () => {
    const { app } = await makeApp();
    const token = await login(app);
    const created = await app.inject({
      method: 'POST',
      url: '/rooms',
      headers: authHeaders(token),
      payload: { name: 'A', config: { defaultMode: 'code' } },
    });
    const id = created.json().room.id;

    const proposed = await app.inject({
      method: 'POST',
      url: `/rooms/${id}/intents`,
      headers: authHeaders(token),
      payload: {
        agentId: 'a-1',
        summary: 'edit a file',
        type: 'file_edit',
        action: {
          type: 'file_edit',
          path: 'src/a.ts',
          range: { startLine: 1, startColumn: 0, endLine: 2, endColumn: 0 },
          oldContent: 'a',
          newContent: 'b',
          diff: '',
        },
        rationale: 'fix bug',
        confidence: 0.9,
        risk: 'moderate',
      },
    });
    expect(proposed.statusCode).toBe(201);
    const intent = proposed.json().intent;
    expect(intent.status).toBe('pending');

    const approve = await app.inject({
      method: 'POST',
      url: `/rooms/${id}/intents/${intent.id}/approve`,
      headers: authHeaders(token),
    });
    expect(approve.statusCode).toBe(200);
    expect(approve.json().approval.status).toBe('approved');

    const list = await app.inject({
      method: 'GET',
      url: `/rooms/${id}/intents`,
      headers: authHeaders(token),
    });
    const found = list.json().intents.find((i: { id: string }) => i.id === intent.id);
    expect(found.status).toBe('approved');
    await app.close();
  });

  it('rejects an intent', async () => {
    const { app } = await makeApp();
    const token = await login(app);
    const created = await app.inject({
      method: 'POST',
      url: '/rooms',
      headers: authHeaders(token),
      payload: { name: 'A', config: { defaultMode: 'code' } },
    });
    const id = created.json().room.id;

    const proposed = await app.inject({
      method: 'POST',
      url: `/rooms/${id}/intents`,
      headers: authHeaders(token),
      payload: {
        agentId: 'a-1',
        summary: 'edit',
        type: 'file_edit',
        action: {
          type: 'file_edit',
          path: 'src/a.ts',
          range: { startLine: 1, startColumn: 0, endLine: 2, endColumn: 0 },
          oldContent: 'a',
          newContent: 'b',
          diff: '',
        },
        rationale: 'r',
        confidence: 0.5,
        risk: 'moderate',
      },
    });
    const iid = proposed.json().intent.id;

    const reject = await app.inject({
      method: 'POST',
      url: `/rooms/${id}/intents/${iid}/reject`,
      headers: authHeaders(token),
      payload: { reason: 'too risky' },
    });
    expect(reject.statusCode).toBe(200);
    expect(reject.json().approval.status).toBe('rejected');
    await app.close();
  });

  it('returns 400 for an intent payload missing fields', async () => {
    const { app } = await makeApp();
    const token = await login(app);
    const created = await app.inject({
      method: 'POST',
      url: '/rooms',
      headers: authHeaders(token),
      payload: { name: 'A' },
    });
    const id = created.json().room.id;
    const res = await app.inject({
      method: 'POST',
      url: `/rooms/${id}/intents`,
      headers: authHeaders(token),
      payload: { agentId: 'a-1' }, // missing the rest
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });
});

// =============================================================================
// Agents
// =============================================================================

describe('POST/GET/DELETE /rooms/:id/agents', () => {
  it('registers + lists + unregisters an agent', async () => {
    const { app } = await makeApp();
    const token = await login(app);
    const created = await app.inject({
      method: 'POST',
      url: '/rooms',
      headers: authHeaders(token),
      payload: { name: 'A' },
    });
    const id = created.json().room.id;

    const reg = await app.inject({
      method: 'POST',
      url: `/rooms/${id}/agents`,
      headers: authHeaders(token),
      payload: {
        agentId: 'agent-1',
        name: 'Coder',
        model: 'gpt-4o',
        provider: 'openai',
      },
    });
    expect(reg.statusCode).toBe(201);
    expect(reg.json().agent.id).toBe('agent-1');

    const list = await app.inject({
      method: 'GET',
      url: `/rooms/${id}/agents`,
      headers: authHeaders(token),
    });
    expect(list.json().agents).toHaveLength(1);

    const dup = await app.inject({
      method: 'POST',
      url: `/rooms/${id}/agents`,
      headers: authHeaders(token),
      payload: {
        agentId: 'agent-1',
        name: 'Coder',
        model: 'gpt-4o',
        provider: 'openai',
      },
    });
    expect(dup.statusCode).toBe(409);

    const del = await app.inject({
      method: 'DELETE',
      url: `/rooms/${id}/agents/agent-1`,
      headers: authHeaders(token),
    });
    expect(del.statusCode).toBe(204);
    await app.close();
  });
});
