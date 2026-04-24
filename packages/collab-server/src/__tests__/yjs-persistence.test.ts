import { describe, it, expect } from 'vitest';
import * as Y from 'yjs';
import {
  SqliteYjsPersistence,
  createYjsPersistence,
} from '../yjs-persistence.js';

function fresh() {
  return new SqliteYjsPersistence({ dbPath: ':memory:', flushDebounceMs: 0 });
}

describe('SqliteYjsPersistence — direct API', () => {
  it('flushes a doc and reloads identical bytes', () => {
    const p = fresh();
    const doc = new Y.Doc();
    doc.getText('t').insert(0, 'hello world');
    p.flushNow('room-1', doc);

    expect(p.has('room-1')).toBe(true);
    const bytes = p.loadStateBytes('room-1');
    expect(bytes).toBeInstanceOf(Uint8Array);

    const restored = new Y.Doc();
    Y.applyUpdate(restored, bytes!);
    expect(restored.getText('t').toString()).toBe('hello world');
  });

  it('list returns stored doc names', () => {
    const p = fresh();
    p.flushNow('a', new Y.Doc());
    p.flushNow('b', new Y.Doc());
    expect(p.list().sort()).toEqual(['a', 'b']);
  });

  it('remove deletes a snapshot and reports the change', () => {
    const p = fresh();
    p.flushNow('a', new Y.Doc());
    expect(p.remove('a')).toBe(true);
    expect(p.remove('a')).toBe(false);
    expect(p.has('a')).toBe(false);
  });
});

describe('SqliteYjsPersistence — bindState lifecycle', () => {
  it('loads prior state into a fresh ydoc', () => {
    const p = fresh();
    // Seed storage
    const seed = new Y.Doc();
    seed.getText('t').insert(0, 'seed');
    p.flushNow('room-2', seed);

    // New ydoc binds and inherits the prior state
    const live = new Y.Doc();
    p.bindState('room-2', live);
    expect(live.getText('t').toString()).toBe('seed');
  });

  it('persists subsequent updates after binding', async () => {
    const p = fresh();
    const live = new Y.Doc();
    p.bindState('room-3', live);

    live.getText('t').insert(0, 'after-bind');
    // flushDebounceMs=0 → setTimeout fires on next tick
    await new Promise(r => setTimeout(r, 5));

    const restored = new Y.Doc();
    Y.applyUpdate(restored, p.loadStateBytes('room-3')!);
    expect(restored.getText('t').toString()).toBe('after-bind');
  });

  it('detach stops persistence on subsequent updates', async () => {
    const p = fresh();
    const live = new Y.Doc();
    p.bindState('room-4', live);

    live.getText('t').insert(0, 'first');
    await new Promise(r => setTimeout(r, 5));

    p.detach('room-4');

    live.getText('t').insert(0, 'should-not-persist-');
    await new Promise(r => setTimeout(r, 5));

    const restored = new Y.Doc();
    Y.applyUpdate(restored, p.loadStateBytes('room-4')!);
    expect(restored.getText('t').toString()).toBe('first');
  });

  it('writeState is a final flush + detach', async () => {
    const p = fresh();
    const live = new Y.Doc();
    p.bindState('room-5', live);
    live.getText('t').insert(0, 'final');

    await p.writeState('room-5', live);

    // Subsequent updates do NOT persist
    live.getText('t').insert(0, 'orphan-');
    await new Promise(r => setTimeout(r, 10));

    const restored = new Y.Doc();
    Y.applyUpdate(restored, p.loadStateBytes('room-5')!);
    expect(restored.getText('t').toString()).toBe('final');
  });

  it('re-binding the same docName replaces the prior subscription', async () => {
    const p = fresh();
    const a = new Y.Doc();
    const b = new Y.Doc();
    p.bindState('room-6', a);
    p.bindState('room-6', b);

    // Updating `a` should NOT persist (its handler was detached on rebind)
    a.getText('t').insert(0, 'from-a');
    await new Promise(r => setTimeout(r, 5));

    expect(p.loadStateBytes('room-6')).toBeNull();

    // Updating `b` persists
    b.getText('t').insert(0, 'from-b');
    await new Promise(r => setTimeout(r, 5));

    const restored = new Y.Doc();
    Y.applyUpdate(restored, p.loadStateBytes('room-6')!);
    expect(restored.getText('t').toString()).toBe('from-b');
  });
});

describe('createYjsPersistence — y-websocket compatible shape', () => {
  it('exposes bindState + writeState + provider', () => {
    const persistence = createYjsPersistence({ flushDebounceMs: 0 });
    expect(typeof persistence.bindState).toBe('function');
    expect(typeof persistence.writeState).toBe('function');
    expect(persistence.provider).toBeInstanceOf(SqliteYjsPersistence);
  });

  it('round-trips state via the y-websocket interface', async () => {
    const persistence = createYjsPersistence({ flushDebounceMs: 0 });
    const doc = new Y.Doc();
    persistence.bindState('room-7', doc);
    doc.getText('t').insert(0, 'round-trip');
    await new Promise(r => setTimeout(r, 5));

    const restored = new Y.Doc();
    persistence.bindState('room-7', restored);
    expect(restored.getText('t').toString()).toBe('round-trip');
  });
});

describe('SqliteYjsPersistence — debounce', () => {
  it('coalesces rapid updates into a single later write', async () => {
    const p = new SqliteYjsPersistence({
      dbPath: ':memory:',
      flushDebounceMs: 30,
    });
    const live = new Y.Doc();
    p.bindState('room-8', live);

    for (let i = 0; i < 10; i++) live.getText('t').insert(0, 'x');

    // Immediately after, nothing has been written yet (debounce)
    expect(p.loadStateBytes('room-8')).toBeNull();

    await new Promise(r => setTimeout(r, 60));
    const restored = new Y.Doc();
    Y.applyUpdate(restored, p.loadStateBytes('room-8')!);
    expect(restored.getText('t').toString().length).toBe(10);
  });
});
