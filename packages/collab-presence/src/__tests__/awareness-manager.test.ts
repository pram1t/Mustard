import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AwarenessManager } from '../awareness-manager.js';
import type { AwarenessState, AwarenessChangeEvent } from '../types.js';

function makeState(clientId: number, overrides?: Partial<AwarenessState>): AwarenessState {
  return {
    user: { id: `user-${clientId}`, name: `User ${clientId}`, color: '#000', type: 'human' },
    cursor: null,
    activity: 'active',
    lastActivity: Date.now(),
    clientId,
    ...overrides,
  };
}

describe('AwarenessManager', () => {
  let mgr: AwarenessManager;

  beforeEach(() => {
    mgr = new AwarenessManager();
  });
  afterEach(() => mgr.destroy());

  it('should start empty', () => {
    expect(mgr.size).toBe(0);
    expect(mgr.getAllStates().size).toBe(0);
  });

  it('should set and get state', () => {
    const state = makeState(1);
    mgr.setLocalState(1, state);

    expect(mgr.size).toBe(1);
    expect(mgr.getState(1)?.user.name).toBe('User 1');
  });

  it('should emit change event on add', () => {
    const events: AwarenessChangeEvent[] = [];
    mgr.on('change', (e: unknown) => events.push(e as AwarenessChangeEvent));

    mgr.setLocalState(1, makeState(1));

    expect(events.length).toBe(1);
    expect(events[0].added).toEqual([1]);
    expect(events[0].updated).toEqual([]);
  });

  it('should emit change event on update', () => {
    mgr.setLocalState(1, makeState(1));

    const events: AwarenessChangeEvent[] = [];
    mgr.on('change', (e: unknown) => events.push(e as AwarenessChangeEvent));

    mgr.setLocalState(1, makeState(1, { activity: 'typing' }));

    expect(events.length).toBe(1);
    expect(events[0].updated).toEqual([1]);
    expect(events[0].added).toEqual([]);
  });

  it('should emit change event on remove', () => {
    mgr.setLocalState(1, makeState(1));

    const events: AwarenessChangeEvent[] = [];
    mgr.on('change', (e: unknown) => events.push(e as AwarenessChangeEvent));

    mgr.removeState(1);

    expect(events.length).toBe(1);
    expect(events[0].removed).toEqual([1]);
    expect(mgr.size).toBe(0);
  });

  it('should return undefined for unknown client', () => {
    expect(mgr.getState(999)).toBeUndefined();
  });

  it('updateCursor should update only the cursor', () => {
    mgr.setLocalState(1, makeState(1));
    mgr.updateCursor(1, { file: 'a.ts', line: 10, column: 5 });

    const state = mgr.getState(1)!;
    expect(state.cursor?.file).toBe('a.ts');
    expect(state.cursor?.line).toBe(10);
    expect(state.user.name).toBe('User 1'); // unchanged
  });

  it('updateActivity should update only the activity', () => {
    mgr.setLocalState(1, makeState(1));
    mgr.updateActivity(1, 'typing');

    expect(mgr.getState(1)!.activity).toBe('typing');
  });

  it('updateIntent should set/clear intent', () => {
    mgr.setLocalState(1, makeState(1));
    mgr.updateIntent(1, { summary: 'editing file', type: 'file_edit', confidence: 0.9, status: 'pending' });

    expect(mgr.getState(1)!.intent?.summary).toBe('editing file');

    mgr.updateIntent(1, undefined);
    expect(mgr.getState(1)!.intent).toBeUndefined();
  });

  it('nextColor returns different colors', () => {
    const c1 = mgr.nextColor();
    const c2 = mgr.nextColor();
    const c3 = mgr.nextColor();
    expect(c1).not.toBe(c2);
    expect(c2).not.toBe(c3);
  });

  it('createInitialState assigns color', () => {
    const state = mgr.createInitialState(
      { id: 'u1', name: 'Alice', color: '', type: 'human' },
      1,
    );
    expect(state.user.color).not.toBe('');
    expect(state.activity).toBe('active');
    expect(state.clientId).toBe(1);
  });

  it('getStatesForFile filters by cursor file', () => {
    mgr.setLocalState(1, makeState(1, { cursor: { file: 'a.ts', line: 1, column: 1 } }));
    mgr.setLocalState(2, makeState(2, { cursor: { file: 'b.ts', line: 1, column: 1 } }));
    mgr.setLocalState(3, makeState(3, { cursor: { file: 'a.ts', line: 5, column: 1 } }));

    const states = mgr.getStatesForFile('a.ts');
    expect(states.length).toBe(2);
  });

  it('getAIStates filters AI participants', () => {
    mgr.setLocalState(1, makeState(1));
    mgr.setLocalState(2, makeState(2, {
      user: { id: 'agent-1', name: 'AI', color: '#fff', type: 'ai' },
    }));

    const aiStates = mgr.getAIStates();
    expect(aiStates.length).toBe(1);
    expect(aiStates[0].user.type).toBe('ai');
  });

  it('removeStale removes old entries', () => {
    vi.useFakeTimers();
    const now = Date.now();

    mgr.setLocalState(1, makeState(1, { lastActivity: now - 60_000 })); // 60s ago
    mgr.setLocalState(2, makeState(2, { lastActivity: now })); // just now

    const removed = mgr.removeStale();
    expect(removed).toEqual([1]);
    expect(mgr.size).toBe(1);

    vi.useRealTimers();
  });

  it('on returns unsubscribe function', () => {
    const calls: unknown[] = [];
    const unsub = mgr.on('change', (e: unknown) => calls.push(e));

    mgr.setLocalState(1, makeState(1));
    expect(calls.length).toBe(1);

    unsub();
    mgr.setLocalState(2, makeState(2));
    expect(calls.length).toBe(1); // no new call
  });
});
