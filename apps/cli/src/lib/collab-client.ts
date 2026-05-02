/**
 * CLI-side typed REST client for @pram1t/mustard-collab-server.
 *
 * Same shape as the web client (apps/web/src/lib/collab-client.ts) but
 * carries a small token cache that persists JWTs to
 * ~/.mustard/collab/tokens.json keyed by participantId. This lets
 * the CLI re-use a token across invocations until it expires.
 *
 * Future cleanup: extract to a shared @pram1t/mustard-collab-client package
 * so web + CLI share one implementation. For now duplicated to keep
 * Phase 10 diffs tight.
 */

import { homedir } from 'node:os';
import { promises as fs } from 'node:fs';
import path from 'node:path';

// ============================================================================
// Public types — narrow mirror of server contracts
// ============================================================================

export type PermissionMode = 'plan' | 'code' | 'ask' | 'auto';
export type ParticipantType = 'human' | 'ai';
export type ParticipantRole = 'owner' | 'admin' | 'member' | 'viewer';
export type RiskLevel = 'safe' | 'moderate' | 'dangerous';
export type IntentStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'executing'
  | 'completed'
  | 'failed'
  | 'invalidated';

export interface Room {
  id: string;
  name: string;
  slug: string;
  projectPath?: string;
  status: 'active' | 'dormant';
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  config: {
    visibility: 'private' | 'team' | 'public';
    defaultMode: PermissionMode;
    aiEnabled: boolean;
    maxAgents: number;
  };
}

export interface Participant {
  id: string;
  roomId: string;
  userId: string;
  name: string;
  type: ParticipantType;
  role: ParticipantRole;
  status: 'online' | 'offline' | 'away';
  joinedAt: string;
}

export interface Intent {
  id: string;
  agentId: string;
  summary: string;
  type: string;
  rationale: string;
  confidence: number;
  risk: RiskLevel;
  status: IntentStatus;
  createdAt: number;
  resolvedAt?: number;
  resolvedBy?: string;
  rejectionReason?: string;
}

export interface LoginResponse {
  token: string;
  expiresAt: number;
  participantId: string;
  roomId?: string;
}

// ============================================================================
// Errors
// ============================================================================

export interface CollabErrorBody {
  error: { code: string; message: string };
}

export class CollabApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly body?: unknown;

  constructor(status: number, code: string, message: string, body?: unknown) {
    super(message);
    this.name = 'CollabApiError';
    this.status = status;
    this.code = code;
    this.body = body;
  }
}

// ============================================================================
// Token cache
// ============================================================================

interface CachedToken {
  token: string;
  expiresAt: number;
  baseUrl: string;
  participantId: string;
}

interface TokenStore {
  /** Map of participantId → CachedToken */
  tokens: Record<string, CachedToken>;
}

const DEFAULT_TOKEN_PATH = path.join(homedir(), '.mustard', 'collab', 'tokens.json');

export async function loadTokenStore(file = DEFAULT_TOKEN_PATH): Promise<TokenStore> {
  try {
    const raw = await fs.readFile(file, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && parsed.tokens && typeof parsed.tokens === 'object') {
      return parsed as TokenStore;
    }
  } catch {
    /* missing or unreadable — return empty */
  }
  return { tokens: {} };
}

export async function saveTokenStore(store: TokenStore, file = DEFAULT_TOKEN_PATH): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(store, null, 2), 'utf8');
}

/** Look up a still-valid cached token for participantId. */
export async function getCachedToken(
  participantId: string,
  file = DEFAULT_TOKEN_PATH,
): Promise<CachedToken | null> {
  const store = await loadTokenStore(file);
  const t = store.tokens[participantId];
  if (!t) return null;
  if (t.expiresAt <= Math.floor(Date.now() / 1000) + 5) return null; // 5s leeway
  return t;
}

export async function setCachedToken(
  cached: CachedToken,
  file = DEFAULT_TOKEN_PATH,
): Promise<void> {
  const store = await loadTokenStore(file);
  store.tokens[cached.participantId] = cached;
  await saveTokenStore(store, file);
}

export async function clearCachedToken(
  participantId: string,
  file = DEFAULT_TOKEN_PATH,
): Promise<void> {
  const store = await loadTokenStore(file);
  delete store.tokens[participantId];
  await saveTokenStore(store, file);
}

// ============================================================================
// Client
// ============================================================================

export interface CollabClientOptions {
  baseUrl: string;
  token?: string;
  fetch?: typeof fetch;
}

export class CollabClient {
  baseUrl: string;
  token?: string;
  private readonly fetcher: typeof fetch;

  constructor(options: CollabClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.token = options.token;
    this.fetcher = options.fetch ?? globalThis.fetch.bind(globalThis);
  }

  setToken(token: string | undefined): void {
    this.token = token;
  }

  // ---- Auth ----

  async login(input: {
    participantId: string;
    participantName?: string;
    type?: ParticipantType;
    roomId?: string;
  }): Promise<LoginResponse> {
    const body = await this.request<LoginResponse>('POST', '/auth/login', {
      body: input,
      auth: false,
    });
    this.token = body.token;
    return body;
  }

  // ---- Rooms ----

  async createRoom(input: {
    name: string;
    projectPath?: string;
    config?: Partial<Room['config']>;
  }): Promise<Room> {
    const r = await this.request<{ room: Room }>('POST', '/rooms', {
      body: input,
    });
    return r.room;
  }

  async listRooms(): Promise<Room[]> {
    const r = await this.request<{ rooms: Room[] }>('GET', '/rooms');
    return r.rooms;
  }

  async getRoom(id: string): Promise<{
    room: Room;
    participants: Participant[];
    mode: PermissionMode;
  }> {
    return this.request('GET', `/rooms/${encodeURIComponent(id)}`);
  }

  async deleteRoom(id: string): Promise<void> {
    await this.request<void>('DELETE', `/rooms/${encodeURIComponent(id)}`, {
      expectEmpty: true,
    });
  }

  // ---- Participants ----

  async joinRoom(
    id: string,
    input: { name?: string; type?: ParticipantType; role?: ParticipantRole } = {},
  ): Promise<Participant> {
    const r = await this.request<{ participant: Participant }>(
      'POST',
      `/rooms/${encodeURIComponent(id)}/join`,
      { body: input },
    );
    return r.participant;
  }

  async leaveRoom(roomId: string, participantId: string): Promise<void> {
    await this.request<void>(
      'POST',
      `/rooms/${encodeURIComponent(roomId)}/participants/${encodeURIComponent(participantId)}/leave`,
      { expectEmpty: true },
    );
  }

  async listParticipants(roomId: string): Promise<Participant[]> {
    const r = await this.request<{ participants: Participant[] }>(
      'GET',
      `/rooms/${encodeURIComponent(roomId)}/participants`,
    );
    return r.participants;
  }

  // ---- Intents + mode + agents ----

  async listIntents(
    roomId: string,
    filter?: { status?: IntentStatus },
  ): Promise<Intent[]> {
    const qs = filter?.status ? `?status=${encodeURIComponent(filter.status)}` : '';
    const r = await this.request<{ intents: Intent[] }>(
      'GET',
      `/rooms/${encodeURIComponent(roomId)}/intents${qs}`,
    );
    return r.intents;
  }

  async approveIntent(roomId: string, intentId: string, approver?: string): Promise<unknown> {
    return this.request(
      'POST',
      `/rooms/${encodeURIComponent(roomId)}/intents/${encodeURIComponent(intentId)}/approve`,
      { body: approver ? { approver } : {} },
    );
  }

  async rejectIntent(roomId: string, intentId: string, reason?: string): Promise<unknown> {
    return this.request(
      'POST',
      `/rooms/${encodeURIComponent(roomId)}/intents/${encodeURIComponent(intentId)}/reject`,
      { body: reason ? { reason } : {} },
    );
  }

  async getMode(roomId: string): Promise<{ mode: PermissionMode; capabilities: unknown }> {
    return this.request('GET', `/rooms/${encodeURIComponent(roomId)}/mode`);
  }

  async setMode(roomId: string, mode: PermissionMode): Promise<{ mode: PermissionMode }> {
    return this.request('POST', `/rooms/${encodeURIComponent(roomId)}/mode`, {
      body: { mode },
    });
  }

  // ---- Internal ----

  private async request<T>(
    method: string,
    p: string,
    options: { body?: unknown; auth?: boolean; expectEmpty?: boolean } = {},
  ): Promise<T> {
    const auth = options.auth !== false;
    const headers: Record<string, string> = {};
    if (options.body !== undefined) headers['content-type'] = 'application/json';
    if (auth) {
      if (!this.token) {
        throw new CollabApiError(
          401,
          'NO_TOKEN',
          'CollabClient: missing token; call login() or pass one in',
        );
      }
      headers['authorization'] = `Bearer ${this.token}`;
    }

    const res = await this.fetcher(`${this.baseUrl}${p}`, {
      method,
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });

    if (options.expectEmpty && res.status === 204) return undefined as T;

    if (!res.ok) {
      const text = await res.text();
      let body: unknown = text;
      try {
        body = JSON.parse(text);
      } catch {
        /* leave as text */
      }
      const errBody = body as Partial<CollabErrorBody>;
      const code = errBody?.error?.code ?? `HTTP_${res.status}`;
      const message =
        errBody?.error?.message ?? res.statusText ?? `HTTP ${res.status}`;
      throw new CollabApiError(res.status, code, message, body);
    }

    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }
}

// ============================================================================
// Convenience
// ============================================================================

/**
 * Get an authenticated client for `participantId`. Uses cached token if
 * still valid; otherwise calls /auth/login and persists the new token.
 */
export async function getAuthenticatedClient(
  baseUrl: string,
  participantId: string,
  options?: { roomId?: string; tokenFile?: string },
): Promise<CollabClient> {
  const tokenFile = options?.tokenFile ?? DEFAULT_TOKEN_PATH;
  const cached = await getCachedToken(participantId, tokenFile);
  if (cached && cached.baseUrl === baseUrl.replace(/\/$/, '')) {
    return new CollabClient({ baseUrl, token: cached.token });
  }

  const client = new CollabClient({ baseUrl });
  const login = await client.login({
    participantId,
    participantName: participantId,
    type: 'human',
    roomId: options?.roomId,
  });
  await setCachedToken(
    {
      participantId,
      token: login.token,
      expiresAt: login.expiresAt,
      baseUrl: baseUrl.replace(/\/$/, ''),
    },
    tokenFile,
  );
  return client;
}

export const TOKEN_FILE_PATH = DEFAULT_TOKEN_PATH;
