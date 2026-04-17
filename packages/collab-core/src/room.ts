/**
 * Room model — create, update, status transitions, slug generation.
 */

import { randomUUID } from 'node:crypto';
import type { Room, RoomConfig, RoomStatus, CreateRoomRequest } from './types.js';
import { DEFAULT_ROOM_CONFIG } from './types.js';

// ============================================================================
// Slug Generation
// ============================================================================

/**
 * Generate a URL-friendly slug from a room name.
 * e.g. "My Cool Project" → "my-cool-project"
 */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 64) || 'room';
}

/**
 * Generate a unique slug by appending a short random suffix.
 */
export function uniqueSlug(name: string): string {
  const base = slugify(name);
  const suffix = randomUUID().slice(0, 6);
  return `${base}-${suffix}`;
}

// ============================================================================
// Room Factory
// ============================================================================

/**
 * Create a new Room from a request.
 */
export function createRoom(req: CreateRoomRequest, ownerId: string): Room {
  const now = new Date();
  const config: RoomConfig = {
    ...DEFAULT_ROOM_CONFIG,
    ...req.config,
  };

  return {
    id: randomUUID(),
    name: req.name,
    slug: uniqueSlug(req.name),
    projectPath: req.projectPath,
    config,
    status: 'active',
    createdAt: now,
    updatedAt: now,
    ownerId,
  };
}

// ============================================================================
// Room Updates
// ============================================================================

/**
 * Apply partial updates to a room.
 */
export function updateRoom(
  room: Room,
  updates: { name?: string; config?: Partial<RoomConfig> },
): Room {
  return {
    ...room,
    name: updates.name ?? room.name,
    config: updates.config ? { ...room.config, ...updates.config } : room.config,
    updatedAt: new Date(),
  };
}

/**
 * Transition room status.
 */
export function setRoomStatus(room: Room, status: RoomStatus): Room {
  return {
    ...room,
    status,
    updatedAt: new Date(),
  };
}
