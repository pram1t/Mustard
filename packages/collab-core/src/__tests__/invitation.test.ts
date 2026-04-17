import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createInvitation, isInvitationValid, useInvitation } from '../invitation.js';

describe('createInvitation', () => {
  it('creates invitation with defaults', () => {
    const inv = createInvitation({ roomId: 'room-1', createdBy: 'user-1' });

    expect(inv.id).toBeDefined();
    expect(inv.roomId).toBe('room-1');
    expect(inv.code.length).toBe(8);
    expect(inv.role).toBe('member');
    expect(inv.uses).toBe(0);
    expect(inv.createdBy).toBe('user-1');
  });

  it('sets custom role', () => {
    const inv = createInvitation({ roomId: 'r', createdBy: 'u', role: 'admin' });
    expect(inv.role).toBe('admin');
  });

  it('sets maxUses', () => {
    const inv = createInvitation({ roomId: 'r', createdBy: 'u', maxUses: 5 });
    expect(inv.maxUses).toBe(5);
  });

  it('sets expiry date', () => {
    const inv = createInvitation({ roomId: 'r', createdBy: 'u', expiresInMs: 3600_000 });
    expect(inv.expiresAt).toBeDefined();
    expect(inv.expiresAt!.getTime()).toBeGreaterThan(Date.now());
  });

  it('generates unique codes', () => {
    const a = createInvitation({ roomId: 'r', createdBy: 'u' });
    const b = createInvitation({ roomId: 'r', createdBy: 'u' });
    expect(a.code).not.toBe(b.code);
  });
});

describe('isInvitationValid', () => {
  it('valid invitation returns true', () => {
    const inv = createInvitation({ roomId: 'r', createdBy: 'u' });
    expect(isInvitationValid(inv)).toBe(true);
  });

  it('expired invitation returns false', () => {
    const inv = createInvitation({ roomId: 'r', createdBy: 'u', expiresInMs: -1000 });
    expect(isInvitationValid(inv)).toBe(false);
  });

  it('max uses exceeded returns false', () => {
    const inv = createInvitation({ roomId: 'r', createdBy: 'u', maxUses: 1 });
    const used = { ...inv, uses: 1 };
    expect(isInvitationValid(used)).toBe(false);
  });

  it('still valid under max uses', () => {
    const inv = createInvitation({ roomId: 'r', createdBy: 'u', maxUses: 3 });
    const used = { ...inv, uses: 2 };
    expect(isInvitationValid(used)).toBe(true);
  });
});

describe('useInvitation', () => {
  it('increments use count', () => {
    const inv = createInvitation({ roomId: 'r', createdBy: 'u' });
    const used = useInvitation(inv);
    expect(used.uses).toBe(1);
  });

  it('throws if invitation is expired', () => {
    const inv = createInvitation({ roomId: 'r', createdBy: 'u', expiresInMs: -1000 });
    expect(() => useInvitation(inv)).toThrow('no longer valid');
  });

  it('throws if max uses reached', () => {
    const inv = createInvitation({ roomId: 'r', createdBy: 'u', maxUses: 1 });
    const used = useInvitation(inv); // uses: 0 → 1
    expect(() => useInvitation(used)).toThrow('no longer valid'); // uses: 1, max: 1
  });
});
