/**
 * Participant model — join, leave, role management.
 */

import { randomUUID } from 'node:crypto';
import type {
  Participant,
  ParticipantType,
  ParticipantRole,
  ParticipantStatus,
} from './types.js';

// ============================================================================
// Participant Factory
// ============================================================================

/**
 * Create a new participant for a room.
 */
export function createParticipant(opts: {
  roomId: string;
  userId: string;
  name: string;
  type: ParticipantType;
  role: ParticipantRole;
}): Participant {
  const now = new Date();
  return {
    id: randomUUID(),
    roomId: opts.roomId,
    userId: opts.userId,
    name: opts.name,
    type: opts.type,
    role: opts.role,
    status: 'online',
    joinedAt: now,
    lastSeenAt: now,
  };
}

// ============================================================================
// Participant Updates
// ============================================================================

/**
 * Update participant role.
 */
export function setParticipantRole(p: Participant, role: ParticipantRole): Participant {
  return { ...p, role, lastSeenAt: new Date() };
}

/**
 * Update participant status.
 */
export function setParticipantStatus(p: Participant, status: ParticipantStatus): Participant {
  return { ...p, status, lastSeenAt: new Date() };
}

/**
 * Touch last-seen timestamp.
 */
export function touchParticipant(p: Participant): Participant {
  return { ...p, lastSeenAt: new Date() };
}

// ============================================================================
// Role Checks
// ============================================================================

const ROLE_LEVELS: Record<ParticipantRole, number> = {
  owner: 4,
  admin: 3,
  member: 2,
  viewer: 1,
};

/**
 * Check if a role has at least the required level.
 */
export function hasRoleLevel(role: ParticipantRole, required: ParticipantRole): boolean {
  return ROLE_LEVELS[role] >= ROLE_LEVELS[required];
}

/**
 * Can this participant read?  Everyone can read.
 */
export function canRead(_role: ParticipantRole): boolean {
  return true;
}

/**
 * Can this participant write?  Members and above.
 */
export function canWrite(role: ParticipantRole): boolean {
  return hasRoleLevel(role, 'member');
}

/**
 * Can this participant admin the room?  Admins and above.
 */
export function canAdmin(role: ParticipantRole): boolean {
  return hasRoleLevel(role, 'admin');
}
