/**
 * Invitation model — create, validate, use, expire invitation codes.
 */

import { randomUUID } from 'node:crypto';
import type { Invitation, ParticipantRole } from './types.js';

// ============================================================================
// Invitation Factory
// ============================================================================

/** Generate a short invite code (8 chars, alphanumeric). */
function generateCode(): string {
  return randomUUID().replace(/-/g, '').slice(0, 8);
}

/**
 * Create a new invitation.
 */
export function createInvitation(opts: {
  roomId: string;
  role?: ParticipantRole;
  createdBy: string;
  maxUses?: number;
  expiresInMs?: number;
}): Invitation {
  const now = new Date();
  return {
    id: randomUUID(),
    roomId: opts.roomId,
    code: generateCode(),
    role: opts.role ?? 'member',
    maxUses: opts.maxUses,
    uses: 0,
    createdAt: now,
    createdBy: opts.createdBy,
    expiresAt: opts.expiresInMs
      ? new Date(now.getTime() + opts.expiresInMs)
      : undefined,
  };
}

// ============================================================================
// Invitation Validation
// ============================================================================

/**
 * Check if an invitation is still valid.
 */
export function isInvitationValid(inv: Invitation): boolean {
  // Expired?
  if (inv.expiresAt && new Date() > inv.expiresAt) {
    return false;
  }
  // Max uses exceeded?
  if (inv.maxUses !== undefined && inv.uses >= inv.maxUses) {
    return false;
  }
  return true;
}

/**
 * Use an invitation (increment use count).
 *
 * @throws If the invitation is no longer valid
 */
export function useInvitation(inv: Invitation): Invitation {
  if (!isInvitationValid(inv)) {
    throw new Error('Invitation is no longer valid');
  }
  return {
    ...inv,
    uses: inv.uses + 1,
  };
}
