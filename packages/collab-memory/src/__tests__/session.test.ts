import { describe, it, expect } from 'vitest';
import { SessionMemory } from '../session.js';
import type { SessionSummary } from '../types.js';

function fresh() {
  return new SessionMemory({ dbPath: ':memory:' });
}

describe('SessionMemory.createSession', () => {
  it('creates a session with a generated id', () => {
    const m = fresh();
    const id = m.createSession({ roomId: 'r-1' });
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(m.hasSession(id)).toBe(true);
  });

  it('honors a caller-supplied sessionId', () => {
    const m = fresh();
    m.createSession({ roomId: 'r-1', sessionId: 'custom-1' });
    expect(m.hasSession('custom-1')).toBe(true);
  });

  it('records start time and participant list', () => {
    const m = fresh();
    const start = new Date('2026-04-01T10:00:00Z');
    const id = m.createSession({
      roomId: 'r-1',
      startedAt: start,
      participants: ['a', 'b'],
    });

    const [s] = m.listSessions({ roomId: 'r-1' });
    expect(s.id).toBe(id);
    expect(s.startedAt.toISOString()).toBe(start.toISOString());
    expect(s.participants).toEqual(['a', 'b']);
    expect(s.endedAt).toBeNull();
  });
});

describe('SessionMemory.endSession', () => {
  it('sets endedAt', () => {
    const m = fresh();
    const id = m.createSession({ roomId: 'r-1' });
    const end = new Date('2026-04-01T11:00:00Z');
    m.endSession({ sessionId: id, endedAt: end });
    const [s] = m.listSessions({ roomId: 'r-1' });
    expect(s.endedAt?.toISOString()).toBe(end.toISOString());
  });
});

describe('SessionMemory entries', () => {
  it('appendEntry records a new entry and returns it', () => {
    const m = fresh();
    const id = m.createSession({ roomId: 'r-1' });
    const entry = m.appendEntry({
      sessionId: id,
      roomId: 'r-1',
      type: 'message',
      content: 'hi',
      participantId: 'alice',
    });
    expect(entry.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(entry.content).toBe('hi');
    expect(entry.metadata).toEqual({});
    expect(entry.createdAt).toBeInstanceOf(Date);
  });

  it('addMessage / addDecision / addAction shortcuts', () => {
    const m = fresh();
    const id = m.createSession({ roomId: 'r-1' });

    const msg = m.addMessage(id, 'r-1', 'alice', 'hello');
    const dec = m.addDecision(id, 'r-1', 'alice', 'pick Vitest', 'discussed pros/cons');
    const act = m.addAction(id, 'r-1', 'alice', 'ran tests', { exitCode: 0 });

    expect(msg.type).toBe('message');
    expect(dec.type).toBe('decision');
    expect(dec.metadata).toEqual({ context: 'discussed pros/cons' });
    expect(act.type).toBe('action');
    expect(act.metadata).toEqual({ exitCode: 0 });
  });

  it('getEntry returns the stored record with hydrated Date/metadata', () => {
    const m = fresh();
    const sid = m.createSession({ roomId: 'r-1' });
    const entry = m.appendEntry({
      sessionId: sid,
      roomId: 'r-1',
      type: 'note',
      content: 'hm',
      participantId: 'alice',
      metadata: { foo: 'bar' },
    });
    const got = m.getEntry(entry.id)!;
    expect(got.metadata).toEqual({ foo: 'bar' });
    expect(got.createdAt).toBeInstanceOf(Date);
  });

  it('getHistory returns entries in ascending createdAt order', async () => {
    const m = fresh();
    const sid = m.createSession({ roomId: 'r-1' });

    const a = m.addMessage(sid, 'r-1', 'alice', 'first');
    await new Promise(r => setTimeout(r, 2));
    const b = m.addMessage(sid, 'r-1', 'alice', 'second');
    await new Promise(r => setTimeout(r, 2));
    const c = m.addDecision(sid, 'r-1', 'alice', 'pick A');

    const history = m.getHistory(sid);
    expect(history.map(e => e.id)).toEqual([a.id, b.id, c.id]);
  });

  it('getHistory filter by type', () => {
    const m = fresh();
    const sid = m.createSession({ roomId: 'r-1' });
    m.addMessage(sid, 'r-1', 'alice', 'hi');
    m.addMessage(sid, 'r-1', 'alice', 'yo');
    m.addDecision(sid, 'r-1', 'alice', 'pick A');

    expect(m.getHistory(sid, { type: 'message' })).toHaveLength(2);
    expect(m.getHistory(sid, { type: 'decision' })).toHaveLength(1);
  });

  it('countEntries + limit', () => {
    const m = fresh();
    const sid = m.createSession({ roomId: 'r-1' });
    for (let i = 0; i < 5; i++) m.addMessage(sid, 'r-1', 'alice', String(i));
    expect(m.countEntries(sid)).toBe(5);
    expect(m.getHistory(sid, { limit: 3 })).toHaveLength(3);
  });

  it('cascade-deletes entries when the session is deleted', () => {
    const m = fresh();
    const sid = m.createSession({ roomId: 'r-1' });
    m.addMessage(sid, 'r-1', 'alice', 'hi');
    m.deleteSession(sid);
    expect(m.countEntries(sid)).toBe(0);
    expect(m.hasSession(sid)).toBe(false);
  });
});

describe('SessionMemory summaries', () => {
  function sampleSummary(over?: Partial<SessionSummary>): SessionSummary {
    return {
      sessionId: 's-1',
      roomId: 'r-1',
      summary: 'did stuff',
      decisions: ['picked Vitest', 'used SQLite'],
      filesModified: ['src/a.ts'],
      participants: ['alice', 'bob'],
      startedAt: new Date('2026-04-01T10:00:00Z'),
      endedAt: new Date('2026-04-01T11:00:00Z'),
      durationSeconds: 3600,
      ...over,
    };
  }

  it('stores and retrieves a summary', () => {
    const m = fresh();
    m.createSession({ roomId: 'r-1', sessionId: 's-1' });
    m.storeSummary(sampleSummary());

    const got = m.getSummary('s-1')!;
    expect(got.summary).toBe('did stuff');
    expect(got.decisions).toEqual(['picked Vitest', 'used SQLite']);
    expect(got.filesModified).toEqual(['src/a.ts']);
    expect(got.durationSeconds).toBe(3600);
    expect(got.startedAt).toBeInstanceOf(Date);
  });

  it('upserts on duplicate sessionId (latest wins)', () => {
    const m = fresh();
    m.createSession({ roomId: 'r-1', sessionId: 's-1' });
    m.storeSummary(sampleSummary({ summary: 'v1' }));
    m.storeSummary(sampleSummary({ summary: 'v2', durationSeconds: 9000 }));

    const got = m.getSummary('s-1')!;
    expect(got.summary).toBe('v2');
    expect(got.durationSeconds).toBe(9000);
  });

  it('listSummaries returns most recent first', () => {
    const m = fresh();
    for (let i = 0; i < 3; i++) {
      const sid = `s-${i}`;
      m.createSession({ roomId: 'r-1', sessionId: sid });
      m.storeSummary(
        sampleSummary({
          sessionId: sid,
          endedAt: new Date(`2026-04-0${i + 1}T12:00:00Z`),
          summary: `v${i}`,
        }),
      );
    }
    const list = m.listSummaries('r-1');
    expect(list.map(s => s.sessionId)).toEqual(['s-2', 's-1', 's-0']);
  });
});

describe('SessionMemory.listSessions', () => {
  it('filters by room and honors limit', () => {
    const m = fresh();
    m.createSession({ roomId: 'r-1', sessionId: 'a' });
    m.createSession({ roomId: 'r-1', sessionId: 'b' });
    m.createSession({ roomId: 'r-2', sessionId: 'c' });

    expect(m.listSessions({ roomId: 'r-1' })).toHaveLength(2);
    expect(m.listSessions({ roomId: 'r-1', limit: 1 })).toHaveLength(1);
    expect(m.listSessions()).toHaveLength(3);
  });
});

describe('SessionMemory with shared db handle', () => {
  it('does not close a caller-owned db on close()', async () => {
    // We can't easily assert the underlying Database.close was NOT called
    // cross-boundary, so assert semantics via a second instance on the same
    // in-memory db: they should see each other's data.
    const DB = (await import('better-sqlite3')).default;
    const db = new DB(':memory:');
    const a = new SessionMemory({ db });
    const b = new SessionMemory({ db });

    const sid = a.createSession({ roomId: 'r-1' });
    expect(b.hasSession(sid)).toBe(true);

    a.close(); // no-op because it doesn't own the db
    expect(b.hasSession(sid)).toBe(true); // still works
    db.close();
  });
});
