import { describe, it, expect } from 'vitest';
import type {
  Intent,
  IntentAction,
  IntentType,
  RiskLevel,
} from '@pram1t/mustard-collab-ai';
import { RiskAssessor } from '../risk-assessor.js';
import { SensitiveFileDetector } from '../sensitive-files.js';

function makeIntent(over?: Partial<Intent> & { action?: IntentAction }): Intent {
  return {
    id: 'i-1',
    agentId: 'a-1',
    summary: 'test',
    type: 'file_read',
    action: { type: 'file_read', path: 'src/a.ts' },
    rationale: 'test',
    confidence: 1,
    risk: 'safe',
    status: 'pending',
    createdAt: 0,
    ...over,
  };
}

describe('RiskAssessor.assess — classification by intent type', () => {
  it('classifies alwaysSafe intent types as safe', () => {
    const ra = new RiskAssessor();
    expect(ra.assess(makeIntent({ type: 'file_read' })).level).toBe('safe');
    expect(
      ra.assess(
        makeIntent({
          type: 'search',
          action: { type: 'search', query: 'x', scope: 'project' },
        }),
      ).level,
    ).toBe('safe');
    expect(
      ra.assess(
        makeIntent({
          type: 'analyze',
          action: { type: 'analyze', target: 'src', analysisType: 'deps' },
        }),
      ).level,
    ).toBe('safe');
  });

  it('classifies alwaysDangerous intent types as dangerous', () => {
    const ra = new RiskAssessor();
    const level = ra.assess(
      makeIntent({
        type: 'command_run',
        action: { type: 'command_run', command: 'rm -rf /' },
      }),
    ).level;
    expect(level).toBe('dangerous');
  });

  it('defaults to moderate for types with no static classification', () => {
    const ra = new RiskAssessor();
    const level = ra.assess(
      makeIntent({
        type: 'file_edit',
        action: {
          type: 'file_edit',
          path: 'src/a.ts',
          range: { startLine: 1, startColumn: 0, endLine: 2, endColumn: 0 },
          oldContent: 'a',
          newContent: 'b',
          diff: '',
        },
      }),
    ).level;
    expect(level).toBe('moderate');
  });
});

describe('RiskAssessor.assess — agent-declared risk', () => {
  it('raises the level when the agent declares higher risk', () => {
    const ra = new RiskAssessor();
    const a = ra.assess(makeIntent({ type: 'file_read', risk: 'dangerous' }));
    expect(a.level).toBe('dangerous');
    expect(a.factors.some(f => f.name === 'agent-declared-risk')).toBe(true);
  });

  it('never lowers the level below the inferred baseline', () => {
    const ra = new RiskAssessor();
    const a = ra.assess(
      makeIntent({
        type: 'command_run',
        action: { type: 'command_run', command: 'ls' },
        risk: 'safe',
      }),
    );
    expect(a.level).toBe('dangerous');
  });
});

describe('RiskAssessor.assess — sensitive files', () => {
  it('hard-escalates any file-touching intent on a sensitive file to dangerous', () => {
    const ra = new RiskAssessor();
    const a = ra.assess(
      makeIntent({
        type: 'file_read',
        action: { type: 'file_read', path: 'packages/app/.env' },
      }),
    );
    expect(a.level).toBe('dangerous');
    expect(a.factors.some(f => f.name === 'sensitive-file')).toBe(true);
    expect(a.recommendation).toBe('require_review');
  });

  it('reports the matched pattern in the factor description', () => {
    const ra = new RiskAssessor();
    const a = ra.assess(
      makeIntent({
        type: 'file_read',
        action: { type: 'file_read', path: 'home/user/.ssh/id_rsa' },
      }),
    );
    const factor = a.factors.find(f => f.name === 'sensitive-file')!;
    expect(factor.description).toContain('**/.ssh/*');
  });

  it('can be pointed at a custom sensitive detector', () => {
    const custom = new SensitiveFileDetector({ patterns: ['*.special'] });
    const ra = new RiskAssessor({ sensitiveFiles: custom });
    const a = ra.assess(
      makeIntent({
        type: 'file_read',
        action: { type: 'file_read', path: 'vault.special' },
      }),
    );
    expect(a.level).toBe('dangerous');
    // .env is not sensitive under the custom detector.
    const b = ra.assess(
      makeIntent({
        type: 'file_read',
        action: { type: 'file_read', path: '.env' },
      }),
    );
    expect(b.level).toBe('safe');
  });
});

describe('RiskAssessor.assess — risky file patterns', () => {
  it('escalates one step for risky file patterns', () => {
    const ra = new RiskAssessor();
    const a = ra.assess(
      makeIntent({
        type: 'file_edit',
        action: {
          type: 'file_edit',
          path: 'package.json',
          range: { startLine: 1, startColumn: 0, endLine: 2, endColumn: 0 },
          oldContent: 'a',
          newContent: 'b',
          diff: '',
        },
      }),
    );
    // baseline moderate → escalated one step → dangerous
    expect(a.level).toBe('dangerous');
    expect(a.factors.some(f => f.name === 'risky-file-pattern')).toBe(true);
  });

  it('does not re-apply risky-pattern escalation when sensitive already matched', () => {
    const ra = new RiskAssessor();
    const a = ra.assess(
      makeIntent({
        type: 'file_read',
        action: { type: 'file_read', path: '.env' },
      }),
    );
    // Sensitive match escalates to dangerous; risky-pattern factor should not appear.
    expect(a.factors.some(f => f.name === 'sensitive-file')).toBe(true);
    expect(a.factors.some(f => f.name === 'risky-file-pattern')).toBe(false);
  });
});

describe('RiskAssessor.assess — edit magnitude', () => {
  it('escalates when lines changed exceed the safe threshold', () => {
    const ra = new RiskAssessor();
    const huge = 'x\n'.repeat(120);
    const a = ra.assess(
      makeIntent({
        type: 'file_edit',
        action: {
          type: 'file_edit',
          path: 'src/a.ts',
          range: { startLine: 1, startColumn: 0, endLine: 120, endColumn: 0 },
          oldContent: huge,
          newContent: 'y\n',
          diff: '',
        },
      }),
    );
    expect(a.factors.some(f => f.name === 'edit-magnitude')).toBe(true);
    expect(['dangerous', 'moderate']).toContain(a.level);
  });

  it('does not escalate for small edits', () => {
    const ra = new RiskAssessor();
    const a = ra.assess(
      makeIntent({
        type: 'file_edit',
        action: {
          type: 'file_edit',
          path: 'src/a.ts',
          range: { startLine: 1, startColumn: 0, endLine: 2, endColumn: 0 },
          oldContent: 'a',
          newContent: 'b',
          diff: '',
        },
      }),
    );
    expect(a.factors.some(f => f.name === 'edit-magnitude')).toBe(false);
  });
});

describe('RiskAssessor.assess — recommendations', () => {
  it('recommends auto_approve only for safe, non-sensitive', () => {
    const ra = new RiskAssessor();
    const safe = ra.assess(makeIntent({ type: 'file_read' }));
    expect(safe.recommendation).toBe('auto_approve');
  });

  it('recommends require_review for moderate or higher, or sensitive', () => {
    const ra = new RiskAssessor();
    const moderate = ra.assess(
      makeIntent({
        type: 'file_edit',
        action: {
          type: 'file_edit',
          path: 'src/a.ts',
          range: { startLine: 1, startColumn: 0, endLine: 2, endColumn: 0 },
          oldContent: 'a',
          newContent: 'b',
          diff: '',
        },
      }),
    );
    expect(moderate.recommendation).toBe('require_review');

    const sensitive = ra.assess(
      makeIntent({
        type: 'file_read',
        action: { type: 'file_read', path: '.env' },
      }),
    );
    expect(sensitive.recommendation).toBe('require_review');
  });
});

describe('RiskAssessor.assess — factor weights', () => {
  it('every factor has a weight in [0, 1]', () => {
    const ra = new RiskAssessor();
    const a = ra.assess(
      makeIntent({
        type: 'file_read',
        action: { type: 'file_read', path: '.env' },
        risk: 'dangerous' as RiskLevel,
      }),
    );
    for (const f of a.factors) {
      expect(f.weight).toBeGreaterThanOrEqual(0);
      expect(f.weight).toBeLessThanOrEqual(1);
    }
  });
});

describe('RiskAssessor custom rules', () => {
  it('respects custom alwaysSafe / alwaysDangerous', () => {
    const ra = new RiskAssessor({
      rules: {
        alwaysSafe: [] as IntentType[],
        alwaysDangerous: ['file_read'] as IntentType[],
        riskyFilePatterns: [],
        maxSafeLinesChanged: 1000,
      },
    });
    const a = ra.assess(makeIntent({ type: 'file_read' }));
    expect(a.level).toBe('dangerous');
  });
});
