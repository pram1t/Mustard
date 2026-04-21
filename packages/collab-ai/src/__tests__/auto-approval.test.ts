import { describe, it, expect } from 'vitest';
import type { Intent, IntentType, RiskLevel } from '../types.js';
import {
  shouldAutoApprove,
  defaultAutoApprovalPolicy,
  type AutoApprovalPolicy,
} from '../auto-approval.js';

function makeIntent(overrides?: Partial<Intent>): Intent {
  return {
    id: 'intent-1',
    agentId: 'agent-1',
    summary: 'test',
    type: 'file_read',
    action: { type: 'file_read', path: '/tmp/a.txt' },
    rationale: 'testing',
    confidence: 1,
    risk: 'safe',
    status: 'pending',
    createdAt: 0,
    ...overrides,
  };
}

describe('defaultAutoApprovalPolicy', () => {
  it('is disabled by default so no intent auto-approves out of the box', () => {
    const intent = makeIntent();
    expect(shouldAutoApprove(intent, defaultAutoApprovalPolicy)).toBe(false);
  });

  it('has stable shape so consumers can clone and enable safely', () => {
    expect(defaultAutoApprovalPolicy.allowedRisks).toContain('safe');
    expect(defaultAutoApprovalPolicy.allowedTypes).toEqual([
      'file_read',
      'search',
      'analyze',
    ]);
    expect(defaultAutoApprovalPolicy.approverIdentity).toBe('auto-approval');
  });
});

describe('shouldAutoApprove', () => {
  const enabled: AutoApprovalPolicy = {
    ...defaultAutoApprovalPolicy,
    enabled: true,
  };

  it('approves a safe file_read with full confidence', () => {
    expect(shouldAutoApprove(makeIntent(), enabled)).toBe(true);
  });

  it('rejects when the master switch is off regardless of other fields', () => {
    expect(
      shouldAutoApprove(makeIntent(), { ...enabled, enabled: false }),
    ).toBe(false);
  });

  it('rejects when risk is not in the allowed set', () => {
    expect(
      shouldAutoApprove(makeIntent({ risk: 'moderate' }), enabled),
    ).toBe(false);
    expect(
      shouldAutoApprove(makeIntent({ risk: 'dangerous' }), enabled),
    ).toBe(false);
  });

  it('approves moderate risk when the policy allows it', () => {
    const policy: AutoApprovalPolicy = {
      ...enabled,
      allowedRisks: ['safe', 'moderate'],
    };
    expect(shouldAutoApprove(makeIntent({ risk: 'moderate' }), policy)).toBe(
      true,
    );
  });

  it('rejects when intent type is not in allowedTypes', () => {
    expect(
      shouldAutoApprove(
        makeIntent({
          type: 'file_edit',
          action: {
            type: 'file_edit',
            path: '/x',
            range: { start: 0, end: 1 },
            oldContent: '',
            newContent: '',
            diff: '',
          },
        }),
        enabled,
      ),
    ).toBe(false);
  });

  it('passes type gate when allowedTypes is omitted', () => {
    const policy: AutoApprovalPolicy = {
      ...enabled,
      allowedTypes: undefined,
    };
    const intent = makeIntent({
      type: 'command_run',
      action: { type: 'command_run', command: 'ls' },
    });
    expect(shouldAutoApprove(intent, policy)).toBe(true);
  });

  it('rejects when confidence is below minConfidence', () => {
    const policy: AutoApprovalPolicy = { ...enabled, minConfidence: 0.8 };
    expect(
      shouldAutoApprove(makeIntent({ confidence: 0.5 }), policy),
    ).toBe(false);
  });

  it('approves at exactly the confidence floor', () => {
    const policy: AutoApprovalPolicy = { ...enabled, minConfidence: 0.8 };
    expect(
      shouldAutoApprove(makeIntent({ confidence: 0.8 }), policy),
    ).toBe(true);
  });

  it('treats undefined minConfidence as zero floor', () => {
    const policy: AutoApprovalPolicy = { ...enabled, minConfidence: undefined };
    expect(
      shouldAutoApprove(makeIntent({ confidence: 0 }), policy),
    ).toBe(true);
  });

  it.each<[string, Partial<Intent>, Partial<AutoApprovalPolicy>, boolean]>([
    ['safe file_read, all defaults', {}, {}, true],
    [
      'search action, default allowlist',
      {
        type: 'search',
        action: { type: 'search', query: 'foo', scope: 'project' },
      },
      {},
      true,
    ],
    [
      'analyze action, default allowlist',
      {
        type: 'analyze',
        action: { type: 'analyze', target: 'x', analysisType: 'deps' },
      },
      {},
      true,
    ],
    [
      'file_create never in default allowlist',
      {
        type: 'file_create',
        action: { type: 'file_create', path: '/x', content: '' },
      },
      {},
      false,
    ],
    [
      'dangerous intent with risk override allowed',
      { risk: 'dangerous' as RiskLevel },
      { allowedRisks: ['safe', 'moderate', 'dangerous'] as readonly RiskLevel[] },
      true,
    ],
  ])('%s', (_name, intentOverrides, policyOverrides, expected) => {
    const policy: AutoApprovalPolicy = { ...enabled, ...policyOverrides };
    expect(shouldAutoApprove(makeIntent(intentOverrides), policy)).toBe(
      expected,
    );
  });
});
