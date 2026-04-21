import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { IntentEngine } from '../intent-engine.js';
import type { Intent, IntentType, IntentAction, RiskLevel } from '../types.js';
import type { AutoApprovalPolicy } from '../auto-approval.js';

type ProposeOpts = {
  agentId?: string;
  summary?: string;
  type?: IntentType;
  action?: IntentAction;
  rationale?: string;
  confidence?: number;
  risk?: RiskLevel;
};

function proposeArgs(overrides?: ProposeOpts) {
  return {
    agentId: 'agent-1',
    summary: 'read a file',
    type: 'file_read' as IntentType,
    action: { type: 'file_read' as const, path: '/tmp/a.txt' } as IntentAction,
    rationale: 'need to understand the file',
    confidence: 0.9,
    risk: 'safe' as RiskLevel,
    ...overrides,
  };
}

describe('IntentEngine.propose', () => {
  it('creates a pending intent with generated id and timestamp', () => {
    const engine = new IntentEngine();
    const intent = engine.propose(proposeArgs());

    expect(intent.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(intent.status).toBe('pending');
    expect(intent.createdAt).toBeGreaterThan(0);
    expect(intent.agentId).toBe('agent-1');
    expect(intent.type).toBe('file_read');
  });

  it('emits a proposed event synchronously', () => {
    const engine = new IntentEngine();
    const events: Intent[] = [];
    engine.on('proposed', i => events.push(i));

    const intent = engine.propose(proposeArgs());

    expect(events).toHaveLength(1);
    expect(events[0].id).toBe(intent.id);
  });

  it('generates unique ids for distinct intents', () => {
    const engine = new IntentEngine();
    const a = engine.propose(proposeArgs());
    const b = engine.propose(proposeArgs());
    expect(a.id).not.toBe(b.id);
  });
});

describe('IntentEngine state transitions', () => {
  let engine: IntentEngine;

  beforeEach(() => {
    engine = new IntentEngine();
  });

  it('approves a pending intent and records approver + timestamp', () => {
    const { id } = engine.propose(proposeArgs());
    const approved = engine.approve(id, 'human-1');

    expect(approved.status).toBe('approved');
    expect(approved.resolvedBy).toBe('human-1');
    expect(approved.resolvedAt).toBeGreaterThan(0);
  });

  it('rejects a pending intent with reason', () => {
    const { id } = engine.propose(proposeArgs());
    const rejected = engine.reject(id, 'human-1', 'too risky');

    expect(rejected.status).toBe('rejected');
    expect(rejected.resolvedBy).toBe('human-1');
    expect(rejected.rejectionReason).toBe('too risky');
  });

  it('transitions approved → executing → completed', () => {
    const { id } = engine.propose(proposeArgs());
    engine.approve(id, 'human-1');
    const executing = engine.startExecution(id);
    expect(executing.status).toBe('executing');

    const done = engine.complete(id);
    expect(done.status).toBe('completed');
    expect(done.resolvedAt).toBeGreaterThan(0);
  });

  it('transitions approved → executing → failed with reason', () => {
    const { id } = engine.propose(proposeArgs());
    engine.approve(id, 'human-1');
    engine.startExecution(id);
    const failed = engine.fail(id, 'disk full');

    expect(failed.status).toBe('failed');
    expect(failed.rejectionReason).toBe('disk full');
  });

  it('invalidates any non-terminal intent', () => {
    const { id } = engine.propose(proposeArgs());
    engine.approve(id, 'human-1');
    const invalidated = engine.invalidate(id, 'superseded');

    expect(invalidated.status).toBe('invalidated');
    expect(invalidated.rejectionReason).toBe('superseded');
  });

  it('refuses to invalidate a terminal intent', () => {
    const { id } = engine.propose(proposeArgs());
    engine.reject(id, 'human-1', 'no');
    expect(() => engine.invalidate(id, 'whatever')).toThrow(/Cannot invalidate/);
  });

  it('throws when transitioning from the wrong state', () => {
    const { id } = engine.propose(proposeArgs());
    expect(() => engine.startExecution(id)).toThrow(/Cannot transition/);
    expect(() => engine.complete(id)).toThrow(/Cannot transition/);
    expect(() => engine.fail(id, 'x')).toThrow(/Cannot transition/);
  });

  it('throws when operating on an unknown id', () => {
    expect(() => engine.approve('nope', 'x')).toThrow(/Intent not found/);
    expect(() => engine.invalidate('nope', 'x')).toThrow(/Intent not found/);
  });
});

describe('IntentEngine queries', () => {
  let engine: IntentEngine;

  beforeEach(() => {
    engine = new IntentEngine();
  });

  it('returns intents sorted by createdAt descending', async () => {
    const a = engine.propose(proposeArgs({ agentId: 'a1' }));
    // Force a new timestamp without advancing real time excessively
    await new Promise(r => setTimeout(r, 2));
    const b = engine.propose(proposeArgs({ agentId: 'a2' }));

    const list = engine.list();
    expect(list[0].id).toBe(b.id);
    expect(list[1].id).toBe(a.id);
  });

  it('filters by agentId', () => {
    engine.propose(proposeArgs({ agentId: 'a1' }));
    engine.propose(proposeArgs({ agentId: 'a2' }));
    const filtered = engine.list({ agentId: 'a2' });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].agentId).toBe('a2');
  });

  it('filters by status', () => {
    const { id } = engine.propose(proposeArgs());
    engine.propose(proposeArgs());
    engine.approve(id, 'h');

    const pending = engine.list({ status: 'pending' });
    const approved = engine.list({ status: 'approved' });
    expect(pending).toHaveLength(1);
    expect(approved).toHaveLength(1);
  });

  it('counts by status including zero-count statuses', () => {
    const { id } = engine.propose(proposeArgs());
    engine.propose(proposeArgs());
    engine.approve(id, 'h');

    const counts = engine.countByStatus();
    expect(counts.pending).toBe(1);
    expect(counts.approved).toBe(1);
    expect(counts.completed).toBe(0);
    expect(counts.invalidated).toBe(0);
  });
});

describe('IntentEngine event listeners', () => {
  it('fires per-event listeners with the updated intent', () => {
    const engine = new IntentEngine();
    const approved: Intent[] = [];
    const completed: Intent[] = [];

    engine.on('approved', i => approved.push(i));
    engine.on('completed', i => completed.push(i));

    const { id } = engine.propose(proposeArgs());
    engine.approve(id, 'h');
    engine.startExecution(id);
    engine.complete(id);

    expect(approved).toHaveLength(1);
    expect(approved[0].status).toBe('approved');
    expect(completed).toHaveLength(1);
    expect(completed[0].status).toBe('completed');
  });

  it('returns an unsubscribe function that detaches the listener', () => {
    const engine = new IntentEngine();
    const events: Intent[] = [];
    const unsub = engine.on('proposed', i => events.push(i));

    engine.propose(proposeArgs());
    unsub();
    engine.propose(proposeArgs());

    expect(events).toHaveLength(1);
  });

  it('swallows listener errors so one bad subscriber does not break others', () => {
    const engine = new IntentEngine();
    const ok: Intent[] = [];
    engine.on('proposed', () => {
      throw new Error('boom');
    });
    engine.on('proposed', i => ok.push(i));

    expect(() => engine.propose(proposeArgs())).not.toThrow();
    expect(ok).toHaveLength(1);
  });
});

describe('IntentEngine.purgeOld', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('purges terminal intents older than the max age', () => {
    const engine = new IntentEngine();
    const { id } = engine.propose(proposeArgs());
    engine.reject(id, 'h', 'no');

    vi.advanceTimersByTime(10_000);

    expect(engine.purgeOld(5_000)).toBe(1);
    expect(engine.get(id)).toBeUndefined();
  });

  it('keeps non-terminal intents regardless of age', () => {
    const engine = new IntentEngine();
    const { id } = engine.propose(proposeArgs());

    vi.advanceTimersByTime(60_000);

    expect(engine.purgeOld(1_000)).toBe(0);
    expect(engine.get(id)?.status).toBe('pending');
  });

  it('keeps terminal intents younger than the cutoff', () => {
    const engine = new IntentEngine();
    const { id } = engine.propose(proposeArgs());
    engine.reject(id, 'h', 'no');

    vi.advanceTimersByTime(1_000);

    expect(engine.purgeOld(10_000)).toBe(0);
    expect(engine.get(id)).toBeDefined();
  });
});

describe('IntentEngine.clear', () => {
  it('removes all intents', () => {
    const engine = new IntentEngine();
    engine.propose(proposeArgs());
    engine.propose(proposeArgs());
    engine.clear();
    expect(engine.list()).toHaveLength(0);
    expect(engine.countByStatus().pending).toBe(0);
  });
});

describe('IntentEngine auto-approval', () => {
  const enabledPolicy: AutoApprovalPolicy = {
    enabled: true,
    allowedRisks: ['safe'],
    allowedTypes: ['file_read'],
    minConfidence: 0,
    approverIdentity: 'auto-approval:safe-read',
  };

  it('auto-approves in the same frame as propose when policy matches', () => {
    const engine = new IntentEngine({ autoApproval: enabledPolicy });
    const events: string[] = [];
    engine.on('proposed', () => events.push('proposed'));
    engine.on('approved', () => events.push('approved'));

    const intent = engine.propose(proposeArgs());

    expect(intent.status).toBe('approved');
    expect(intent.resolvedBy).toBe('auto-approval:safe-read');
    expect(events).toEqual(['proposed', 'approved']);
  });

  it('leaves the intent pending when the policy does not match', () => {
    const engine = new IntentEngine({ autoApproval: enabledPolicy });
    const intent = engine.propose(proposeArgs({ risk: 'moderate' }));
    expect(intent.status).toBe('pending');
    expect(intent.resolvedBy).toBeUndefined();
  });

  it('leaves the intent pending when no policy is configured', () => {
    const engine = new IntentEngine();
    const intent = engine.propose(proposeArgs());
    expect(intent.status).toBe('pending');
  });

  it('does not auto-approve when the policy is disabled', () => {
    const engine = new IntentEngine({
      autoApproval: { ...enabledPolicy, enabled: false },
    });
    expect(engine.propose(proposeArgs()).status).toBe('pending');
  });
});
