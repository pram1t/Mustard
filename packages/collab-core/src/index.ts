/**
 * @openagent/collab-core
 *
 * Room, participant, and shared types for OpenAgent Collab.
 */

// ── Types ───────────────────────────────────────────────────────────────────
export type {
  // Shared primitives
  Range,
  SelectionRange,
  Position,

  // Room types
  Room,
  RoomStatus,
  RoomType,
  RoomConfig,
  RoomVisibility,
  PermissionMode,

  // Participant types
  Participant,
  ParticipantType,
  ParticipantRole,
  ParticipantStatus,
  HumanParticipant,
  AIParticipant,
  AgentConfig,
  AgentHosting,

  // Invitation types
  Invitation,

  // Room operations
  CreateRoomRequest,
  CreateRoomResponse,
  JoinRoomRequest,
  JoinRoomResponse,
  UpdateRoomRequest,
  ListRoomsQuery,
  ListRoomsResponse,
  RoomSummary,

  // Room events
  RoomEvent,
  RoomCreatedEvent,
  RoomUpdatedEvent,
  RoomDeletedEvent,
  ParticipantJoinedEvent,
  ParticipantLeftEvent,
  ParticipantUpdatedEvent,
  CheckpointCreatedEvent,
} from './types.js';

export { DEFAULT_ROOM_CONFIG } from './types.js';

// ── Room ────────────────────────────────────────────────────────────────────
export { slugify, uniqueSlug, createRoom, updateRoom, setRoomStatus } from './room.js';

// ── Participant ─────────────────────────────────────────────────────────────
export {
  createParticipant,
  setParticipantRole,
  setParticipantStatus,
  touchParticipant,
  hasRoleLevel,
  canRead,
  canWrite,
  canAdmin,
} from './participant.js';

// ── Invitation ──────────────────────────────────────────────────────────────
export { createInvitation, isInvitationValid, useInvitation } from './invitation.js';
