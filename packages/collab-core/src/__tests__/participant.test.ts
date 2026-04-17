import { describe, it, expect } from 'vitest';
import {
  createParticipant,
  setParticipantRole,
  setParticipantStatus,
  touchParticipant,
  hasRoleLevel,
  canRead,
  canWrite,
  canAdmin,
} from '../participant.js';

describe('createParticipant', () => {
  it('creates a participant with correct fields', () => {
    const p = createParticipant({
      roomId: 'room-1',
      userId: 'user-1',
      name: 'Alice',
      type: 'human',
      role: 'member',
    });

    expect(p.id).toBeDefined();
    expect(p.roomId).toBe('room-1');
    expect(p.userId).toBe('user-1');
    expect(p.name).toBe('Alice');
    expect(p.type).toBe('human');
    expect(p.role).toBe('member');
    expect(p.status).toBe('online');
  });

  it('creates AI participant', () => {
    const p = createParticipant({
      roomId: 'room-1',
      userId: 'agent-1',
      name: 'Claude',
      type: 'ai',
      role: 'member',
    });

    expect(p.type).toBe('ai');
  });
});

describe('setParticipantRole', () => {
  it('updates role', () => {
    const p = createParticipant({ roomId: 'r', userId: 'u', name: 'A', type: 'human', role: 'member' });
    const updated = setParticipantRole(p, 'admin');
    expect(updated.role).toBe('admin');
  });
});

describe('setParticipantStatus', () => {
  it('updates status', () => {
    const p = createParticipant({ roomId: 'r', userId: 'u', name: 'A', type: 'human', role: 'member' });
    const updated = setParticipantStatus(p, 'away');
    expect(updated.status).toBe('away');
  });
});

describe('touchParticipant', () => {
  it('updates lastSeenAt', () => {
    const p = createParticipant({ roomId: 'r', userId: 'u', name: 'A', type: 'human', role: 'member' });
    const touched = touchParticipant(p);
    expect(touched.lastSeenAt.getTime()).toBeGreaterThanOrEqual(p.lastSeenAt.getTime());
  });
});

describe('role checks', () => {
  describe('hasRoleLevel', () => {
    it('owner has all levels', () => {
      expect(hasRoleLevel('owner', 'viewer')).toBe(true);
      expect(hasRoleLevel('owner', 'member')).toBe(true);
      expect(hasRoleLevel('owner', 'admin')).toBe(true);
      expect(hasRoleLevel('owner', 'owner')).toBe(true);
    });

    it('viewer cannot admin', () => {
      expect(hasRoleLevel('viewer', 'admin')).toBe(false);
      expect(hasRoleLevel('viewer', 'member')).toBe(false);
    });

    it('member cannot admin', () => {
      expect(hasRoleLevel('member', 'admin')).toBe(false);
    });

    it('admin can member', () => {
      expect(hasRoleLevel('admin', 'member')).toBe(true);
    });
  });

  describe('canRead', () => {
    it('everyone can read', () => {
      expect(canRead('viewer')).toBe(true);
      expect(canRead('member')).toBe(true);
      expect(canRead('admin')).toBe(true);
      expect(canRead('owner')).toBe(true);
    });
  });

  describe('canWrite', () => {
    it('members and above can write', () => {
      expect(canWrite('viewer')).toBe(false);
      expect(canWrite('member')).toBe(true);
      expect(canWrite('admin')).toBe(true);
      expect(canWrite('owner')).toBe(true);
    });
  });

  describe('canAdmin', () => {
    it('only admin and owner', () => {
      expect(canAdmin('viewer')).toBe(false);
      expect(canAdmin('member')).toBe(false);
      expect(canAdmin('admin')).toBe(true);
      expect(canAdmin('owner')).toBe(true);
    });
  });
});
