import { describe, it, expect } from 'vitest';
import { sign, verify } from '../jwt.js';

const SECRET = 'test-secret-change-me';

describe('jwt.sign', () => {
  it('produces a three-part token', () => {
    const t = sign({ sub: 'alice' }, SECRET);
    expect(t.split('.')).toHaveLength(3);
  });

  it('embeds iat + exp when not provided', () => {
    const t = sign({ sub: 'alice' }, SECRET, { expiresInSec: 60 });
    const payload = verify(t, SECRET)!;
    expect(payload.sub).toBe('alice');
    expect(typeof payload.iat).toBe('number');
    expect(typeof payload.exp).toBe('number');
    expect((payload.exp ?? 0) - (payload.iat ?? 0)).toBe(60);
  });

  it('honors custom payload fields like roomId', () => {
    const t = sign({ sub: 'alice', roomId: 'r-1' }, SECRET);
    const payload = verify(t, SECRET)!;
    expect(payload.roomId).toBe('r-1');
  });
});

describe('jwt.verify', () => {
  it('returns null for malformed input', () => {
    expect(verify('', SECRET)).toBeNull();
    expect(verify('not-a-jwt', SECRET)).toBeNull();
    expect(verify('a.b', SECRET)).toBeNull();
    expect(verify('a.b.c.d', SECRET)).toBeNull();
  });

  it('returns null when signed with a different secret', () => {
    const t = sign({ sub: 'alice' }, SECRET);
    expect(verify(t, 'other-secret')).toBeNull();
  });

  it('returns null when tampered', () => {
    const t = sign({ sub: 'alice' }, SECRET);
    const [h, , s] = t.split('.');
    // Replace payload with a different, validly-b64'd payload (sub: mallory)
    const evilPayload = Buffer.from('{"sub":"mallory"}')
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    expect(verify(`${h}.${evilPayload}.${s}`, SECRET)).toBeNull();
  });

  it('returns null when expired', () => {
    const iat = Math.floor(Date.now() / 1000);
    const t = sign({ sub: 'alice' }, SECRET, { expiresInSec: 10 });
    expect(verify(t, SECRET, { now: iat + 11 })).toBeNull();
  });

  it('respects ignoreExpiration', () => {
    const iat = Math.floor(Date.now() / 1000);
    const t = sign({ sub: 'alice' }, SECRET, { expiresInSec: 10 });
    expect(verify(t, SECRET, { now: iat + 999, ignoreExpiration: true }))
      .not.toBeNull();
  });

  it('returns null when the header is not HS256 JWT', () => {
    // Hand-craft a token with a different header
    const header = Buffer.from('{"alg":"none","typ":"JWT"}')
      .toString('base64')
      .replace(/=+$/, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
    const payload = Buffer.from('{"sub":"alice"}')
      .toString('base64')
      .replace(/=+$/, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
    expect(verify(`${header}.${payload}.`, SECRET)).toBeNull();
  });
});
