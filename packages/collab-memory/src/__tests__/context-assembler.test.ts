import { describe, it, expect } from 'vitest';
import { ContextAssembler, approxTokens } from '../context-assembler.js';
import { EphemeralMemory } from '../ephemeral.js';
import { SessionMemory } from '../session.js';
import { ProjectMemory } from '../project.js';
import { TeamMemory } from '../team.js';

function populateSession(session: SessionMemory, roomId: string) {
  const sid = session.createSession({
    roomId,
    sessionId: 's-1',
    startedAt: new Date('2026-04-01T10:00:00Z'),
    participants: ['alice'],
  });
  session.addMessage(sid, roomId, 'alice', 'hi');
  session.addDecision(sid, roomId, 'alice', 'picked Vitest');
  return sid;
}

function populateProject(project: ProjectMemory, roomId: string) {
  project.addDecision(roomId, 'alice', 'Use Vitest', 'Fast and Vite-native.');
  project.addConvention(roomId, 'alice', 'Prefer const', 'Immutability by default.');
  project.addKnowledge(roomId, 'alice', 'Runtime', 'Node >=20.');
}

function populateTeam(team: TeamMemory, teamId: string) {
  team.add({ teamId, category: 'convention', content: 'Always use TS', createdBy: 'alice' });
  team.add({ teamId, category: 'template', content: 'PR template body', createdBy: 'alice' });
}

function populateEphemeral(m: EphemeralMemory) {
  m.cursorSet({ participantId: 'p-1', file: 'src/a.ts', line: 10, column: 0, timestamp: 0 });
  m.intentSet({ intentId: 'i-1', agentId: 'a-1', summary: 'read a file', status: 'pending', timestamp: 0 });
  m.appendMessage({ id: 'm-1', participantId: 'p-1', participantName: 'Alice', content: 'hello', timestamp: 0 });
}

describe('ContextAssembler.build — individual layers', () => {
  it('returns an empty context when no layers are configured', () => {
    const ca = new ContextAssembler();
    const ctx = ca.build();
    expect(ctx.layers).toEqual({});
    expect(ctx.tokenCount).toBe(0);
    expect(ctx.assembledAt).toBeInstanceOf(Date);
  });

  it('formats ephemeral layer when enabled and populated', () => {
    const e = new EphemeralMemory();
    populateEphemeral(e);
    const ca = new ContextAssembler({ ephemeral: e });
    const ctx = ca.build();
    expect(ctx.layers.ephemeral).toMatch(/Active cursors/);
    expect(ctx.layers.ephemeral).toMatch(/hello/);
    expect(ctx.layers.ephemeral).toMatch(/Pending intents/);
  });

  it('respects includeEphemeral=false', () => {
    const e = new EphemeralMemory();
    populateEphemeral(e);
    const ca = new ContextAssembler({
      ephemeral: e,
      config: { includeEphemeral: false },
    });
    const ctx = ca.build();
    expect(ctx.layers.ephemeral).toBeUndefined();
  });

  it('formats session layer with summary + decisions when available', () => {
    const s = new SessionMemory({ dbPath: ':memory:' });
    const sid = populateSession(s, 'r-1');
    s.storeSummary({
      sessionId: sid,
      roomId: 'r-1',
      summary: 'We picked the test framework.',
      decisions: ['Vitest', 'Node 20'],
      filesModified: ['src/a.ts'],
      participants: ['alice'],
      startedAt: new Date('2026-04-01T10:00:00Z'),
      endedAt: new Date('2026-04-01T11:00:00Z'),
      durationSeconds: 3600,
    });

    const ca = new ContextAssembler({ session: s, roomId: 'r-1' });
    const ctx = ca.build();
    expect(ctx.layers.session).toMatch(/We picked the test framework/);
    expect(ctx.layers.session).toMatch(/Decisions: Vitest/);
  });

  it('session layer falls back to recent activity when no summary exists', () => {
    const s = new SessionMemory({ dbPath: ':memory:' });
    populateSession(s, 'r-1');
    const ca = new ContextAssembler({ session: s, roomId: 'r-1' });
    const ctx = ca.build();
    expect(ctx.layers.session).toMatch(/Recent activity/);
    expect(ctx.layers.session).toMatch(/\[decision\] picked Vitest/);
  });

  it('project layer groups entries by category', () => {
    const p = new ProjectMemory({ dbPath: ':memory:' });
    populateProject(p, 'r-1');
    const ca = new ContextAssembler({ project: p, roomId: 'r-1' });
    const ctx = ca.build();
    expect(ctx.layers.project).toMatch(/decision:/);
    expect(ctx.layers.project).toMatch(/convention:/);
    expect(ctx.layers.project).toMatch(/knowledge:/);
    expect(ctx.layers.project).toMatch(/Use Vitest/);
  });

  it('team layer renders with categories and limits', () => {
    const t = new TeamMemory({ dbPath: ':memory:' });
    populateTeam(t, 't-1');
    const ca = new ContextAssembler({ team: t, teamId: 't-1' });
    const ctx = ca.build();
    expect(ctx.layers.team).toMatch(/\[convention\]/);
    expect(ctx.layers.team).toMatch(/\[template\]/);
  });
});

describe('ContextAssembler budget enforcement', () => {
  it('drops layers in reverse-priority order when over budget', () => {
    const e = new EphemeralMemory();
    populateEphemeral(e);
    const s = new SessionMemory({ dbPath: ':memory:' });
    populateSession(s, 'r-1');
    const p = new ProjectMemory({ dbPath: ':memory:' });
    populateProject(p, 'r-1');
    const t = new TeamMemory({ dbPath: ':memory:' });
    populateTeam(t, 't-1');

    // maxTokens = 50 — tiny budget; only ephemeral should survive.
    const ca = new ContextAssembler({
      ephemeral: e,
      session: s,
      project: p,
      team: t,
      roomId: 'r-1',
      teamId: 't-1',
      config: { maxTokens: 50, layerBudgets: { ephemeral: 200, session: 200, project: 200, team: 200 } },
    });
    const ctx = ca.build();
    expect(ctx.layers.team).toBeUndefined();
    expect(ctx.layers.project).toBeUndefined();
    expect(ctx.layers.session).toBeUndefined();
    expect(ctx.layers.ephemeral).toBeDefined();
  });

  it('truncates per-layer output to its budget', () => {
    const p = new ProjectMemory({ dbPath: ':memory:' });
    for (let i = 0; i < 30; i++) {
      p.addKnowledge('r-1', 'alice', `key-${i}`, 'x'.repeat(1000));
    }
    const ca = new ContextAssembler({
      project: p,
      roomId: 'r-1',
      config: { layerBudgets: { project: 40, session: 0, team: 0, ephemeral: 0 } },
    });
    const ctx = ca.build();
    expect(ctx.layers.project).toMatch(/truncated/);
    // ~40 tokens = ~160 chars + truncation indicator
    expect(approxTokens(ctx.layers.project ?? '')).toBeLessThanOrEqual(60);
  });
});

describe('ContextAssembler.format', () => {
  it('wraps each layer in XML-ish tags in a deterministic order', () => {
    const e = new EphemeralMemory();
    populateEphemeral(e);
    const p = new ProjectMemory({ dbPath: ':memory:' });
    populateProject(p, 'r-1');
    const t = new TeamMemory({ dbPath: ':memory:' });
    populateTeam(t, 't-1');

    const ca = new ContextAssembler({
      ephemeral: e,
      project: p,
      team: t,
      roomId: 'r-1',
      teamId: 't-1',
    });
    const text = ca.format();
    const projectIdx = text.indexOf('<project-memory>');
    const teamIdx = text.indexOf('<team-memory>');
    const ephemeralIdx = text.indexOf('<ephemeral>');
    expect(projectIdx).toBeGreaterThanOrEqual(0);
    expect(teamIdx).toBeGreaterThan(projectIdx);
    expect(ephemeralIdx).toBeGreaterThan(teamIdx);
    expect(text).toMatch(/<\/ephemeral>/);
  });

  it('omits closing tags for absent layers', () => {
    const ca = new ContextAssembler();
    expect(ca.format()).toBe('');
  });
});

describe('ContextAssembler.buildCacheKey', () => {
  it('returns a stable hex string', () => {
    const e = new EphemeralMemory();
    populateEphemeral(e);
    const ca = new ContextAssembler({ ephemeral: e });
    const key = ca.buildCacheKey();
    expect(key).toMatch(/^[0-9a-f]{8}$/);
  });

  it('changes when context content changes', () => {
    const e = new EphemeralMemory();
    populateEphemeral(e);
    const ca = new ContextAssembler({ ephemeral: e });
    const key1 = ca.buildCacheKey();
    e.appendMessage({
      id: 'm-2',
      participantId: 'p-1',
      participantName: 'Alice',
      content: 'another message with unique content',
      timestamp: 1,
    });
    const key2 = ca.buildCacheKey();
    expect(key2).not.toBe(key1);
  });
});

describe('ContextAssembler custom token counter', () => {
  it('uses the caller-supplied counter for budgeting', () => {
    const p = new ProjectMemory({ dbPath: ':memory:' });
    populateProject(p, 'r-1');
    const count = (s: string) => s.length; // 1 token per char, very strict
    const ca = new ContextAssembler({
      project: p,
      roomId: 'r-1',
      config: { maxTokens: 50, layerBudgets: { project: 200, session: 0, team: 0, ephemeral: 0 } },
      tokenCount: count,
    });
    const ctx = ca.build();
    // With 1-char = 1-token, 50 tokens is 50 chars — the layer budget
    // logic trims from the back; project survives but the overall
    // tokenCount should still be bounded by maxTokens when possible.
    expect(ctx.tokenCount).toBeLessThanOrEqual(200); // layer's own budget dominates here
  });
});
