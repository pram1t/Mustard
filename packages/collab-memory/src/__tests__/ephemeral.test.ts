import { describe, it, expect } from 'vitest';
import { EphemeralMemory } from '../ephemeral.js';
import type { CursorSnapshot, IntentSnapshot, ThreadMessage } from '../types.js';

function cursor(over?: Partial<CursorSnapshot>): CursorSnapshot {
  return {
    participantId: 'p-1',
    file: 'src/a.ts',
    line: 10,
    column: 5,
    timestamp: 0,
    ...over,
  };
}

function intent(over?: Partial<IntentSnapshot>): IntentSnapshot {
  return {
    intentId: 'i-1',
    agentId: 'a-1',
    summary: 'test',
    status: 'pending',
    timestamp: 0,
    ...over,
  };
}

function msg(over?: Partial<ThreadMessage>): ThreadMessage {
  return {
    id: 'm-1',
    participantId: 'p-1',
    participantName: 'Alice',
    content: 'hi',
    timestamp: 0,
    ...over,
  };
}

describe('EphemeralMemory cursors', () => {
  it('set + get + list return independent copies', () => {
    const m = new EphemeralMemory();
    m.cursorSet(cursor({ participantId: 'p-1' }));
    m.cursorSet(cursor({ participantId: 'p-2', file: 'src/b.ts' }));

    expect(m.cursorList()).toHaveLength(2);
    expect(m.cursorGet('p-2')?.file).toBe('src/b.ts');

    // Mutate the returned copy; internal state should be unchanged.
    const c = m.cursorGet('p-1')!;
    c.line = 999;
    expect(m.cursorGet('p-1')?.line).toBe(10);
  });

  it('set replaces an existing cursor for the same participant', () => {
    const m = new EphemeralMemory();
    m.cursorSet(cursor({ line: 10 }));
    m.cursorSet(cursor({ line: 42 }));
    expect(m.cursorList()).toHaveLength(1);
    expect(m.cursorGet('p-1')?.line).toBe(42);
  });

  it('remove is a no-op for unknown ids', () => {
    const m = new EphemeralMemory();
    expect(() => m.cursorRemove('ghost')).not.toThrow();
  });

  it('remove fires the cursor_removed event only when something changed', () => {
    const m = new EphemeralMemory();
    const events: unknown[] = [];
    m.on('cursor_removed', p => events.push(p));
    m.cursorRemove('ghost');
    expect(events).toHaveLength(0);

    m.cursorSet(cursor());
    m.cursorRemove('p-1');
    expect(events).toHaveLength(1);
  });
});

describe('EphemeralMemory intents', () => {
  it('keyed by intentId, set replaces', () => {
    const m = new EphemeralMemory();
    m.intentSet(intent({ status: 'pending' }));
    m.intentSet(intent({ status: 'approved' }));
    expect(m.intentList()).toHaveLength(1);
    expect(m.intentGet('i-1')?.status).toBe('approved');
  });

  it('list returns copies', () => {
    const m = new EphemeralMemory();
    m.intentSet(intent());
    const list = m.intentList();
    list[0].status = 'corrupted';
    expect(m.intentGet('i-1')?.status).toBe('pending');
  });

  it('remove clears the entry', () => {
    const m = new EphemeralMemory();
    m.intentSet(intent());
    m.intentRemove('i-1');
    expect(m.intentList()).toEqual([]);
  });
});

describe('EphemeralMemory thread', () => {
  it('appends in order', () => {
    const m = new EphemeralMemory();
    m.appendMessage(msg({ id: 'a', content: 'hi' }));
    m.appendMessage(msg({ id: 'b', content: 'yo' }));
    expect(m.threadList().map(x => x.id)).toEqual(['a', 'b']);
  });

  it('evicts oldest entries past maxThreadMessages', () => {
    const m = new EphemeralMemory({ maxThreadMessages: 3 });
    for (let i = 0; i < 5; i++) m.appendMessage(msg({ id: String(i) }));
    expect(m.threadList().map(x => x.id)).toEqual(['2', '3', '4']);
    expect(m.threadSize()).toBe(3);
  });

  it('threadRecent returns the tail', () => {
    const m = new EphemeralMemory();
    for (let i = 0; i < 5; i++) m.appendMessage(msg({ id: String(i) }));
    expect(m.threadRecent(2).map(x => x.id)).toEqual(['3', '4']);
    expect(m.threadRecent(0)).toEqual([]);
  });

  it('threadList returns copies that cannot mutate internal state', () => {
    const m = new EphemeralMemory();
    m.appendMessage(msg());
    const list = m.threadList();
    list[0].content = 'hacked';
    expect(m.threadList()[0].content).toBe('hi');
  });
});

describe('EphemeralMemory snapshot + clear', () => {
  it('snapshot returns a full independent copy', () => {
    const m = new EphemeralMemory();
    m.cursorSet(cursor());
    m.intentSet(intent());
    m.appendMessage(msg());

    const snap = m.snapshot();
    expect(snap.cursors.size).toBe(1);
    expect(snap.intents.size).toBe(1);
    expect(snap.thread).toHaveLength(1);

    // Mutation isolation
    snap.cursors.clear();
    snap.intents.clear();
    snap.thread.length = 0;
    expect(m.cursorList()).toHaveLength(1);
    expect(m.intentList()).toHaveLength(1);
    expect(m.threadList()).toHaveLength(1);
  });

  it('clear wipes everything and emits', () => {
    const m = new EphemeralMemory();
    m.cursorSet(cursor());
    m.intentSet(intent());
    m.appendMessage(msg());

    const events: unknown[] = [];
    m.on('cleared', p => events.push(p));

    m.clear();

    expect(m.cursorList()).toEqual([]);
    expect(m.intentList()).toEqual([]);
    expect(m.threadList()).toEqual([]);
    expect(events).toHaveLength(1);
  });
});

describe('EphemeralMemory listeners', () => {
  it('unsubscribe works', () => {
    const m = new EphemeralMemory();
    const events: unknown[] = [];
    const unsub = m.on('cursor_set', p => events.push(p));
    m.cursorSet(cursor());
    unsub();
    m.cursorSet(cursor({ participantId: 'p-2' }));
    expect(events).toHaveLength(1);
  });

  it('swallows listener errors', () => {
    const m = new EphemeralMemory();
    const ok: unknown[] = [];
    m.on('cursor_set', () => {
      throw new Error('boom');
    });
    m.on('cursor_set', p => ok.push(p));
    expect(() => m.cursorSet(cursor())).not.toThrow();
    expect(ok).toHaveLength(1);
  });
});
