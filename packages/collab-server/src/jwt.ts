/**
 * Minimal JWT helpers (HS256) — no external dependency.
 *
 * This is intentionally tiny. It ships a two-function API:
 *   - `sign(payload, secret, expiresInSec?)`
 *   - `verify(token, secret)` -> payload or null
 *
 * For production-grade needs (key rotation, RS256, JWKS) swap in a
 * purpose-built library. For Phase-8 Collab this is enough — we only
 * need server-issued, server-verified session tokens.
 */

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const HEADER: JwtHeader = { alg: 'HS256', typ: 'JWT' };
const ENCODED_HEADER = base64urlEncode(JSON.stringify(HEADER));

export interface JwtHeader {
  alg: 'HS256';
  typ: 'JWT';
}

export interface JwtPayload extends Record<string, unknown> {
  /** Subject — typically participantId or userId */
  sub: string;
  /** Room this token grants access to (collab-specific) */
  roomId?: string;
  /** Token issued at, epoch seconds */
  iat?: number;
  /** Token expiry, epoch seconds */
  exp?: number;
  /** Token id — for revocation */
  jti?: string;
}

export interface SignOptions {
  /** Lifetime in seconds. Default 1 hour. */
  expiresInSec?: number;
}

// ============================================================================
// Sign
// ============================================================================

export function sign(
  payload: JwtPayload,
  secret: string,
  options: SignOptions = {},
): string {
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + (options.expiresInSec ?? 3600);
  // Generate a fresh jti unless the caller already supplied one. This
  // guarantees every signed token is unique even when iat collides
  // (e.g. two sign() calls inside the same second on a refresh).
  const jti = payload.jti ?? randomBytes(8).toString('hex');

  const full: JwtPayload = { ...payload, iat, exp, jti };
  const encodedPayload = base64urlEncode(JSON.stringify(full));
  const signingInput = `${ENCODED_HEADER}.${encodedPayload}`;
  const signature = hmacSign(signingInput, secret);

  return `${signingInput}.${signature}`;
}

// ============================================================================
// Verify
// ============================================================================

export interface VerifyOptions {
  /** If true, ignore `exp`. Default false. */
  ignoreExpiration?: boolean;
  /** Override "now" for testing. Epoch seconds. */
  now?: number;
}

/**
 * Verify a JWT. Returns the payload if valid, `null` otherwise.
 * Never throws — all failure modes map to `null`.
 */
export function verify(
  token: string,
  secret: string,
  options: VerifyOptions = {},
): JwtPayload | null {
  if (!token || typeof token !== 'string') return null;

  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [encodedHeader, encodedPayload, signature] = parts;

  // Header must match exactly the one we sign with.
  if (encodedHeader !== ENCODED_HEADER) return null;

  const expected = hmacSign(`${encodedHeader}.${encodedPayload}`, secret);
  if (!constantTimeEqual(signature, expected)) return null;

  let payload: JwtPayload;
  try {
    const decoded = base64urlDecode(encodedPayload);
    payload = JSON.parse(decoded) as JwtPayload;
  } catch {
    return null;
  }

  if (!options.ignoreExpiration && typeof payload.exp === 'number') {
    const now = options.now ?? Math.floor(Date.now() / 1000);
    if (payload.exp < now) return null;
  }

  return payload;
}

// ============================================================================
// Helpers
// ============================================================================

function hmacSign(input: string, secret: string): string {
  const mac = createHmac('sha256', secret).update(input).digest();
  return base64urlEncodeBuffer(mac);
}

function base64urlEncode(s: string): string {
  return base64urlEncodeBuffer(Buffer.from(s, 'utf8'));
}

function base64urlEncodeBuffer(buf: Buffer): string {
  return buf
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64urlDecode(s: string): string {
  const pad = s.length % 4 === 0 ? 0 : 4 - (s.length % 4);
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat(pad);
  return Buffer.from(b64, 'base64').toString('utf8');
}

function constantTimeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}
