import { describe, it, expect, beforeEach } from 'vitest';
import { CollabClient, CollabApiError } from '../lib/collab-client.js';

interface FakeFetchCall {
  url: string;
  init?: RequestInit;
}

function makeFakeFetch(handler: (call: FakeFetchCall) => Response): {
  fetch: typeof fetch;
  calls: FakeFetchCall[];
} {
  const calls: FakeFetchCall[] = [];
  const fakeFetch: typeof fetch = ((url: RequestInfo | URL, init?: RequestInit) => {
    const u = typeof url === 'string' ? url : url instanceof URL ? url.toString() : (url as Request).url;
    calls.push({ url: u, init });
    return Promise.resolve(handler({ url: u, init }));
  }) as typeof fetch;
  return { fetch: fakeFetch, calls };
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('CollabClient — login', () => {
  it('POSTs /auth/login without auth, then stores the token', async () => {
    const { fetch, calls } = makeFakeFetch(() =>
      jsonResponse(200, {
        token: 'tok-123',
        expiresAt: Date.now() / 1000 + 3600,
        participantId: 'alice',
      }),
    );
    const c = new CollabClient({ baseUrl: 'http://test.local', fetch });
    const r = await c.login({ participantId: 'alice' });

    expect(r.token).toBe('tok-123');
    expect(c.token).toBe('tok-123');
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('http://test.local/auth/login');
    expect(calls[0].init?.method).toBe('POST');
    // No Authorization header on login
    const h = calls[0].init?.headers as Record<string, string>;
    expect(h.authorization).toBeUndefined();
  });
});

describe('CollabClient — auth header', () => {
  it('attaches Bearer token on authenticated calls', async () => {
    const { fetch, calls } = makeFakeFetch(() =>
      jsonResponse(200, { rooms: [] }),
    );
    const c = new CollabClient({
      baseUrl: 'http://test.local',
      token: 'tok-1',
      fetch,
    });
    await c.listRooms();
    const h = calls[0].init?.headers as Record<string, string>;
    expect(h.authorization).toBe('Bearer tok-1');
  });

  it('throws CollabApiError when no token set on auth-required call', async () => {
    const { fetch } = makeFakeFetch(() => jsonResponse(200, {}));
    const c = new CollabClient({ baseUrl: 'http://test.local', fetch });
    await expect(c.listRooms()).rejects.toThrow(CollabApiError);
  });

  it('honors trailing-slash stripping on baseUrl', async () => {
    const { fetch, calls } = makeFakeFetch(() => jsonResponse(200, { rooms: [] }));
    const c = new CollabClient({
      baseUrl: 'http://test.local/',
      token: 't',
      fetch,
    });
    await c.listRooms();
    expect(calls[0].url).toBe('http://test.local/rooms');
  });
});

describe('CollabClient — rooms', () => {
  it('createRoom returns room from { room }', async () => {
    const { fetch, calls } = makeFakeFetch(() =>
      jsonResponse(201, {
        room: {
          id: 'r-1',
          name: 'A',
          slug: 'a',
          status: 'active',
          ownerId: 'alice',
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
          config: {
            visibility: 'private',
            defaultMode: 'plan',
            aiEnabled: true,
            maxAgents: 3,
          },
        },
      }),
    );
    const c = new CollabClient({
      baseUrl: 'http://test.local',
      token: 't',
      fetch,
    });
    const room = await c.createRoom({ name: 'A' });
    expect(room.id).toBe('r-1');
    expect(JSON.parse(calls[0].init?.body as string)).toEqual({ name: 'A' });
  });

  it('listRooms unwraps the rooms array', async () => {
    const { fetch } = makeFakeFetch(() =>
      jsonResponse(200, { rooms: [{ id: 'r-1', name: 'A' }] }),
    );
    const c = new CollabClient({
      baseUrl: 'http://test.local',
      token: 't',
      fetch,
    });
    const list = await c.listRooms();
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe('r-1');
  });

  it('deleteRoom handles 204 No Content', async () => {
    const { fetch } = makeFakeFetch(() => new Response(null, { status: 204 }));
    const c = new CollabClient({
      baseUrl: 'http://test.local',
      token: 't',
      fetch,
    });
    await expect(c.deleteRoom('r-1')).resolves.toBeUndefined();
  });
});

describe('CollabClient — error handling', () => {
  it('throws CollabApiError with structured body for non-2xx responses', async () => {
    const { fetch } = makeFakeFetch(() =>
      jsonResponse(403, { error: { code: 'FORBIDDEN', message: 'nope' } }),
    );
    const c = new CollabClient({
      baseUrl: 'http://test.local',
      token: 't',
      fetch,
    });
    let captured: CollabApiError | undefined;
    try {
      await c.deleteRoom('r-1');
    } catch (err) {
      captured = err as CollabApiError;
    }
    expect(captured).toBeInstanceOf(CollabApiError);
    expect(captured?.status).toBe(403);
    expect(captured?.code).toBe('FORBIDDEN');
    expect(captured?.message).toBe('nope');
  });

  it('falls back to status code when body has no structured error', async () => {
    const { fetch } = makeFakeFetch(
      () => new Response('boom', { status: 500 }),
    );
    const c = new CollabClient({
      baseUrl: 'http://test.local',
      token: 't',
      fetch,
    });
    let captured: CollabApiError | undefined;
    try {
      await c.listRooms();
    } catch (err) {
      captured = err as CollabApiError;
    }
    expect(captured?.status).toBe(500);
    expect(captured?.code).toBe('HTTP_500');
  });
});

describe('CollabClient — intents + mode + agents', () => {
  it('listIntents passes the status filter', async () => {
    const { fetch, calls } = makeFakeFetch(() =>
      jsonResponse(200, { intents: [] }),
    );
    const c = new CollabClient({
      baseUrl: 'http://test.local',
      token: 't',
      fetch,
    });
    await c.listIntents('r-1', { status: 'pending' });
    expect(calls[0].url).toContain('?status=pending');
  });

  it('approve/reject intent send POST with optional body', async () => {
    const { fetch, calls } = makeFakeFetch(() => jsonResponse(200, {}));
    const c = new CollabClient({
      baseUrl: 'http://test.local',
      token: 't',
      fetch,
    });
    await c.approveIntent('r-1', 'i-1', 'alice');
    expect(JSON.parse(calls[0].init?.body as string)).toEqual({
      approver: 'alice',
    });
    await c.rejectIntent('r-1', 'i-1', 'too risky');
    expect(JSON.parse(calls[1].init?.body as string)).toEqual({
      reason: 'too risky',
    });
  });

  it('setMode posts the mode value', async () => {
    const { fetch, calls } = makeFakeFetch(() =>
      jsonResponse(200, { mode: 'code' }),
    );
    const c = new CollabClient({
      baseUrl: 'http://test.local',
      token: 't',
      fetch,
    });
    await c.setMode('r-1', 'code');
    expect(JSON.parse(calls[0].init?.body as string)).toEqual({ mode: 'code' });
  });

  it('agents: register/list/unregister', async () => {
    const { fetch, calls } = makeFakeFetch(call => {
      if (call.init?.method === 'GET') {
        return jsonResponse(200, { agents: [{ id: 'a-1' }] });
      }
      if (call.init?.method === 'DELETE') {
        return new Response(null, { status: 204 });
      }
      return jsonResponse(201, { agent: { id: 'a-1', name: 'X', model: 'm', provider: 'p' } });
    });
    const c = new CollabClient({
      baseUrl: 'http://test.local',
      token: 't',
      fetch,
    });
    const reg = await c.registerAgent('r-1', {
      agentId: 'a-1',
      name: 'X',
      model: 'm',
      provider: 'p',
    });
    expect(reg.id).toBe('a-1');

    const list = await c.listAgents('r-1');
    expect(list).toHaveLength(1);

    await expect(c.unregisterAgent('r-1', 'a-1')).resolves.toBeUndefined();
    expect(calls[2].init?.method).toBe('DELETE');
  });
});
