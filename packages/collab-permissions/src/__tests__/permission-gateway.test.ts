import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { IntentEngine, type Intent, type IntentAction, type IntentType, type RiskLevel } from '@pram1t/mustard-collab-ai';
import { ModeManager } from '../mode-manager.js';
import { ApprovalManager } from '../approval-manager.js';
import { PermissionGateway } from '../permission-gateway.js';
import type { PermissionMode } from '@pram1t/mustard-collab-core';

function proposeArgs(overrides?: {
  type?: IntentType;
  action?: IntentAction;
  risk?: RiskLevel;
  confidence?: number;
}) {
  const type = overrides?.type ?? 'file_read';
  const action: IntentAction =
    overrides?.action ??
    (type === 'file_read'
      ? { type: 'file_read', path: 'src/a.ts' }
      : type === 'file_edit'
      ? {
          type: 'file_edit',
          path: 'src/a.ts',
          range: { startLine: 1, startColumn: 0, endLine: 2, endColumn: 0 },
          oldContent: 'a',
          newContent: 'b',
          diff: '',
        }
      : type === 'command_run'
      ? { type: 'command_run', command: 'ls' }
      : { type: 'file_read', path: 'src/a.ts' });
  return {
    agentId: 'agent-1',
    summary: 'test intent',
    type,
    action,
    rationale: 'test',
    confidence: overrides?.confidence ?? 0.9,
    risk: overrides?.risk ?? 'safe',
  } as const;
}

function setup(initialMode: PermissionMode = 'plan') {
  const engine = new IntentEngine();
  const modeManager = new ModeManager({ roomId: 'r-1', initialMode });
  const approvalManager = new ApprovalManager();
  const gateway = new PermissionGateway({
    engine,
    modeManager,
    approvalManager,
  });
  const dispose = gateway.attach();
  return {
    engine,
    modeManager,
    approvalManager,
    gateway,
    dispose,
  };
}

describe('PermissionGateway — ask mode', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('auto-rejects any proposed intent', () => {
    const { engine, approvalManager, dispose } = setup('ask');
    const { id } = engine.propose(proposeArgs());
    expect(engine.get(id)?.status).toBe('rejected');
    expect(engine.get(id)?.rejectionReason).toContain('does not allow');
    expect(approvalManager.waitingCount()).toBe(0);
    dispose();
  });
});

describe('PermissionGateway — plan mode', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('holds reads as pending (documentation-only)', () => {
    const { engine, approvalManager, dispose } = setup('plan');
    const { id } = engine.propose(proposeArgs({ type: 'file_read' }));
    expect(engine.get(id)?.status).toBe('pending');
    expect(approvalManager.waitingCount()).toBe(0);
    dispose();
  });

  it('auto-rejects writes (plan disallows write actions)', () => {
    const { engine, dispose } = setup('plan');
    const { id } = engine.propose(proposeArgs({ type: 'file_edit' }));
    expect(engine.get(id)?.status).toBe('rejected');
    dispose();
  });
});

describe('PermissionGateway — code mode', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('opens a manual approval for writes and waits for a human', () => {
    const { engine, approvalManager, dispose } = setup('code');
    const { id } = engine.propose(proposeArgs({ type: 'file_edit' }));
    expect(engine.get(id)?.status).toBe('pending');
    expect(approvalManager.waitingCount()).toBe(1);
    dispose();
  });

  it('approves the intent when the approval is granted', () => {
    const { engine, approvalManager, dispose } = setup('code');
    const { id } = engine.propose(proposeArgs({ type: 'file_edit' }));

    const req = approvalManager.list({ status: 'waiting' })[0];
    approvalManager.approve(req.id, 'alice');

    expect(engine.get(id)?.status).toBe('approved');
    dispose();
  });

  it('rejects the intent when the approval is denied', () => {
    const { engine, approvalManager, dispose } = setup('code');
    const { id } = engine.propose(proposeArgs({ type: 'file_edit' }));

    const req = approvalManager.list({ status: 'waiting' })[0];
    approvalManager.reject(req.id, 'alice');

    expect(engine.get(id)?.status).toBe('rejected');
    dispose();
  });

  it('rejects the intent when the approval times out', () => {
    const { engine, approvalManager, dispose } = setup('code');
    const { id } = engine.propose(proposeArgs({ type: 'file_edit' }));

    // code-mode default timeout is 300s
    vi.advanceTimersByTime(301 * 1000);

    expect(engine.get(id)?.status).toBe('rejected');
    expect(engine.get(id)?.rejectionReason).toContain('timed out');
    expect(approvalManager.list({ status: 'expired' })).toHaveLength(1);
    dispose();
  });
});

describe('PermissionGateway — auto mode', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('auto-approves safe reads via countdown (default 10s)', () => {
    const { engine, approvalManager, dispose } = setup('auto');
    const { id } = engine.propose(proposeArgs({ type: 'file_read' }));
    expect(engine.get(id)?.status).toBe('pending');

    vi.advanceTimersByTime(10_001);

    expect(engine.get(id)?.status).toBe('approved');
    expect(approvalManager.list({ status: 'auto_approved' })).toHaveLength(1);
    dispose();
  });

  it('auto-approves moderate writes via 30s countdown', () => {
    const { engine, dispose } = setup('auto');
    const { id } = engine.propose(proposeArgs({ type: 'file_edit' }));

    vi.advanceTimersByTime(30_001);
    expect(engine.get(id)?.status).toBe('approved');
    dispose();
  });

  it('requires manual approval for dangerous intents', () => {
    const { engine, approvalManager, dispose } = setup('auto');
    const { id } = engine.propose(proposeArgs({ type: 'command_run' }));

    // Long wait — no auto-approval timer fires for dangerous
    vi.advanceTimersByTime(60_000);
    expect(engine.get(id)?.status).toBe('pending');
    expect(approvalManager.waitingCount()).toBe(1);

    const req = approvalManager.list({ status: 'waiting' })[0];
    approvalManager.approve(req.id, 'alice');
    expect(engine.get(id)?.status).toBe('approved');
    dispose();
  });

  it('sensitive file still requires approval (no countdown)', () => {
    const { engine, approvalManager, dispose } = setup('auto');
    const { id } = engine.propose(
      proposeArgs({
        type: 'file_read',
        action: { type: 'file_read', path: 'src/config/.env' },
      }),
    );

    // Should NOT auto-approve on the 10s countdown
    vi.advanceTimersByTime(11_000);
    expect(engine.get(id)?.status).toBe('pending');

    const req = approvalManager.list({ status: 'waiting' })[0];
    approvalManager.approve(req.id, 'alice');
    expect(engine.get(id)?.status).toBe('approved');
    dispose();
  });

  it('cancelling the approval before countdown rejects the intent', () => {
    const { engine, approvalManager, dispose } = setup('auto');
    const { id } = engine.propose(proposeArgs({ type: 'file_read' }));

    const req = approvalManager.list({ status: 'waiting' })[0];
    approvalManager.reject(req.id, 'alice');

    vi.advanceTimersByTime(30_000);
    expect(engine.get(id)?.status).toBe('rejected');
    dispose();
  });
});

describe('PermissionGateway — mode change cancels pending approvals', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('invalidates intents and cancels approvals when mode changes mid-flight', () => {
    const { engine, modeManager, approvalManager, dispose } = setup('code');
    const { id } = engine.propose(proposeArgs({ type: 'file_edit' }));

    expect(engine.get(id)?.status).toBe('pending');
    expect(approvalManager.waitingCount()).toBe(1);

    modeManager.setMode('ask', 'user-1');

    expect(engine.get(id)?.status).toBe('invalidated');
    expect(approvalManager.waitingCount()).toBe(0);
    dispose();
  });
});

describe('PermissionGateway — detach', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('stops observing engine + managers after dispose', () => {
    const { engine, approvalManager, dispose } = setup('code');
    dispose();

    const { id } = engine.propose(proposeArgs({ type: 'file_edit' }));
    // Without the gateway, the intent stays pending and no approval fires
    expect(engine.get(id)?.status).toBe('pending');
    expect(approvalManager.waitingCount()).toBe(0);
  });
});

describe('PermissionGateway — onDecision hook', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('reports the decision for each proposed intent', () => {
    const engine = new IntentEngine();
    const modeManager = new ModeManager({ roomId: 'r-1', initialMode: 'code' });
    const approvalManager = new ApprovalManager();
    const events: string[] = [];
    const gateway = new PermissionGateway({
      engine,
      modeManager,
      approvalManager,
      onDecision: ev => events.push(ev.decision.kind),
    });
    const dispose = gateway.attach();

    // In code mode, both writes (moderate risk) and reads (safe risk)
    // require approval — code mode does not auto-approve anything.
    engine.propose(proposeArgs({ type: 'file_edit' }));
    engine.propose(proposeArgs({ type: 'file_read' }));
    // Switch to ask mode — subsequent proposals get auto-rejected.
    modeManager.setMode('ask', 'u');
    engine.propose(proposeArgs({ type: 'file_read' }));

    expect(events).toEqual([
      'require_approval',
      'require_approval',
      'auto_reject',
    ]);
    dispose();
  });

  it('reports hold_pending in plan mode for reads', () => {
    const engine = new IntentEngine();
    const modeManager = new ModeManager({ roomId: 'r-1', initialMode: 'plan' });
    const approvalManager = new ApprovalManager();
    const events: string[] = [];
    const gateway = new PermissionGateway({
      engine,
      modeManager,
      approvalManager,
      onDecision: ev => events.push(ev.decision.kind),
    });
    const dispose = gateway.attach();

    engine.propose(proposeArgs({ type: 'file_read' }));
    expect(events).toEqual(['hold_pending']);
    dispose();
  });
});

describe('PermissionGateway — does not disturb already-resolved intents', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('ignores intents auto-approved by IntentEngine before the gateway acts', () => {
    const engine = new IntentEngine({
      autoApproval: {
        enabled: true,
        allowedRisks: ['safe'],
        allowedTypes: ['file_read'],
        approverIdentity: 'auto',
      },
    });
    const modeManager = new ModeManager({ roomId: 'r-1', initialMode: 'code' });
    const approvalManager = new ApprovalManager();
    const gateway = new PermissionGateway({
      engine,
      modeManager,
      approvalManager,
    });
    const dispose = gateway.attach();

    const { id } = engine.propose(proposeArgs({ type: 'file_read' }));

    // Engine auto-approval fired first, intent is already 'approved'.
    expect(engine.get(id)?.status).toBe('approved');
    expect(approvalManager.waitingCount()).toBe(0);
    dispose();
  });
});
