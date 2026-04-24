import { describe, it, expect } from 'vitest';
import { createApp } from '../app.js';
import type { LoginResponse } from '../types.js';

const SECRET = 'test-secret-change-me';

async function makeApp() {
  const { app } = await createApp({ config: { jwtSecret: SECRET } });
  return app;
}

describe('createApp — configuration', () => {
  it('throws when jwtSecret is empty', async () => {
    await expect(createApp({})).rejects.toThrow(/jwtSecret/);
    await expect(createApp({ config: { jwtSecret: '' } })).rejects.toThrow(
      /jwtSecret/,
    );
  });

  it('uses the default port + host from DEFAULT_COLLAB_SERVER_CONFIG', async () => {
    const { config } = await createApp({ config: { jwtSecret: SECRET } });
    expect(config.host).toBe('127.0.0.1');
    expect(config.port).toBe(3200);
  });
});

describe('/health', () => {
  it('returns ok + timestamp', async () => {
    const app = await makeApp();
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe('ok');
    expect(typeof body.timestamp).toBe('number');
    await app.close();
  });
});

describe('/auth/login', () => {
  it('issues a token for a valid login request', async () => {
    const app = await makeApp();
    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { participantId: 'alice', participantName: 'Alice', type: 'human', roomId: 'r-1' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as LoginResponse;
    expect(body.token).toMatch(/^[^.]+\.[^.]+\.[^.]+$/);
    expect(body.participantId).toBe('alice');
    expect(body.roomId).toBe('r-1');
    expect(body.expiresAt).toBeGreaterThan(Math.floor(Date.now() / 1000));
    await app.close();
  });

  it('rejects login without participantId', async () => {
    const app = await makeApp();
    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { participantName: 'Alice' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('INVALID_INPUT');
    await app.close();
  });
});

describe('/auth/refresh', () => {
  it('issues a new token preserving sub + roomId for a valid Bearer', async () => {
    const app = await makeApp();

    const login = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { participantId: 'alice', roomId: 'r-1' },
    });
    const oldToken = (login.json() as LoginResponse).token;

    const res = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      headers: { authorization: `Bearer ${oldToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as LoginResponse;
    expect(body.participantId).toBe('alice');
    expect(body.roomId).toBe('r-1');
    expect(body.token).not.toBe(oldToken);
    expect(body.expiresAt).toBeGreaterThan(Math.floor(Date.now() / 1000));
    await app.close();
  });

  it('rejects refresh without a Bearer token', async () => {
    const app = await makeApp();
    const res = await app.inject({ method: 'POST', url: '/auth/refresh' });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it('rejects refresh with an invalid token', async () => {
    const app = await makeApp();
    const res = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      headers: { authorization: 'Bearer garbage.token.here' },
    });
    expect(res.statusCode).toBe(401);
    await app.close();
  });
});

describe('unknown route', () => {
  it('returns 404 with structured body', async () => {
    const app = await makeApp();
    const res = await app.inject({ method: 'GET', url: '/nope' });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('NOT_FOUND');
    await app.close();
  });
});

describe('auth preHandler (opt-in per route)', () => {
  it('401s a protected route without a token', async () => {
    const app = await makeApp();
    app.get('/protected', { config: { auth: true } }, async () => ({ ok: true }));

    const res = await app.inject({ method: 'GET', url: '/protected' });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('UNAUTHORIZED');
    await app.close();
  });

  it('401s with a bogus token', async () => {
    const app = await makeApp();
    app.get('/protected', { config: { auth: true } }, async () => ({ ok: true }));

    const res = await app.inject({
      method: 'GET',
      url: '/protected',
      headers: { authorization: 'Bearer garbage.token.here' },
    });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it('passes through a valid token and attaches jwtPayload', async () => {
    const app = await makeApp();
    app.get(
      '/protected',
      { config: { auth: true } },
      async req => ({ sub: req.jwtPayload?.sub, roomId: req.jwtPayload?.roomId }),
    );

    const login = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { participantId: 'bob', roomId: 'r-9' },
    });
    const token = (login.json() as LoginResponse).token;

    const res = await app.inject({
      method: 'GET',
      url: '/protected',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ sub: 'bob', roomId: 'r-9' });
    await app.close();
  });
});
