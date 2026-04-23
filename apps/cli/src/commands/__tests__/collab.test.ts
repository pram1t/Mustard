import { describe, it, expect, beforeEach, vi } from 'vitest';
import { collabCommand, parseCollabArgv } from '../collab.js';
import {
  setCachedToken,
  getCachedToken,
  TOKEN_FILE_PATH,
} from '../../lib/collab-client.js';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomBytes } from 'node:crypto';

// Helper: capture writer outputs
function recorder() {
  const out: string[] = [];
  const err: string[] = [];
  return {
    out,
    err,
    write: (s: string) => out.push(s),
    writeErr: (s: string) => err.push(s),
  };
}

// Capture every fetch request the command issues + reply with what
// we want.
function withFetch(handler: (url: string, init?: RequestInit) => Response) {
  const original = globalThis.fetch;
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  (globalThis as { fetch: typeof fetch }).fetch = ((
    url: RequestInfo | URL,
    init?: RequestInit,
  ) => {
    const u =
      typeof url === 'string'
        ? url
        : url instanceof URL
        ? url.toString()
        : (url as Request).url;
    calls.push({ url: u, init });
    return Promise.resolve(handler(u, init));
  }) as typeof fetch;
  return {
    calls,
    restore: () =>
      ((globalThis as { fetch: typeof fetch }).fetch = original),
  };
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

// Use a unique participantId per test to avoid colliding with a real
// developer's ~/.openagent/collab/tokens.json. The cache file is at a
// fixed path (TOKEN_FILE_PATH); we clean up our entries in afterEach.
function uniqueParticipant(): string {
  return `cli-test-${randomBytes(4).toString('hex')}`;
}

describe('collab login', () => {
  it('caches a token and prints success', async () => {
    const r = recorder();
    const participantId = uniqueParticipant();
    const future = Math.floor(Date.now() / 1000) + 600;
    const f = withFetch((url, init) => {
      if (url.endsWith('/auth/login') && init?.method === 'POST') {
        return jsonResponse(200, {
          token: 'TKN',
          expiresAt: future,
          participantId,
        });
      }
      return jsonResponse(404, { error: { code: 'NF', message: 'no' } });
    });

    try {
      const code = await collabCommand({
        subcommand: ['login'],
        args: [],
        flags: { base: 'http://test.local', as: participantId },
        out: r.write,
        err: r.writeErr,
      });
      expect(code).toBe(0);
      expect(r.out.join('\n')).toMatch(/Logged in as cli-test-/);
      const cached = await getCachedToken(participantId);
      expect(cached?.token).toBe('TKN');
    } finally {
      f.restore();
      // cleanup
      try {
        const raw = await fs.readFile(TOKEN_FILE_PATH, 'utf8');
        const store = JSON.parse(raw);
        delete store.tokens[participantId];
        await fs.writeFile(TOKEN_FILE_PATH, JSON.stringify(store));
      } catch {
        /* ignore */
      }
    }
  });
});

describe('collab room', () => {
  it('list (--json) prints rooms array', async () => {
    const r = recorder();
    const participantId = uniqueParticipant();
    const future = Math.floor(Date.now() / 1000) + 600;
    await setCachedToken({
      participantId,
      token: 'CACHED',
      expiresAt: future,
      baseUrl: 'http://test.local',
    });
    const f = withFetch((url, init) => {
      if (url.endsWith('/rooms') && init?.method === 'GET') {
        return jsonResponse(200, {
          rooms: [
            {
              id: 'r-1',
              name: 'A',
              slug: 'a',
              status: 'active',
              ownerId: 'u',
              createdAt: 'x',
              updatedAt: 'x',
              config: {
                visibility: 'private',
                defaultMode: 'plan',
                aiEnabled: true,
                maxAgents: 3,
              },
            },
          ],
        });
      }
      return jsonResponse(404, { error: { code: 'NF', message: 'no' } });
    });
    try {
      const code = await collabCommand({
        subcommand: ['room', 'list'],
        args: [],
        flags: {
          base: 'http://test.local',
          as: participantId,
          json: true,
        },
        out: r.write,
        err: r.writeErr,
      });
      expect(code).toBe(0);
      const out = JSON.parse(r.out.join(''));
      expect(out).toHaveLength(1);
      expect(out[0].id).toBe('r-1');
    } finally {
      f.restore();
      try {
        const raw = await fs.readFile(TOKEN_FILE_PATH, 'utf8');
        const store = JSON.parse(raw);
        delete store.tokens[participantId];
        await fs.writeFile(TOKEN_FILE_PATH, JSON.stringify(store));
      } catch {
        /* ignore */
      }
    }
  });

  it('create requires a name', async () => {
    const r = recorder();
    const participantId = uniqueParticipant();
    const future = Math.floor(Date.now() / 1000) + 600;
    await setCachedToken({
      participantId,
      token: 'CACHED',
      expiresAt: future,
      baseUrl: 'http://test.local',
    });

    const code = await collabCommand({
      subcommand: ['room', 'create'],
      args: [],
      flags: { base: 'http://test.local', as: participantId },
      out: r.write,
      err: r.writeErr,
    });
    expect(code).toBe(2);
    expect(r.err.join('\n')).toMatch(/usage:/);
  });

  it('create posts to /rooms with the supplied name', async () => {
    const r = recorder();
    const participantId = uniqueParticipant();
    const future = Math.floor(Date.now() / 1000) + 600;
    await setCachedToken({
      participantId,
      token: 'CACHED',
      expiresAt: future,
      baseUrl: 'http://test.local',
    });
    const f = withFetch((url, init) => {
      if (url.endsWith('/rooms') && init?.method === 'POST') {
        const body = JSON.parse(String(init.body));
        return jsonResponse(201, {
          room: {
            id: 'r-new',
            name: body.name,
            slug: 'r-new',
            status: 'active',
            ownerId: participantId,
            createdAt: 'x',
            updatedAt: 'x',
            config: {
              visibility: 'private',
              defaultMode: 'plan',
              aiEnabled: true,
              maxAgents: 3,
            },
          },
        });
      }
      return jsonResponse(404, { error: { code: 'NF', message: 'no' } });
    });
    try {
      const code = await collabCommand({
        subcommand: ['room', 'create'],
        args: ['My Room'],
        flags: { base: 'http://test.local', as: participantId, json: true },
        out: r.write,
        err: r.writeErr,
      });
      expect(code).toBe(0);
      const created = JSON.parse(r.out.join(''));
      expect(created.id).toBe('r-new');
      expect(created.name).toBe('My Room');
      expect(f.calls).toHaveLength(1);
    } finally {
      f.restore();
    }
  });
});

describe('collab mode', () => {
  it('rejects an invalid mode value', async () => {
    const r = recorder();
    const participantId = uniqueParticipant();
    const future = Math.floor(Date.now() / 1000) + 600;
    await setCachedToken({
      participantId,
      token: 'CACHED',
      expiresAt: future,
      baseUrl: 'http://test.local',
    });

    const code = await collabCommand({
      subcommand: ['mode', 'set'],
      args: ['r-1', 'wrong'],
      flags: { base: 'http://test.local', as: participantId },
      out: r.write,
      err: r.writeErr,
    });
    expect(code).toBe(2);
    expect(r.err.join('\n')).toMatch(/invalid mode/);
  });

  it('set issues POST /rooms/:id/mode', async () => {
    const r = recorder();
    const participantId = uniqueParticipant();
    const future = Math.floor(Date.now() / 1000) + 600;
    await setCachedToken({
      participantId,
      token: 'CACHED',
      expiresAt: future,
      baseUrl: 'http://test.local',
    });

    let bodySeen = '';
    const f = withFetch((url, init) => {
      if (url.endsWith('/rooms/r-1/mode') && init?.method === 'POST') {
        bodySeen = String(init.body);
        return jsonResponse(200, { mode: 'code' });
      }
      return jsonResponse(404, { error: { code: 'NF', message: 'no' } });
    });
    try {
      const code = await collabCommand({
        subcommand: ['mode', 'set'],
        args: ['r-1', 'code'],
        flags: { base: 'http://test.local', as: participantId },
        out: r.write,
        err: r.writeErr,
      });
      expect(code).toBe(0);
      expect(JSON.parse(bodySeen)).toEqual({ mode: 'code' });
    } finally {
      f.restore();
    }
  });
});

describe('collab error mapping', () => {
  it('returns exit 1 + prints CollabApiError fields on server errors', async () => {
    const r = recorder();
    const participantId = uniqueParticipant();
    const future = Math.floor(Date.now() / 1000) + 600;
    await setCachedToken({
      participantId,
      token: 'CACHED',
      expiresAt: future,
      baseUrl: 'http://test.local',
    });

    const f = withFetch(() =>
      jsonResponse(403, { error: { code: 'FORBIDDEN', message: 'nope' } }),
    );
    try {
      const code = await collabCommand({
        subcommand: ['room', 'delete'],
        args: ['r-1'],
        flags: { base: 'http://test.local', as: participantId },
        out: r.write,
        err: r.writeErr,
      });
      expect(code).toBe(1);
      expect(r.err.join('\n')).toMatch(/FORBIDDEN.*403.*nope/);
    } finally {
      f.restore();
    }
  });
});

describe('parseCollabArgv', () => {
  it('recognizes two-word subcommands', () => {
    expect(parseCollabArgv(['room', 'create', 'A'])).toEqual({
      subcommand: ['room', 'create'],
      args: ['A'],
      flags: {},
    });
    expect(parseCollabArgv(['mode', 'set', 'r-1', 'code'])).toEqual({
      subcommand: ['mode', 'set'],
      args: ['r-1', 'code'],
      flags: {},
    });
  });

  it('recognizes one-word subcommands', () => {
    expect(parseCollabArgv(['login'])).toEqual({
      subcommand: ['login'],
      args: [],
      flags: {},
    });
    expect(parseCollabArgv(['tail', 'r-1'])).toEqual({
      subcommand: ['tail'],
      args: ['r-1'],
      flags: {},
    });
  });

  it('parses --flag VALUE and --flag=VALUE forms', () => {
    expect(
      parseCollabArgv(['room', 'list', '--base', 'http://x', '--json']),
    ).toEqual({
      subcommand: ['room', 'list'],
      args: [],
      flags: { base: 'http://x', json: true },
    });
    expect(
      parseCollabArgv(['room', 'list', '--base=http://y', '--as=alice']),
    ).toEqual({
      subcommand: ['room', 'list'],
      args: [],
      flags: { base: 'http://y', as: 'alice' },
    });
  });

  it('handles empty argv as empty subcommand', () => {
    expect(parseCollabArgv([])).toEqual({
      subcommand: [],
      args: [],
      flags: {},
    });
  });
});

describe('collab help', () => {
  it('prints usage on empty subcommand', async () => {
    const r = recorder();
    const code = await collabCommand({
      subcommand: [],
      args: [],
      flags: {},
      out: r.write,
      err: r.writeErr,
    });
    expect(code).toBe(0);
    expect(r.out.join('\n')).toMatch(/usage: openagent collab/);
  });

  it('returns exit 2 on unknown subcommand', async () => {
    const r = recorder();
    const code = await collabCommand({
      subcommand: ['nope'],
      args: [],
      flags: {},
      out: r.write,
      err: r.writeErr,
    });
    expect(code).toBe(2);
  });
});
