import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventBus, type MessageEnvelope } from '@pram1t/mustard-message-bus';
import { RoomRegistry } from '../room-registry.js';

function setup(autoApproval?: ConstructorParameters<typeof RoomRegistry>[0]['autoApproval']) {
  const bus = new EventBus();
  const reg = new RoomRegistry({ bus, autoApproval });
  return { bus, reg };
}

function basicRoom(reg: RoomRegistry, name = 'Demo Room') {
  return reg.create({
    name,
    ownerId: 'alice',
    projectPath: '/repo/demo',
  });
}

describe('RoomRegistry.create', () => {
  it('creates a room and wires the full collab stack', () => {
    const { reg } = setup();
    const ctx = basicRoom(reg);
    expect(ctx.room.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(ctx.room.name).toBe('Demo Room');
    expect(ctx.intentEngine).toBeDefined();
    expect(ctx.modeManager.current()).toBe('plan');
    expect(ctx.permissionGateway).toBeDefined();
    expect(reg.has(ctx.room.id)).toBe(true);
    expect(reg.size()).toBe(1);
  });

  it('publishes collab.room.created on creation', () => {
    const { reg, bus } = setup();
    const events: Array<MessageEnvelope<unknown>> = [];
    bus.subscribe('collab.room.created', e => events.push(e));
    const ctx = basicRoom(reg);
    expect(events).toHaveLength(1);
    expect(events[0].source).toBe(ctx.room.id);
  });

  it('refuses adopt() of an already-registered room id', () => {
    const { reg } = setup();
    const ctx = basicRoom(reg);
    expect(() => reg.adopt(ctx.room)).toThrow(/already/);
  });
});

describe('RoomRegistry participants', () => {
  it('addParticipant creates + emits collab.room.participant_joined', () => {
    const { reg, bus } = setup();
    const ctx = basicRoom(reg);
    const events: Array<MessageEnvelope<unknown>> = [];
    bus.subscribe('collab.room.participant_joined', e => events.push(e));

    const p = reg.addParticipant(ctx.room.id, {
      userId: 'alice',
      name: 'Alice',
      type: 'human',
      role: 'owner',
    });
    expect(p.role).toBe('owner');
    expect(reg.listParticipants(ctx.room.id)).toHaveLength(1);
    expect(events).toHaveLength(1);
  });

  it('removeParticipant returns false for unknown id', () => {
    const { reg } = setup();
    const ctx = basicRoom(reg);
    expect(reg.removeParticipant(ctx.room.id, 'ghost')).toBe(false);
  });

  it('removeParticipant returns true + emits left event', () => {
    const { reg, bus } = setup();
    const ctx = basicRoom(reg);
    const p = reg.addParticipant(ctx.room.id, {
      userId: 'alice',
      name: 'Alice',
      type: 'human',
    });

    const events: Array<MessageEnvelope<unknown>> = [];
    bus.subscribe('collab.room.participant_left', e => events.push(e));

    expect(reg.removeParticipant(ctx.room.id, p.id)).toBe(true);
    expect(reg.listParticipants(ctx.room.id)).toHaveLength(0);
    expect(events).toHaveLength(1);
  });

  it('throws on participant ops against unknown room', () => {
    const { reg } = setup();
    expect(() =>
      reg.addParticipant('ghost', {
        userId: 'a',
        name: 'A',
        type: 'human',
      }),
    ).toThrow(/Room not found/);
  });
});

describe('RoomRegistry mode + intent integration', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('forwards intent events to the bus with the roomId as source', () => {
    const { reg, bus } = setup();
    const ctx = basicRoom(reg);
    reg.setMode(ctx.room.id, 'auto', 'alice');

    const types: string[] = [];
    bus.subscribe('collab.ai.intent.*', e => types.push(e.type));

    const intent = ctx.intentEngine.propose({
      agentId: 'a-1',
      summary: 'read a file',
      type: 'file_read',
      action: { type: 'file_read', path: 'src/a.ts' },
      rationale: 'test',
      confidence: 1,
      risk: 'safe',
    });
    expect(intent.status).toBe('pending');

    // Auto mode + safe risk → countdown = 10s, then auto-approves.
    vi.advanceTimersByTime(11_000);
    expect(ctx.intentEngine.get(intent.id)?.status).toBe('approved');
    expect(types).toContain('collab.ai.intent.proposed');
    expect(types).toContain('collab.ai.intent.approved');
  });

  it('mode change publishes collab.permissions.mode.changed', () => {
    const { reg, bus } = setup();
    const ctx = basicRoom(reg);
    const events: Array<MessageEnvelope<unknown>> = [];
    bus.subscribe('collab.permissions.mode.*', e => events.push(e));

    reg.setMode(ctx.room.id, 'code', 'alice');
    expect(events).toHaveLength(1);
    expect(events[0].source).toBe(ctx.room.id);
  });
});

describe('RoomRegistry destroy', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('removes the room and stops forwarding events', () => {
    const { reg, bus } = setup();
    const ctx = basicRoom(reg);
    const before: string[] = [];
    bus.subscribe('collab.permissions.mode.*', e => before.push(e.type));

    reg.setMode(ctx.room.id, 'code', 'alice');
    expect(before).toHaveLength(1);

    expect(reg.destroy(ctx.room.id)).toBe(true);
    expect(reg.has(ctx.room.id)).toBe(false);

    // Destroying again is a no-op.
    expect(reg.destroy(ctx.room.id)).toBe(false);

    // Mode-manager events from destroyed room shouldn't reach the bus,
    // but the manager is still referenced by the test ctx — its bus
    // adapter has been disposed, so triggering it here should not
    // produce a new event.
    const after: string[] = [];
    bus.subscribe('collab.permissions.mode.*', e => after.push(e.type));
    ctx.modeManager.setMode('auto', 'alice');
    expect(after).toHaveLength(0);
  });

  it('destroyAll tears down every room', () => {
    const { reg } = setup();
    basicRoom(reg, 'A');
    basicRoom(reg, 'B');
    basicRoom(reg, 'C');
    expect(reg.size()).toBe(3);
    reg.destroyAll();
    expect(reg.size()).toBe(0);
  });
});

describe('RoomRegistry adopt', () => {
  it('registers an externally-constructed Room', async () => {
    const { reg } = setup();
    const { createRoom } = await import('@pram1t/mustard-collab-core');
    const room = createRoom({ name: 'External' }, 'alice');
    const ctx = reg.adopt(room);
    expect(ctx.room.id).toBe(room.id);
    expect(reg.has(room.id)).toBe(true);
  });
});
