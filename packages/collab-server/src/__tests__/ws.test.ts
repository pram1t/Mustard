import { describe, it, expect, afterEach } from 'vitest';
import WebSocket from 'ws';
import { createApp } from '../app.js';
import type { CreateAppResult } from '../app.js';
import { sign } from '../jwt.js';

const SECRET = 'test-secret-change-me';

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

async function start(): Promise<{ result: CreateAppResult; baseUrl: string }> {
  const result = await createApp({
    config: { jwtSecret: SECRET, port: 0, host: '127.0.0.1' },
  });
  opened.push(result);
  const address = await result.app.listen({ host: '127.0.0.1', port: 0 });
  // address is `http://host:port`
  const baseUrl = address.replace(/^http/, 'ws');
  return { result, baseUrl };
}

function tokenFor(participantId: string, secret = SECRET): string {
  return sign({ sub: participantId }, secret, { expiresInSec: 120 });
}

function awaitMessages(
  socket: WebSocket,
  count: number,
  timeoutMs = 4000,
): Promise<unknown[]> {
  return new Promise((resolve, reject) => {
    const out: unknown[] = [];
    const timer = setTimeout(
      () => reject(new Error(`Timed out waiting for ${count} messages, got ${out.length}`)),
      timeoutMs,
    );
    socket.on('message', raw => {
      try {
        out.push(JSON.parse(raw.toString()));
      } catch {
        out.push(raw.toString());
      }
      if (out.length >= count) {
        clearTimeout(timer);
        resolve(out);
      }
    });
  });
}

function awaitClose(socket: WebSocket): Promise<{ code: number; reason: string }> {
  return new Promise(resolve => {
    socket.on('close', (code, reason) => {
      resolve({ code, reason: reason.toString() });
    });
  });
}

function awaitOpen(socket: WebSocket): Promise<void> {
  return new Promise((resolve, reject) => {
    socket.once('open', () => resolve());
    socket.once('error', reject);
  });
}

describe('WebSocket /ws — auth', () => {
  it('rejects connections without a token', async () => {
    const { baseUrl } = await start();
    const socket = new WebSocket(`${baseUrl}/ws`);
    const closed = await awaitClose(socket);
    expect(closed.code).toBe(1008);
  });

  it('rejects connections with a bad token', async () => {
    const { baseUrl } = await start();
    const socket = new WebSocket(`${baseUrl}/ws?token=garbage`);
    const closed = await awaitClose(socket);
    expect(closed.code).toBe(1008);
  });

  it('accepts a valid token', async () => {
    const { baseUrl, result } = await start();
    const token = tokenFor('alice');
    const socket = new WebSocket(`${baseUrl}/ws?token=${token}`);
    await awaitOpen(socket);
    expect(result.ws.clients.size).toBe(1);
    socket.close();
    await awaitClose(socket);
  });
});

describe('WebSocket /ws — event forwarding', () => {
  it('forwards intent events to a connected client', async () => {
    const { baseUrl, result } = await start();
    const token = tokenFor('alice');
    const socket = new WebSocket(`${baseUrl}/ws?token=${token}`);
    await awaitOpen(socket);

    const messagesPromise = awaitMessages(socket, 1, 5000);
    result.bus.publish('collab.ai.intent.proposed', { id: 'i-1' }, { source: 'r-1' });

    const msgs = (await messagesPromise) as Array<{ type: string; source?: string }>;
    expect(msgs[0].type).toBe('collab.ai.intent.proposed');
    expect(msgs[0].source).toBe('r-1');

    socket.close();
    await awaitClose(socket);
  });

  it('filters by roomId when supplied as a query param', async () => {
    const { baseUrl, result } = await start();
    const token = tokenFor('alice');
    const socket = new WebSocket(
      `${baseUrl}/ws?token=${token}&roomId=r-1`,
    );
    await awaitOpen(socket);

    // Client filters to r-1 only — these two events are for other rooms
    result.bus.publish('collab.ai.intent.proposed', { id: 'x' }, { source: 'r-2' });
    result.bus.publish('collab.ai.intent.proposed', { id: 'y' }, { source: 'r-3' });
    // This one matches
    const wait = awaitMessages(socket, 1, 5000);
    result.bus.publish('collab.ai.intent.proposed', { id: 'ok' }, { source: 'r-1' });

    const msgs = (await wait) as Array<{ payload: { id: string } }>;
    expect(msgs[0].payload.id).toBe('ok');

    socket.close();
    await awaitClose(socket);
  });

  it('forwards mode + room events alongside intents', async () => {
    const { baseUrl, result } = await start();
    const token = tokenFor('alice');
    const socket = new WebSocket(`${baseUrl}/ws?token=${token}`);
    await awaitOpen(socket);

    const wait = awaitMessages(socket, 3, 5000);
    result.bus.publish('collab.ai.intent.proposed', {}, { source: 'r-1' });
    result.bus.publish('collab.permissions.mode.changed', {}, { source: 'r-1' });
    result.bus.publish('collab.room.created', {}, { source: 'r-1' });

    const msgs = (await wait) as Array<{ type: string }>;
    expect(msgs.map(m => m.type).sort()).toEqual([
      'collab.ai.intent.proposed',
      'collab.permissions.mode.changed',
      'collab.room.created',
    ]);

    socket.close();
    await awaitClose(socket);
  });
});

describe('WebSocket /ws — disconnect cleanup', () => {
  it('removes client from the set on close', async () => {
    const { baseUrl, result } = await start();
    const token = tokenFor('alice');
    const socket = new WebSocket(`${baseUrl}/ws?token=${token}`);
    await awaitOpen(socket);
    expect(result.ws.clients.size).toBe(1);
    socket.close();
    await awaitClose(socket);
    // Allow the close handler to run.
    await new Promise(r => setTimeout(r, 50));
    expect(result.ws.clients.size).toBe(0);
  });
});
