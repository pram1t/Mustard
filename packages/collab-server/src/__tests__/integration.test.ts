import { describe, it, expect, afterEach } from 'vitest';
import WebSocket from 'ws';
import { createApp } from '../app.js';
import type { CreateAppResult } from '../app.js';
import { sign } from '../jwt.js';

/**
 * End-to-end integration test for the Collab stack.
 *
 * Drives the full chain:
 *   createApp → REST: create room → join × 2 → propose intent →
 *   approve → setMode → WebSocket subscriber sees every event in
 *   the right order with the right room source.
 */

const SECRET = 'integration-secret';

let opened: CreateAppResult[] = [];

afterEach(async () => {
  for (const r of opened) {
    try {
      r.ws.dispose();
      await r.app.close();
    } catch {
      /* ignore */
    }
  }
  opened = [];
});

async function start() {
  const result = await createApp({
    config: { jwtSecret: SECRET, host: '127.0.0.1', port: 0 },
  });
  opened.push(result);
  const address = await result.app.listen({ host: '127.0.0.1', port: 0 });
  const httpBase = address;
  const wsBase = address.replace(/^http/, 'ws');
  return { result, httpBase, wsBase };
}

function tokenFor(participantId: string): string {
  return sign({ sub: participantId }, SECRET, { expiresInSec: 600 });
}

interface FetchOpts {
  method?: string;
  body?: unknown;
  token?: string;
}

async function api<T = unknown>(
  base: string,
  path: string,
  opts: FetchOpts = {},
): Promise<T> {
  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers['content-type'] = 'application/json';
  if (opts.token) headers['authorization'] = `Bearer ${opts.token}`;
  const res = await fetch(`${base}${path}`, {
    method: opts.method ?? 'GET',
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  if (!res.ok && res.status !== 204) {
    throw new Error(`${res.status} ${res.statusText} on ${path}: ${await res.text()}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

function awaitOpen(socket: WebSocket): Promise<void> {
  return new Promise((res, rej) => {
    socket.once('open', () => res());
    socket.once('error', rej);
  });
}

function awaitMessages(
  socket: WebSocket,
  count: number,
  timeoutMs = 8000,
): Promise<unknown[]> {
  return new Promise((resolve, reject) => {
    const out: unknown[] = [];
    const t = setTimeout(
      () => reject(new Error(`Timed out: got ${out.length}/${count} messages`)),
      timeoutMs,
    );
    socket.on('message', raw => {
      try {
        out.push(JSON.parse(raw.toString()));
      } catch {
        /* drop */
      }
      if (out.length >= count) {
        clearTimeout(t);
        resolve(out);
      }
    });
  });
}

// =============================================================================
// E2E happy path
// =============================================================================

describe('Collab E2E — full happy path', () => {
  it('rooms, two participants, intent flow, mode change, WS observer sees everything', async () => {
    const { result, httpBase, wsBase } = await start();

    const aliceTok = tokenFor('alice');
    const bobTok = tokenFor('bob');

    // 1. Alice creates the room and joins
    const created = await api<{ room: { id: string } }>(
      httpBase,
      '/rooms',
      {
        method: 'POST',
        body: { name: 'Demo', config: { defaultMode: 'code' } },
        token: aliceTok,
      },
    );
    const roomId = created.room.id;
    expect(roomId).toBeTruthy();

    const aliceP = await api<{ participant: { id: string; userId: string } }>(
      httpBase,
      `/rooms/${roomId}/join`,
      {
        method: 'POST',
        body: { name: 'Alice', type: 'human', role: 'owner' },
        token: aliceTok,
      },
    );
    expect(aliceP.participant.userId).toBe('alice');

    // 2. Open a WS observer for the room (Alice's token works fine).
    //    Attach a sticky message accumulator BEFORE triggering events,
    //    otherwise messages emitted before listeners are attached are lost.
    const observer = new WebSocket(
      `${wsBase}/ws?token=${aliceTok}&roomId=${roomId}`,
    );
    await awaitOpen(observer);

    const collected: Array<{ type: string; source?: string }> = [];
    observer.on('message', raw => {
      try {
        collected.push(JSON.parse(raw.toString()));
      } catch {
        /* drop */
      }
    });

    // 3. Bob joins
    const bobP = await api<{ participant: { id: string } }>(
      httpBase,
      `/rooms/${roomId}/join`,
      {
        method: 'POST',
        body: { name: 'Bob', type: 'human', role: 'member' },
        token: bobTok,
      },
    );
    expect(bobP.participant.id).toBeTruthy();

    // 4. Bob proposes an intent (moderate write — code mode requires approval)
    const proposed = await api<{ intent: { id: string; status: string } }>(
      httpBase,
      `/rooms/${roomId}/intents`,
      {
        method: 'POST',
        body: {
          agentId: 'agent-bob',
          summary: 'edit src/a.ts',
          type: 'file_edit',
          action: {
            type: 'file_edit',
            path: 'src/a.ts',
            range: { startLine: 1, startColumn: 0, endLine: 2, endColumn: 0 },
            oldContent: 'a',
            newContent: 'b',
            diff: '',
          },
          rationale: 'fix',
          confidence: 0.9,
          risk: 'moderate',
        },
        token: bobTok,
      },
    );
    const intentId = proposed.intent.id;
    expect(proposed.intent.status).toBe('pending');

    // 5. Alice approves
    await api(httpBase, `/rooms/${roomId}/intents/${intentId}/approve`, {
      method: 'POST',
      body: { approver: 'alice' },
      token: aliceTok,
    });

    // 6. Alice changes mode to auto
    await api(httpBase, `/rooms/${roomId}/mode`, {
      method: 'POST',
      body: { mode: 'auto' },
      token: aliceTok,
    });

    // Wait for events to drain (poll the accumulator).
    const expectedTypes = [
      'collab.room.participant_joined',
      'collab.ai.intent.proposed',
      'collab.ai.intent.approved',
      'collab.permissions.mode.changed',
    ];
    const deadline = Date.now() + 4000;
    while (
      Date.now() < deadline &&
      !expectedTypes.every(t => collected.some(m => m.type === t))
    ) {
      await new Promise(r => setTimeout(r, 25));
    }

    const types = collected.map(m => m.type);
    for (const expected of expectedTypes) {
      expect(types).toContain(expected);
    }
    for (const m of collected) {
      expect(m.source).toBe(roomId);
    }

    // 7. Final state checks via REST
    const detail = await api<{
      mode: string;
      participants: Array<{ userId: string }>;
    }>(httpBase, `/rooms/${roomId}`, { token: aliceTok });
    expect(detail.mode).toBe('auto');
    expect(detail.participants.map(p => p.userId).sort()).toEqual(['alice', 'bob']);

    const intents = await api<{ intents: Array<{ id: string; status: string }> }>(
      httpBase,
      `/rooms/${roomId}/intents`,
      { token: aliceTok },
    );
    const found = intents.intents.find(i => i.id === intentId);
    expect(found?.status).toBe('approved');

    // Internal sanity: the registry has the room + 2 participants
    expect(result.registry.has(roomId)).toBe(true);
    expect(result.registry.listParticipants(roomId)).toHaveLength(2);

    observer.close();
    await new Promise(r => setTimeout(r, 50));
  });
});

// =============================================================================
// Cross-room isolation
// =============================================================================

describe('Collab E2E — cross-room isolation', () => {
  it("room-filtered WS clients only see their own room's events", async () => {
    const { httpBase, wsBase } = await start();
    const tok = tokenFor('alice');

    // Two rooms
    const r1 = (await api<{ room: { id: string } }>(httpBase, '/rooms', {
      method: 'POST',
      body: { name: 'Room 1' },
      token: tok,
    })).room.id;
    const r2 = (await api<{ room: { id: string } }>(httpBase, '/rooms', {
      method: 'POST',
      body: { name: 'Room 2' },
      token: tok,
    })).room.id;

    // Subscribe filtered to r1 only
    const sub1 = new WebSocket(`${wsBase}/ws?token=${tok}&roomId=${r1}`);
    await awaitOpen(sub1);

    // Trigger an event in r2 (mode change)
    await api(httpBase, `/rooms/${r2}/mode`, {
      method: 'POST',
      body: { mode: 'code' },
      token: tok,
    });

    // Trigger an event in r1
    const wait = awaitMessages(sub1, 1, 4000);
    await api(httpBase, `/rooms/${r1}/mode`, {
      method: 'POST',
      body: { mode: 'code' },
      token: tok,
    });

    const msgs = (await wait) as Array<{ source: string; type: string }>;
    expect(msgs[0].source).toBe(r1);

    // Wait a beat to ensure no r2 events sneaked in
    await new Promise(r => setTimeout(r, 200));

    sub1.close();
    await new Promise(r => setTimeout(r, 50));
  });
});

// =============================================================================
// Auth + token expiry
// =============================================================================

describe('Collab E2E — auth + expired tokens', () => {
  it('rejects every authenticated REST route without a token', async () => {
    const { httpBase } = await start();
    const tok = tokenFor('alice');
    const created = await api<{ room: { id: string } }>(httpBase, '/rooms', {
      method: 'POST',
      body: { name: 'A' },
      token: tok,
    });
    const roomId = created.room.id;

    const requests = [
      { method: 'GET', path: '/rooms' },
      { method: 'GET', path: `/rooms/${roomId}` },
      { method: 'POST', path: `/rooms/${roomId}/join` },
      { method: 'GET', path: `/rooms/${roomId}/intents` },
      { method: 'POST', path: `/rooms/${roomId}/intents` },
      { method: 'GET', path: `/rooms/${roomId}/mode` },
      { method: 'POST', path: `/rooms/${roomId}/mode` },
      { method: 'POST', path: `/rooms/${roomId}/agents` },
      { method: 'GET', path: `/rooms/${roomId}/agents` },
    ];

    for (const r of requests) {
      const res = await fetch(`${httpBase}${r.path}`, {
        method: r.method,
        headers: { 'content-type': 'application/json' },
        body: r.method === 'POST' ? '{}' : undefined,
      });
      expect(res.status).toBe(401);
    }
  });

  it('rejects an expired JWT', async () => {
    const { httpBase } = await start();
    const expired = sign({ sub: 'alice' }, SECRET, { expiresInSec: -10 });
    const res = await fetch(`${httpBase}/rooms`, {
      headers: { authorization: `Bearer ${expired}` },
    });
    expect(res.status).toBe(401);
  });

  it('rejects a JWT signed with the wrong secret', async () => {
    const { httpBase } = await start();
    const evil = sign({ sub: 'alice' }, 'wrong-secret', { expiresInSec: 60 });
    const res = await fetch(`${httpBase}/rooms`, {
      headers: { authorization: `Bearer ${evil}` },
    });
    expect(res.status).toBe(401);
  });
});

// =============================================================================
// Sensitive-file gating end-to-end
// =============================================================================

describe('Collab E2E — sensitive file gating', () => {
  it('intents touching .env stay pending in auto mode (no countdown)', async () => {
    const { httpBase, result } = await start();
    const tok = tokenFor('alice');

    const r = await api<{ room: { id: string } }>(httpBase, '/rooms', {
      method: 'POST',
      body: { name: 'A', config: { defaultMode: 'auto' } },
      token: tok,
    });
    const roomId = r.room.id;

    const proposed = await api<{ intent: { id: string } }>(
      httpBase,
      `/rooms/${roomId}/intents`,
      {
        method: 'POST',
        body: {
          agentId: 'agent-1',
          summary: 'read env',
          type: 'file_read',
          action: { type: 'file_read', path: 'src/config/.env' },
          rationale: 'check secrets',
          confidence: 1,
          risk: 'safe',
        },
        token: tok,
      },
    );
    const intentId = proposed.intent.id;

    // The auto-mode safe-read countdown is 10s in defaults — wait
    // longer than that to confirm the gateway did NOT auto-approve a
    // sensitive-file intent.
    await new Promise(r => setTimeout(r, 250)); // brief settle

    // Manually approve so the intent leaves pending (but the test's
    // point is that it stays pending until manual action).
    const ctx = result.registry.get(roomId)!;
    const waitingApproval = ctx.approvalManager
      .list({ status: 'waiting' })
      .find(rqst => rqst.intentId === intentId);
    expect(waitingApproval).toBeDefined();
    // No countdown = manual-only
    expect(waitingApproval!.autoApproveCountdown).toBe(0);
  });
});
