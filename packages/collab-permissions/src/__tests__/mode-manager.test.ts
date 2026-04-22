import { describe, it, expect } from 'vitest';
import { ModeManager } from '../mode-manager.js';
import type { ModeChangeEvent } from '../types.js';

describe('ModeManager initialization', () => {
  it('defaults to plan mode and system actor', () => {
    const m = new ModeManager({ roomId: 'r-1' });
    expect(m.current()).toBe('plan');
    const s = m.getState();
    expect(s.current).toBe('plan');
    expect(s.setBy).toBe('system');
    expect(s.previous).toBeUndefined();
    expect(s.setAt).toBeInstanceOf(Date);
  });

  it('honors initialMode and initialSetBy', () => {
    const m = new ModeManager({
      roomId: 'r-1',
      initialMode: 'auto',
      initialSetBy: 'user-1',
    });
    expect(m.current()).toBe('auto');
    expect(m.getState().setBy).toBe('user-1');
  });

  it('exposes the capability block for the current mode', () => {
    const m = new ModeManager({ roomId: 'r-1', initialMode: 'code' });
    expect(m.capabilities().canWrite).toBe(true);
    expect(m.capabilities().autoApproveSafe).toBe(false);
  });

  it('stores the roomId', () => {
    const m = new ModeManager({ roomId: 'r-42' });
    expect(m.getRoomId()).toBe('r-42');
  });
});

describe('ModeManager.setMode', () => {
  it('transitions to a new mode and emits a change event', () => {
    const m = new ModeManager({ roomId: 'r-1' });
    const events: ModeChangeEvent[] = [];
    m.on('changed', e => events.push(e));

    const result = m.setMode('code', 'user-1');

    expect(result).not.toBeNull();
    expect(result?.oldMode).toBe('plan');
    expect(result?.newMode).toBe('code');
    expect(result?.changedBy).toBe('user-1');
    expect(result?.roomId).toBe('r-1');
    expect(events).toHaveLength(1);
    expect(m.current()).toBe('code');
    expect(m.getState().previous).toBe('plan');
  });

  it('is a no-op (and emits nothing) when set to the same mode', () => {
    const m = new ModeManager({ roomId: 'r-1', initialMode: 'code' });
    const events: ModeChangeEvent[] = [];
    m.on('changed', e => events.push(e));

    const result = m.setMode('code', 'user-1');
    expect(result).toBeNull();
    expect(events).toHaveLength(0);
  });

  it('tracks previous mode across multiple switches', () => {
    const m = new ModeManager({ roomId: 'r-1' });
    m.setMode('code', 'u');
    m.setMode('auto', 'u');
    expect(m.current()).toBe('auto');
    expect(m.getState().previous).toBe('code');
  });
});

describe('ModeManager.undo', () => {
  it('returns to the previous mode', () => {
    const m = new ModeManager({ roomId: 'r-1' });
    m.setMode('code', 'u');
    m.setMode('auto', 'u');

    const result = m.undo('u');
    expect(result?.newMode).toBe('code');
    expect(m.current()).toBe('code');
  });

  it('is a no-op if there is no previous mode', () => {
    const m = new ModeManager({ roomId: 'r-1' });
    expect(m.undo('u')).toBeNull();
  });
});

describe('ModeManager listeners', () => {
  it('returns an unsubscribe function', () => {
    const m = new ModeManager({ roomId: 'r-1' });
    const events: ModeChangeEvent[] = [];
    const unsub = m.on('changed', e => events.push(e));

    m.setMode('code', 'u');
    unsub();
    m.setMode('auto', 'u');

    expect(events).toHaveLength(1);
  });

  it('swallows listener errors', () => {
    const m = new ModeManager({ roomId: 'r-1' });
    const ok: ModeChangeEvent[] = [];
    m.on('changed', () => {
      throw new Error('boom');
    });
    m.on('changed', e => ok.push(e));

    expect(() => m.setMode('code', 'u')).not.toThrow();
    expect(ok).toHaveLength(1);
  });
});

describe('ModeManager.getState copy semantics', () => {
  it('returns a snapshot that does not mutate internal state', () => {
    const m = new ModeManager({ roomId: 'r-1' });
    const s = m.getState();
    s.current = 'auto';
    expect(m.current()).toBe('plan');
  });
});
