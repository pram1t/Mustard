import { describe, it, expect } from 'vitest';
import { SessionMemory } from '../session.js';
import { Summarizer, type CompleteFn } from '../summarizer.js';

function buildSession(extra?: (s: SessionMemory, sid: string) => void) {
  const s = new SessionMemory({ dbPath: ':memory:' });
  const sid = s.createSession({
    roomId: 'r-1',
    sessionId: 's-1',
    startedAt: new Date('2026-04-01T10:00:00Z'),
    participants: ['alice'],
  });
  s.addMessage(sid, 'r-1', 'alice', 'starting work');
  s.addDecision(sid, 'r-1', 'alice', 'Adopt Vitest for testing', 'fast + ESM native');
  s.addAction(sid, 'r-1', 'alice', 'wrote tests', { file: 'src/a.test.ts' });
  s.addAction(sid, 'r-1', 'bob', 'edited file', { path: 'src/b.ts' });
  s.addAction(sid, 'r-1', 'alice', 'bulk edit', { files: ['src/c.ts', 'src/d.ts'] });
  s.addDecision(sid, 'r-1', 'alice', 'Use Node 22');
  s.endSession({ sessionId: sid, endedAt: new Date('2026-04-01T11:00:00Z') });
  extra?.(s, sid);
  return { session: s, sid };
}

describe('Summarizer.summarize — heuristic mode (no LLM)', () => {
  it('produces a deterministic summary without calling any LLM', async () => {
    const { session, sid } = buildSession();
    const sum = new Summarizer({ session });
    const result = await sum.summarize({ sessionId: sid });

    expect(result.summary).toMatch(/Session contained/);
    expect(result.summary).toMatch(/Adopt Vitest/);
    expect(result.decisions).toEqual([
      'Adopt Vitest for testing',
      'Use Node 22',
    ]);
    expect(result.filesModified.sort()).toEqual([
      'src/a.test.ts',
      'src/b.ts',
      'src/c.ts',
      'src/d.ts',
    ]);
    expect(result.participants.sort()).toEqual(['alice', 'bob']);
    expect(result.durationSeconds).toBe(3600);
  });

  it('handles an empty session with a meaningful heuristic', async () => {
    const session = new SessionMemory({ dbPath: ':memory:' });
    session.createSession({ roomId: 'r-1', sessionId: 's-empty', startedAt: new Date() });
    const sum = new Summarizer({ session });
    const result = await sum.summarize({ sessionId: 's-empty' });
    expect(result.summary).toMatch(/no activity/i);
  });

  it('throws when the session id is unknown', async () => {
    const session = new SessionMemory({ dbPath: ':memory:' });
    const sum = new Summarizer({ session });
    await expect(sum.summarize({ sessionId: 'ghost' })).rejects.toThrow(
      /not found/,
    );
  });
});

describe('Summarizer.summarize — LLM-driven mode', () => {
  it('passes a prompt to the complete callback and uses its output', async () => {
    const { session, sid } = buildSession();
    const seen: string[] = [];
    const complete: CompleteFn = async (prompt: string) => {
      seen.push(prompt);
      return 'LLM-generated summary text.';
    };
    const sum = new Summarizer({ session, complete });
    const result = await sum.summarize({ sessionId: sid });

    expect(result.summary).toBe('LLM-generated summary text.');
    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatch(/Summarize the following coding session/);
    expect(seen[0]).toMatch(/Adopt Vitest/);
  });

  it('falls back to heuristic when LLM returns empty', async () => {
    const { session, sid } = buildSession();
    const complete: CompleteFn = async () => '   ';
    const sum = new Summarizer({ session, complete });
    const result = await sum.summarize({ sessionId: sid });
    expect(result.summary).toMatch(/Session contained/);
  });

  it('supports sync complete callbacks', async () => {
    const { session, sid } = buildSession();
    const complete: CompleteFn = () => 'sync result';
    const sum = new Summarizer({ session, complete });
    const result = await sum.summarize({ sessionId: sid });
    expect(result.summary).toBe('sync result');
  });

  it('truncates older entries when the prompt would exceed maxPromptTokens', async () => {
    const session = new SessionMemory({ dbPath: ':memory:' });
    const sid = session.createSession({
      roomId: 'r-1',
      sessionId: 's-1',
      startedAt: new Date('2026-04-01T10:00:00Z'),
    });
    for (let i = 0; i < 200; i++) {
      session.addMessage(sid, 'r-1', 'alice', 'x'.repeat(80) + `:msg-${i}`);
    }
    let seen = '';
    const sum = new Summarizer({
      session,
      maxPromptTokens: 300, // ~1200 chars budget
      complete: async p => {
        seen = p;
        return 'ok';
      },
    });
    await sum.summarize({ sessionId: sid });
    expect(seen).toMatch(/earlier events truncated/);
    // Should keep the most-recent messages.
    expect(seen).toMatch(/:msg-199/);
  });
});

describe('Summarizer persistence', () => {
  it('persists the summary via SessionMemory.storeSummary when persist=true', async () => {
    const { session, sid } = buildSession();
    const sum = new Summarizer({ session });
    await sum.summarize({ sessionId: sid, persist: true });

    const stored = session.getSummary(sid);
    expect(stored).toBeDefined();
    expect(stored?.decisions).toContain('Adopt Vitest for testing');
  });

  it('does not persist when persist is omitted or false', async () => {
    const { session, sid } = buildSession();
    const sum = new Summarizer({ session });
    await sum.summarize({ sessionId: sid });
    expect(session.getSummary(sid)).toBeUndefined();
  });
});

describe('Summarizer deterministic extraction', () => {
  it('collects files from action metadata (file / path / files[])', async () => {
    const session = new SessionMemory({ dbPath: ':memory:' });
    const sid = session.createSession({ roomId: 'r-1', sessionId: 's-1', startedAt: new Date() });
    session.addAction(sid, 'r-1', 'alice', 'A', { file: 'x.ts' });
    session.addAction(sid, 'r-1', 'alice', 'B', { path: 'y.ts' });
    session.addAction(sid, 'r-1', 'alice', 'C', { files: ['z.ts', 42, 'w.ts'] });
    session.addAction(sid, 'r-1', 'alice', 'D', { unrelated: 'meta' });

    const sum = new Summarizer({ session });
    const result = await sum.summarize({ sessionId: sid });
    expect(result.filesModified.sort()).toEqual(['w.ts', 'x.ts', 'y.ts', 'z.ts']);
  });

  it('merges participants from initial list + entries', async () => {
    const session = new SessionMemory({ dbPath: ':memory:' });
    const sid = session.createSession({
      roomId: 'r-1',
      sessionId: 's-1',
      startedAt: new Date(),
      participants: ['alice', 'carol'],
    });
    session.addMessage(sid, 'r-1', 'bob', 'hi');
    const sum = new Summarizer({ session });
    const result = await sum.summarize({ sessionId: sid });
    expect(result.participants.sort()).toEqual(['alice', 'bob', 'carol']);
  });
});
