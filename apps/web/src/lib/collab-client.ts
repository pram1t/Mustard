/**
 * Typed REST client for @pram1t/mustard-collab-server.
 *
 * Browser-side wrapper around the Phase-8 Fastify endpoints. Stateless
 * per call — pass the JWT every request. Errors throw `CollabApiError`
 * with structured detail.
 */

// ============================================================================
// Public types (mirrors of collab-server contracts, kept narrow on purpose
// to avoid leaking server-internal shapes into the browser bundle)
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

export interface Agent {
  id: string;
  name: string;
  model: string;
  provider: string;
  status: string;
  registeredAt: number;
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
// Client
// ============================================================================

export interface CollabClientOptions {
  /** Base URL of the collab server. e.g. http://127.0.0.1:3200 */
  baseUrl: string;
  /** JWT used for authenticated calls. */
  token?: string;
  /**
   * Fetch implementation. Defaults to globalThis.fetch. Tests inject
   * a mock here.
   */
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

  // --------------------------------------------------------------------------
  // Auth
  // --------------------------------------------------------------------------

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

  // --------------------------------------------------------------------------
  // Rooms
  // --------------------------------------------------------------------------

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

  // --------------------------------------------------------------------------
  // Participants
  // --------------------------------------------------------------------------

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

  // --------------------------------------------------------------------------
  // Intents
  // --------------------------------------------------------------------------

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

  async approveIntent(
    roomId: string,
    intentId: string,
    approver?: string,
  ): Promise<unknown> {
    return this.request(
      'POST',
      `/rooms/${encodeURIComponent(roomId)}/intents/${encodeURIComponent(intentId)}/approve`,
      { body: approver ? { approver } : {} },
    );
  }

  async rejectIntent(
    roomId: string,
    intentId: string,
    reason?: string,
  ): Promise<unknown> {
    return this.request(
      'POST',
      `/rooms/${encodeURIComponent(roomId)}/intents/${encodeURIComponent(intentId)}/reject`,
      { body: reason ? { reason } : {} },
    );
  }

  // --------------------------------------------------------------------------
  // Mode
  // --------------------------------------------------------------------------

  async getMode(roomId: string): Promise<{ mode: PermissionMode; capabilities: unknown }> {
    return this.request('GET', `/rooms/${encodeURIComponent(roomId)}/mode`);
  }

  async setMode(roomId: string, mode: PermissionMode): Promise<{ mode: PermissionMode }> {
    return this.request('POST', `/rooms/${encodeURIComponent(roomId)}/mode`, {
      body: { mode },
    });
  }

  // --------------------------------------------------------------------------
  // Agents
  // --------------------------------------------------------------------------

  async registerAgent(
    roomId: string,
    input: {
      agentId: string;
      name: string;
      model: string;
      provider: string;
      allowedActions?: string[];
    },
  ): Promise<Agent> {
    const r = await this.request<{ agent: Agent }>(
      'POST',
      `/rooms/${encodeURIComponent(roomId)}/agents`,
      { body: input },
    );
    return r.agent;
  }

  async listAgents(roomId: string): Promise<Agent[]> {
    const r = await this.request<{ agents: Agent[] }>(
      'GET',
      `/rooms/${encodeURIComponent(roomId)}/agents`,
    );
    return r.agents;
  }

  async unregisterAgent(roomId: string, agentId: string): Promise<void> {
    await this.request<void>(
      'DELETE',
      `/rooms/${encodeURIComponent(roomId)}/agents/${encodeURIComponent(agentId)}`,
      { expectEmpty: true },
    );
  }

  // --------------------------------------------------------------------------
  // Internals
  // --------------------------------------------------------------------------

  private async request<T>(
    method: string,
    path: string,
    options: {
      body?: unknown;
      auth?: boolean;
      expectEmpty?: boolean;
    } = {},
  ): Promise<T> {
    const auth = options.auth !== false;
    const headers: Record<string, string> = {};
    if (options.body !== undefined) {
      headers['content-type'] = 'application/json';
    }
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

    const res = await this.fetcher(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });

    if (options.expectEmpty && res.status === 204) {
      return undefined as T;
    }

    if (!res.ok) {
      // Read the body once as text, then try to parse JSON. Calling
      // res.json() then res.text() on failure double-reads the body
      // and throws "body unusable" on modern fetch implementations.
      const text = await res.text();
      let body: unknown = text;
      try {
        body = JSON.parse(text);
      } catch {
        /* leave body as the raw string */
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
