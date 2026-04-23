import { describe, it, expect, beforeEach } from 'vitest';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import {
  CollabClient,
  CollabApiError,
  loadTokenStore,
  saveTokenStore,
  getCachedToken,
  setCachedToken,
  clearCachedToken,
  getAuthenticatedClient,
} from '../lib/collab-client.js';

// ============================================================================
// Helpers
// ============================================================================

interface FakeCall {
  url: string;
  init?: RequestInit;
}

function fakeFetch(handler: (call: FakeCall) => Response): {
  fetch: typeof fetch;
  calls: FakeCall[];
} {
  const calls: FakeCall[] = [];
  const f: typeof fetch = ((url: RequestInfo | URL, init?: RequestInit) => {
    const u =
      typeof url === 'string'
        ? url
        : url instanceof URL
        ? url.toString()
        : (url as Request).url;
    calls.push({ url: u, init });
    return Promise.resolve(handler({ url: u, init }));
  }) as typeof fetch;
  return { fetch: f, calls };
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function tmpTokenFile(): string {
  return path.join(
    tmpdir(),
    `oa-collab-tokens-${randomBytes(6).toString('hex')}.json`,
  );
}

// ============================================================================
// Token store
// ============================================================================

describe('Token store', () => {
  let file: string;
  beforeEach(() => {
    file = tmpTokenFile();
  });

  it('loadTokenStore returns empty store when file missing', async () => {
    const s = await loadTokenStore(file);
    expect(s).toEqual({ tokens: {} });
  });

  it('save + load roundtrip', async () => {
    await saveTokenStore(
      {
        tokens: {
          alice: {
            token: 't',
            expiresAt: 999,
            baseUrl: 'http://x',
            participantId: 'alice',
          },
        },
      },
      file,
    );
    const s = await loadTokenStore(file);
    expect(s.tokens.alice.token).toBe('t');
  });

  it('getCachedToken returns null for missing or expired tokens', async () => {
    await saveTokenStore(
      {
        tokens: {
          alice: {
            token: 't',
            expiresAt: 1, // long past
            baseUrl: 'http://x',
            participantId: 'alice',
          },
        },
      },
      file,
    );
    expect(await getCachedToken('alice', file)).toBeNull();
    expect(await getCachedToken('bob', file)).toBeNull();
  });

  it('getCachedToken returns valid (future-expiry) tokens', async () => {
    const future = Math.floor(Date.now() / 1000) + 600;
    await setCachedToken(
      { token: 't', expiresAt: future, baseUrl: 'http://x', participantId: 'alice' },
      file,
    );
    const got = await getCachedToken('alice', file);
    expect(got?.token).toBe('t');
  });

  it('clearCachedToken removes a single entry', async () => {
    const future = Math.floor(Date.now() / 1000) + 600;
    await setCachedToken(
      { token: 'a', expiresAt: future, baseUrl: 'x', participantId: 'alice' },
      file,
    );
    await setCachedToken(
      { token: 'b', expiresAt: future, baseUrl: 'x', participantId: 'bob' },
      file,
    );
    await clearCachedToken('alice', file);
    expect(await getCachedToken('alice', file)).toBeNull();
    expect(await getCachedToken('bob', file)).not.toBeNull();
  });

  it('loadTokenStore tolerates malformed JSON', async () => {
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, 'not json', 'utf8');
    const s = await loadTokenStore(file);
    expect(s).toEqual({ tokens: {} });
  });
});

// ============================================================================
// Client (smoke — full coverage in apps/web tests)
// ============================================================================

describe('CollabClient', () => {
  it('attaches Bearer token on authenticated calls', async () => {
    const { fetch, calls } = fakeFetch(() => jsonResponse(200, { rooms: [] }));
    const c = new CollabClient({
      baseUrl: 'http://test.local',
      token: 't',
      fetch,
    });
    await c.listRooms();
    const h = calls[0].init?.headers as Record<string, string>;
    expect(h.authorization).toBe('Bearer t');
  });

  it('throws CollabApiError on non-2xx', async () => {
    const { fetch } = fakeFetch(() =>
      jsonResponse(403, { error: { code: 'FORBIDDEN', message: 'no' } }),
    );
    const c = new CollabClient({
      baseUrl: 'http://test.local',
      token: 't',
      fetch,
    });
    await expect(c.deleteRoom('r')).rejects.toMatchObject({
      status: 403,
      code: 'FORBIDDEN',
    });
  });

  it('login sets the token', async () => {
    const { fetch } = fakeFetch(() =>
      jsonResponse(200, {
        token: 'NEW',
        expiresAt: Math.floor(Date.now() / 1000) + 600,
        participantId: 'alice',
      }),
    );
    const c = new CollabClient({ baseUrl: 'http://t', fetch });
    await c.login({ participantId: 'alice' });
    expect(c.token).toBe('NEW');
  });
});

// ============================================================================
// getAuthenticatedClient
// ============================================================================

describe('getAuthenticatedClient', () => {
  let file: string;
  beforeEach(() => {
    file = tmpTokenFile();
  });

  it('reuses a cached, valid token without hitting /auth/login', async () => {
    const future = Math.floor(Date.now() / 1000) + 600;
    await setCachedToken(
      {
        token: 'CACHED',
        expiresAt: future,
        baseUrl: 'http://test.local',
        participantId: 'alice',
      },
      file,
    );

    const client = await getAuthenticatedClient('http://test.local', 'alice', {
      tokenFile: file,
    });
    expect(client.token).toBe('CACHED');
  });

  it('logs in + persists when no cached token', async () => {
    // Inject our own fetch via a fresh client wired directly. The
    // helper uses globalThis.fetch internally; for test isolation we
    // monkey-patch globalThis.fetch.
    const newToken = {
      token: 'FRESH',
      expiresAt: Math.floor(Date.now() / 1000) + 600,
      participantId: 'alice',
    };
    const original = globalThis.fetch;
    (globalThis as { fetch: typeof fetch }).fetch = (async () =>
      jsonResponse(200, newToken)) as typeof fetch;
    try {
      const client = await getAuthenticatedClient(
        'http://test.local',
        'alice',
        { tokenFile: file },
      );
      expect(client.token).toBe('FRESH');
      const cached = await getCachedToken('alice', file);
      expect(cached?.token).toBe('FRESH');
    } finally {
      (globalThis as { fetch: typeof fetch }).fetch = original;
    }
  });
});
