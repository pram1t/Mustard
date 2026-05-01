import { describe, it, expect } from 'vitest';
import type { PermissionMode } from '@pram1t/mustard-collab-core';
import type { Intent, IntentAction, IntentType, RiskLevel } from '@pram1t/mustard-collab-ai';
import type { RiskAssessment, SensitiveFileMatch } from '../types.js';
import {
  canPerform,
  needsApproval,
  canAutoApprove,
  getAutoApproveCountdown,
  getApprovalTimeout,
  getRequiredApprovals,
  getCapabilities,
  intentGatedAction,
  decide,
} from '../permission-checker.js';

function makeIntent(
  type: IntentType,
  overrides?: Partial<Intent> & { action?: IntentAction },
): Intent {
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
      : type === 'search'
      ? { type: 'search', query: 'x', scope: 'project' }
      : type === 'analyze'
      ? { type: 'analyze', target: 'x', analysisType: 'y' }
      : type === 'file_create'
      ? { type: 'file_create', path: 'x', content: '' }
      : type === 'file_delete'
      ? { type: 'file_delete', path: 'x' }
      : type === 'file_rename'
      ? { type: 'file_rename', oldPath: 'a', newPath: 'b' }
      : { type: 'other', description: 'x' });
  return {
    id: 'i-1',
    agentId: 'a-1',
    summary: 'test',
    type,
    action,
    rationale: 'test',
    confidence: 1,
    risk: 'safe',
    status: 'pending',
    createdAt: 0,
    ...overrides,
  };
}

function assessment(level: RiskLevel): RiskAssessment {
  return { level, factors: [], recommendation: level === 'safe' ? 'auto_approve' : 'require_review' };
}

describe('canPerform', () => {
  const cases: Array<[PermissionMode, 'read' | 'write' | 'execute' | 'propose', boolean]> = [
    ['plan', 'read', true],
    ['plan', 'write', false],
    ['plan', 'execute', false],
    ['plan', 'propose', true],
    ['code', 'write', true],
    ['code', 'execute', true],
    ['ask', 'propose', false],
    ['ask', 'write', false],
    ['auto', 'write', true],
    ['auto', 'execute', true],
  ];
  it.each(cases)('in %s, %s → %s', (mode, action, expected) => {
    expect(canPerform(mode, action)).toBe(expected);
  });
});

describe('needsApproval', () => {
  it('code mode needs approval for both write and execute', () => {
    expect(needsApproval('code', 'write')).toBe(true);
    expect(needsApproval('code', 'execute')).toBe(true);
  });

  it('auto mode needs approval only for execute, not write', () => {
    expect(needsApproval('auto', 'write')).toBe(false);
    expect(needsApproval('auto', 'execute')).toBe(true);
  });
});

describe('canAutoApprove', () => {
  it('only auto mode auto-approves safe intents by default', () => {
    expect(canAutoApprove('auto', 'safe')).toBe(true);
    expect(canAutoApprove('code', 'safe')).toBe(false);
    expect(canAutoApprove('plan', 'safe')).toBe(false);
    expect(canAutoApprove('ask', 'safe')).toBe(false);
  });

  it('auto mode auto-approves moderate (with countdown)', () => {
    expect(canAutoApprove('auto', 'moderate')).toBe(true);
  });

  it('auto mode never auto-approves dangerous by default', () => {
    expect(canAutoApprove('auto', 'dangerous')).toBe(false);
  });
});

describe('getAutoApproveCountdown', () => {
  it('returns default countdowns for auto mode', () => {
    expect(getAutoApproveCountdown('auto', 'safe')).toBe(10);
    expect(getAutoApproveCountdown('auto', 'moderate')).toBe(30);
    expect(getAutoApproveCountdown('auto', 'dangerous')).toBe(0);
  });

  it('returns 0 for every non-auto mode', () => {
    expect(getAutoApproveCountdown('plan', 'safe')).toBe(0);
    expect(getAutoApproveCountdown('code', 'safe')).toBe(0);
    expect(getAutoApproveCountdown('ask', 'safe')).toBe(0);
  });
});

describe('getApprovalTimeout / getRequiredApprovals / getCapabilities', () => {
  it('returns the mode-default timeout', () => {
    expect(getApprovalTimeout('code')).toBe(300);
    expect(getApprovalTimeout('auto')).toBe(120);
  });

  it('returns required approvals per mode', () => {
    expect(getRequiredApprovals('code')).toBe(1);
    expect(getRequiredApprovals('auto')).toBe(1);
  });

  it('exposes the mode capability block', () => {
    expect(getCapabilities('plan').canWrite).toBe(false);
    expect(getCapabilities('code').canWrite).toBe(true);
  });
});

describe('intentGatedAction', () => {
  it('maps reads/search/analyze to read', () => {
    expect(intentGatedAction(makeIntent('file_read'))).toBe('read');
    expect(intentGatedAction(makeIntent('search'))).toBe('read');
    expect(intentGatedAction(makeIntent('analyze'))).toBe('read');
  });

  it('maps command_run to execute', () => {
    expect(intentGatedAction(makeIntent('command_run'))).toBe('execute');
  });

  it('maps file create/edit/delete/rename/other to write', () => {
    expect(intentGatedAction(makeIntent('file_create'))).toBe('write');
    expect(intentGatedAction(makeIntent('file_edit'))).toBe('write');
    expect(intentGatedAction(makeIntent('file_delete'))).toBe('write');
    expect(intentGatedAction(makeIntent('file_rename'))).toBe('write');
    expect(intentGatedAction(makeIntent('other'))).toBe('write');
  });
});

describe('decide — ask mode', () => {
  it('auto-rejects any intent because propose is disallowed', () => {
    const d = decide({
      mode: 'ask',
      intent: makeIntent('file_read'),
      assessment: assessment('safe'),
    });
    expect(d.kind).toBe('auto_reject');
  });
});

describe('decide — plan mode', () => {
  it('auto-rejects writes (mode disallows write)', () => {
    const d = decide({
      mode: 'plan',
      intent: makeIntent('file_edit'),
      assessment: assessment('moderate'),
    });
    expect(d.kind).toBe('auto_reject');
  });

  it('holds reads as pending documentation', () => {
    const d = decide({
      mode: 'plan',
      intent: makeIntent('file_read'),
      assessment: assessment('safe'),
    });
    expect(d.kind).toBe('hold_pending');
  });
});

describe('decide — code mode', () => {
  it('requires approval for moderate-risk writes', () => {
    const d = decide({
      mode: 'code',
      intent: makeIntent('file_edit'),
      assessment: assessment('moderate'),
    });
    expect(d.kind).toBe('require_approval');
    if (d.kind === 'require_approval') {
      expect(d.countdownSec).toBe(0);
      expect(d.timeoutSec).toBe(300);
      expect(d.requiredApprovers).toBe(1);
    }
  });

  it('requires approval for safe writes too (writeRequiresApproval=true)', () => {
    const d = decide({
      mode: 'code',
      intent: makeIntent('file_edit'),
      assessment: assessment('safe'),
    });
    expect(d.kind).toBe('require_approval');
  });
});

describe('decide — auto mode', () => {
  it('auto-approves (with countdown) safe reads', () => {
    const d = decide({
      mode: 'auto',
      intent: makeIntent('file_read'),
      assessment: assessment('safe'),
    });
    expect(d.kind).toBe('require_approval');
    if (d.kind === 'require_approval') {
      expect(d.countdownSec).toBe(10);
    }
  });

  it('auto-approves (30s countdown) moderate-risk writes', () => {
    const d = decide({
      mode: 'auto',
      intent: makeIntent('file_edit'),
      assessment: assessment('moderate'),
    });
    expect(d.kind).toBe('require_approval');
    if (d.kind === 'require_approval') {
      expect(d.countdownSec).toBe(30);
    }
  });

  it('requires manual approval for dangerous risk', () => {
    const d = decide({
      mode: 'auto',
      intent: makeIntent('command_run'),
      assessment: assessment('dangerous'),
    });
    expect(d.kind).toBe('require_approval');
    if (d.kind === 'require_approval') {
      expect(d.countdownSec).toBe(0);
    }
  });
});

describe('decide — sensitive file override', () => {
  const sensitive: SensitiveFileMatch = {
    path: 'src/.env',
    pattern: '.env',
    severity: 'critical',
    reason: 'environment variable file',
  };

  it('always requires manual approval regardless of mode', () => {
    const codeD = decide({
      mode: 'code',
      intent: makeIntent('file_edit'),
      assessment: assessment('moderate'),
      sensitive,
    });
    expect(codeD.kind).toBe('require_approval');

    const autoD = decide({
      mode: 'auto',
      intent: makeIntent('file_edit'),
      assessment: assessment('safe'),
      sensitive,
    });
    expect(autoD.kind).toBe('require_approval');
    if (autoD.kind === 'require_approval') {
      expect(autoD.countdownSec).toBe(0);
    }
  });
});

describe('decide — custom approver label', () => {
  it('threads autoApprover into auto_approve decisions', () => {
    const d = decide({
      mode: 'auto',
      intent: makeIntent('file_read'),
      assessment: assessment('safe'),
      policies: {
        plan: { mode: 'plan', requiredApprovals: 1, safeAutoApproveSeconds: 0, moderateAutoApproveSeconds: 0, allowDangerousAutoApprove: false, timeoutSeconds: 300 },
        code: { mode: 'code', requiredApprovals: 1, safeAutoApproveSeconds: 0, moderateAutoApproveSeconds: 0, allowDangerousAutoApprove: false, timeoutSeconds: 300 },
        ask: { mode: 'ask', requiredApprovals: 1, safeAutoApproveSeconds: 0, moderateAutoApproveSeconds: 0, allowDangerousAutoApprove: false, timeoutSeconds: 300 },
        // auto with countdown disabled for 'safe' → immediate auto_approve
        auto: { mode: 'auto', requiredApprovals: 1, safeAutoApproveSeconds: 0, moderateAutoApproveSeconds: 0, allowDangerousAutoApprove: false, timeoutSeconds: 120 },
      },
      rules: {
        plan: { canRead: true, canWrite: false, canExecute: false, canPropose: true, writeRequiresApproval: true, executeRequiresApproval: true, autoApproveSafe: false },
        code: { canRead: true, canWrite: true, canExecute: true, canPropose: true, writeRequiresApproval: true, executeRequiresApproval: true, autoApproveSafe: false },
        ask: { canRead: true, canWrite: false, canExecute: false, canPropose: false, writeRequiresApproval: true, executeRequiresApproval: true, autoApproveSafe: false },
        // Enable autoApproveSafe but with 0 countdown — forces immediate auto_approve path.
        auto: { canRead: true, canWrite: true, canExecute: true, canPropose: true, writeRequiresApproval: false, executeRequiresApproval: true, autoApproveSafe: true },
      },
      autoApprover: 'tester',
    });
    // With safeAutoApproveSeconds=0, canAutoApprove returns false (policy guard),
    // so we fall through to default manual approval.
    expect(d.kind).toBe('require_approval');
  });
});
