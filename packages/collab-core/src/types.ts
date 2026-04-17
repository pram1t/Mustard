/**
 * Core types for OpenAgent Collab — rooms, participants, invitations, and shared primitives.
 */

// ============================================================================
// Shared Primitives
// ============================================================================

/**
 * Range in a file (line/column boundaries).
 */
export interface Range {
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
}

/**
 * Selection range (alias for Range, used in cursor/presence contexts).
 */
export interface SelectionRange {
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
}

/**
 * Simple cursor position.
 */
export interface Position {
  line: number;
  column: number;
}

// ============================================================================
// Room Types
// ============================================================================

/**
 * Room — a collaboration space where participants work together.
 */
export interface Room {
  /** Unique room identifier (UUID) */
  id: string;

  /** Human-readable room name */
  name: string;

  /** URL-friendly identifier */
  slug: string;

  /** Bound project path (optional) */
  projectPath?: string;

  /** Associated git remote URL (optional) */
  gitRemote?: string;

  /** Room configuration */
  config: RoomConfig;

  /** Current room status */
  status: RoomStatus;

  /** Creation timestamp */
  createdAt: Date;

  /** Last update timestamp */
  updatedAt: Date;

  /** Owner's user ID */
  ownerId: string;
}

/** Room status */
export type RoomStatus = 'active' | 'dormant';

/** Room type */
export type RoomType = 'project' | 'adhoc';

/**
 * Room configuration.
 */
export interface RoomConfig {
  /** Who can see this room */
  visibility: RoomVisibility;

  /** Allow anonymous participants */
  allowAnonymous: boolean;

  /** Default permission mode */
  defaultMode: PermissionMode;

  /** Whether AI agents are enabled */
  aiEnabled: boolean;

  /** Maximum number of AI agents */
  maxAgents: number;

  /** Checkpoint interval in milliseconds */
  checkpointInterval: number;

  /** Number of checkpoints to retain */
  retainCheckpoints: number;

  /** Expiry date for ad-hoc rooms (optional) */
  expiresAt?: Date;
}

/** Room visibility levels */
export type RoomVisibility = 'private' | 'team' | 'public';

/** Permission modes */
export type PermissionMode = 'plan' | 'code' | 'ask' | 'auto';

// ============================================================================
// Participant Types
// ============================================================================

/**
 * Base participant interface.
 */
export interface Participant {
  /** Unique participant identifier */
  id: string;

  /** Room this participant belongs to */
  roomId: string;

  /** User ID */
  userId: string;

  /** Display name */
  name: string;

  /** Participant type */
  type: ParticipantType;

  /** Role in the room */
  role: ParticipantRole;

  /** Online status */
  status: ParticipantStatus;

  /** When participant joined */
  joinedAt: Date;

  /** Last activity timestamp */
  lastSeenAt: Date;
}

/** Participant type */
export type ParticipantType = 'human' | 'ai';

/** Participant role */
export type ParticipantRole = 'owner' | 'admin' | 'member' | 'viewer';

/** Participant online status */
export type ParticipantStatus = 'online' | 'offline' | 'away';

/**
 * Human participant.
 */
export interface HumanParticipant extends Participant {
  type: 'human';

  /** User's email (optional) */
  email?: string;

  /** Avatar URL (optional) */
  avatarUrl?: string;
}

/**
 * AI agent participant.
 */
export interface AIParticipant extends Participant {
  type: 'ai';

  /** Agent configuration */
  agentConfig: AgentConfig;

  /** Where the agent is hosted */
  hosting: AgentHosting;

  /** API key ID if user-provided */
  apiKeyId?: string;

  /** Allowed tools/actions */
  allowedActions: string[];

  /** Max tokens per LLM turn */
  maxTokensPerTurn: number;
}

/**
 * Agent configuration.
 */
export interface AgentConfig {
  /** Model identifier (e.g., 'claude-3-opus') */
  model: string;

  /** Provider (e.g., 'anthropic', 'openai') */
  provider: string;

  /** Custom system prompt (optional) */
  systemPrompt?: string;

  /** Temperature setting */
  temperature?: number;

  /** Max tokens in response */
  maxTokens?: number;
}

/** Where the agent runs */
export type AgentHosting = 'server' | 'local';

// ============================================================================
// Invitation Types
// ============================================================================

/**
 * Room invitation.
 */
export interface Invitation {
  /** Unique invitation identifier */
  id: string;

  /** Room this invitation is for */
  roomId: string;

  /** Short join code */
  code: string;

  /** Role granted when joining */
  role: ParticipantRole;

  /** Expiration date (optional) */
  expiresAt?: Date;

  /** Maximum number of uses (optional) */
  maxUses?: number;

  /** Current use count */
  uses: number;

  /** Creation timestamp */
  createdAt: Date;

  /** Who created the invitation */
  createdBy: string;
}

// ============================================================================
// Room Operations
// ============================================================================

/** Create room request */
export interface CreateRoomRequest {
  name: string;
  projectPath?: string;
  config?: Partial<RoomConfig>;
}

/** Create room response */
export interface CreateRoomResponse {
  room: Room;
}

/** Join room request */
export interface JoinRoomRequest {
  displayName?: string;
  type?: ParticipantType;
}

/** Join room response */
export interface JoinRoomResponse {
  room: Room;
  participant: Participant;
  wsToken: string;
  checkpoint?: {
    state: Uint8Array;
  };
}

/** Update room request */
export interface UpdateRoomRequest {
  name?: string;
  config?: Partial<RoomConfig>;
}

/** List rooms query parameters */
export interface ListRoomsQuery {
  owned?: boolean;
  team?: string;
  projectPath?: string;
  status?: RoomStatus;
  limit?: number;
  offset?: number;
}

/** List rooms response */
export interface ListRoomsResponse {
  rooms: RoomSummary[];
  total: number;
  limit: number;
  offset: number;
}

/** Room summary for listings */
export interface RoomSummary {
  id: string;
  name: string;
  slug: string;
  status: RoomStatus;
  participantCount: number;
  lastActivity: Date;
}

// ============================================================================
// Room Events
// ============================================================================

/** Room event union */
export type RoomEvent =
  | RoomCreatedEvent
  | RoomUpdatedEvent
  | RoomDeletedEvent
  | ParticipantJoinedEvent
  | ParticipantLeftEvent
  | ParticipantUpdatedEvent
  | CheckpointCreatedEvent;

export interface RoomCreatedEvent {
  type: 'room_created';
  room: Room;
}

export interface RoomUpdatedEvent {
  type: 'room_updated';
  room: Room;
}

export interface RoomDeletedEvent {
  type: 'room_deleted';
  roomId: string;
}

export interface ParticipantJoinedEvent {
  type: 'participant_joined';
  participant: Participant;
}

export interface ParticipantLeftEvent {
  type: 'participant_left';
  participantId: string;
}

export interface ParticipantUpdatedEvent {
  type: 'participant_updated';
  participant: Participant;
}

export interface CheckpointCreatedEvent {
  type: 'checkpoint_created';
  checkpointId: string;
}

// ============================================================================
// Default Configurations
// ============================================================================

/** Default room configuration */
export const DEFAULT_ROOM_CONFIG: RoomConfig = {
  visibility: 'private',
  allowAnonymous: false,
  defaultMode: 'plan',
  aiEnabled: true,
  maxAgents: 3,
  checkpointInterval: 300_000, // 5 minutes
  retainCheckpoints: 50,
};
