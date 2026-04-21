import { describe, it, expect } from 'vitest';
import { ContextBridge } from '../context-bridge.js';
import type {
  RoomProvider,
  ParticipantProvider,
  KnowledgeProvider,
  TaskProvider,
} from '../context-bridge.js';
import type {
  ActionContext,
  ParticipantContext,
  ProjectKnowledge,
  TaskContext,
} from '../types.js';

function roomProvider(over?: Partial<ReturnType<RoomProvider['getRoom']>>, stats?: ReturnType<RoomProvider['getFileStats']>): RoomProvider {
  return {
    getRoom: () => ({
      id: 'room-1',
      name: 'Demo',
      projectPath: '/repo/demo',
      currentMode: 'code',
      ...over,
    }),
    getFileStats: () => stats ?? { fileCount: 12, activeFiles: ['src/a.ts', 'src/b.ts'] },
  };
}

function participantsProvider(list: ParticipantContext[]): ParticipantProvider {
  return { list: () => list };
}

function makeParticipant(over?: Partial<ParticipantContext>): ParticipantContext {
  return {
    id: 'p-1',
    name: 'Alice',
    type: 'human',
    activity: 'active',
    ...over,
  };
}

describe('ContextBridge.build', () => {
  it('assembles a full AIContext from all providers', () => {
    const knowledge: ProjectKnowledge = {
      summary: 'A test project',
      keyFiles: ['README.md'],
      architecture: 'layered',
      conventions: ['prefer const'],
      recentDecisions: ['adopted Vitest'],
    };
    const task: TaskContext = {
      description: 'add auth middleware',
      conversationSummary: 'discussing JWT vs session',
      relevantFiles: ['src/auth.ts'],
    };

    const bridge = new ContextBridge({
      room: roomProvider(),
      participants: participantsProvider([
        makeParticipant({ id: 'p-1', name: 'Alice', currentFile: 'src/a.ts' }),
        makeParticipant({ id: 'p-2', name: 'Agent-1', type: 'ai', activity: 'typing' }),
      ]),
      knowledge: { get: () => knowledge },
      task: { current: () => task },
    });

    const ctx = bridge.build();

    expect(ctx.room.id).toBe('room-1');
    expect(ctx.room.fileCount).toBe(12);
    expect(ctx.room.activeFiles).toEqual(['src/a.ts', 'src/b.ts']);
    expect(ctx.participants).toHaveLength(2);
    expect(ctx.participants[1].type).toBe('ai');
    expect(ctx.projectKnowledge.summary).toBe('A test project');
    expect(ctx.currentTask.description).toBe('add auth middleware');
  });

  it('falls back to empty knowledge and task when providers are absent', () => {
    const bridge = new ContextBridge({
      room: roomProvider(),
      participants: participantsProvider([]),
    });

    const ctx = bridge.build();

    expect(ctx.projectKnowledge.summary).toBe('');
    expect(ctx.projectKnowledge.keyFiles).toEqual([]);
    expect(ctx.currentTask.description).toBe('');
    expect(ctx.currentTask.relevantFiles).toEqual([]);
  });
});

describe('ContextBridge.recordAction ring buffer', () => {
  it('records actions in order', () => {
    const bridge = new ContextBridge({
      room: roomProvider(),
      participants: participantsProvider([]),
    });

    const a1: ActionContext = {
      participantId: 'p-1',
      participantName: 'Alice',
      action: 'edit',
      target: 'src/a.ts',
      timestamp: 1,
    };
    const a2: ActionContext = {
      participantId: 'p-2',
      participantName: 'Bob',
      action: 'read',
      timestamp: 2,
    };

    bridge.recordAction(a1);
    bridge.recordAction(a2);

    const actions = bridge.getActions();
    expect(actions).toHaveLength(2);
    expect(actions[0].participantName).toBe('Alice');
    expect(actions[1].action).toBe('read');
  });

  it('evicts the oldest entries past maxRecentActions', () => {
    const bridge = new ContextBridge({
      room: roomProvider(),
      participants: participantsProvider([]),
      config: { maxRecentActions: 3 },
    });

    for (let i = 0; i < 5; i++) {
      bridge.recordAction({
        participantId: 'p',
        participantName: 'p',
        action: `a${i}`,
        timestamp: i,
      });
    }

    const actions = bridge.getActions();
    expect(actions).toHaveLength(3);
    expect(actions.map(a => a.action)).toEqual(['a2', 'a3', 'a4']);
  });

  it('clearActions empties the buffer', () => {
    const bridge = new ContextBridge({
      room: roomProvider(),
      participants: participantsProvider([]),
    });
    bridge.recordAction({
      participantId: 'p',
      participantName: 'p',
      action: 'x',
      timestamp: 0,
    });
    bridge.clearActions();
    expect(bridge.getActions()).toEqual([]);
  });

  it('getActions returns a snapshot (mutation does not affect internal state)', () => {
    const bridge = new ContextBridge({
      room: roomProvider(),
      participants: participantsProvider([]),
    });
    bridge.recordAction({
      participantId: 'p',
      participantName: 'p',
      action: 'x',
      timestamp: 0,
    });

    const copy = bridge.getActions() as ActionContext[];
    copy.push({
      participantId: 'p',
      participantName: 'p',
      action: 'y',
      timestamp: 1,
    });

    expect(bridge.getActions()).toHaveLength(1);
  });
});

describe('ContextBridge.formatForPrompt', () => {
  it('produces an XML-ish block containing room, participants, actions', () => {
    const bridge = new ContextBridge({
      room: roomProvider(),
      participants: participantsProvider([
        makeParticipant({ id: 'p-1', name: 'Alice' }),
      ]),
    });
    bridge.recordAction({
      participantId: 'p-1',
      participantName: 'Alice',
      action: 'edit',
      target: 'src/a.ts',
      timestamp: 1000,
    });

    const out = bridge.formatForPrompt();

    expect(out).toContain('<room>');
    expect(out).toContain('room-1');
    expect(out).toContain('<participants>');
    expect(out).toContain('name="Alice"');
    expect(out).toContain('<recent-actions>');
    expect(out).toContain('edit');
  });

  it('omits empty sections', () => {
    const bridge = new ContextBridge({
      room: roomProvider(),
      participants: participantsProvider([]),
    });

    const out = bridge.formatForPrompt();

    expect(out).toContain('<room>');
    expect(out).not.toContain('<participants>');
    expect(out).not.toContain('<recent-actions>');
    expect(out).not.toContain('<project-knowledge>');
    expect(out).not.toContain('<task>');
  });

  it('escapes XML special characters in user-supplied strings', () => {
    const bridge = new ContextBridge({
      room: roomProvider({ name: 'A & B <Demo>' }),
      participants: participantsProvider([
        makeParticipant({ name: '"quotes"', intent: 'fix <x>' }),
      ]),
    });

    const out = bridge.formatForPrompt();

    expect(out).toContain('A &amp; B &lt;Demo&gt;');
    expect(out).toContain('&quot;quotes&quot;');
    expect(out).toContain('fix &lt;x&gt;');
  });

  it('truncates when output exceeds maxContextChars', () => {
    const bridge = new ContextBridge({
      room: roomProvider({ name: 'x'.repeat(5000) }),
      participants: participantsProvider([]),
      config: { maxContextChars: 200 },
    });

    const out = bridge.formatForPrompt();

    expect(out.length).toBeLessThanOrEqual(200);
    expect(out).toContain('[…truncated]');
  });

  it('renders project knowledge and task sections when present', () => {
    const bridge = new ContextBridge({
      room: roomProvider(),
      participants: participantsProvider([]),
      knowledge: {
        get: () => ({
          summary: 'demo project',
          keyFiles: ['README.md'],
          architecture: 'monolith',
          conventions: ['no any'],
          recentDecisions: ['picked vitest'],
        }),
      },
      task: {
        current: () => ({
          description: 'add login',
          conversationSummary: 'JWT selected',
          relevantFiles: ['src/auth.ts'],
        }),
      },
    });

    const out = bridge.formatForPrompt();

    expect(out).toContain('<project-knowledge>');
    expect(out).toContain('demo project');
    expect(out).toContain('monolith');
    expect(out).toContain('no any');
    expect(out).toContain('picked vitest');
    expect(out).toContain('<task>');
    expect(out).toContain('add login');
    expect(out).toContain('JWT selected');
    expect(out).toContain('src/auth.ts');
  });

  it('accepts a caller-supplied AIContext instead of re-building', () => {
    const bridge = new ContextBridge({
      room: roomProvider(),
      participants: participantsProvider([]),
    });

    const custom = bridge.build();
    custom.room.name = 'override';

    const out = bridge.formatForPrompt(custom);
    expect(out).toContain('override');
  });
});
