/**
 * Risk assessor.
 *
 * Classifies an Intent into a RiskAssessment using:
 *   - the intent's declared type (DEFAULT_RISK_RULES.alwaysSafe / alwaysDangerous)
 *   - the agent's self-declared risk on the intent
 *   - sensitive-file detection (hard escalation to 'dangerous')
 *   - risky-file-pattern matching (one-step escalation)
 *   - edit magnitude (one-step escalation above maxSafeLinesChanged)
 *
 * The output is descriptive. Whether an assessment results in
 * auto-approval, manual review, or rejection is decided by the
 * permission-checker combined with the room's mode.
 */

import type { Intent, RiskLevel } from '@pram1t/mustard-collab-ai';
import type {
  RiskAssessment,
  RiskAssessmentRules,
  RiskFactor,
  RiskRecommendation,
  SensitiveFileMatch,
} from './types.js';
import { DEFAULT_RISK_RULES } from './types.js';
import { matchesGlob } from './glob-match.js';
import { SensitiveFileDetector } from './sensitive-files.js';

// ============================================================================
// Helpers
// ============================================================================

const LEVELS: readonly RiskLevel[] = ['safe', 'moderate', 'dangerous'] as const;

function levelIndex(l: RiskLevel): number {
  return LEVELS.indexOf(l);
}

function maxLevel(a: RiskLevel, b: RiskLevel): RiskLevel {
  return levelIndex(a) >= levelIndex(b) ? a : b;
}

function escalate(l: RiskLevel, steps = 1): RiskLevel {
  const i = Math.min(LEVELS.length - 1, levelIndex(l) + steps);
  return LEVELS[i];
}

/** Pull a target file path out of an IntentAction, or `null` if none. */
function targetPath(intent: Intent): string | null {
  const a = intent.action;
  switch (a.type) {
    case 'file_read':
    case 'file_create':
    case 'file_edit':
    case 'file_delete':
      return a.path;
    case 'file_rename':
      return a.newPath;
    default:
      return null;
  }
}

/** Approximate lines changed for edits; 0 for non-edit actions. */
function linesChanged(intent: Intent): number {
  const a = intent.action;
  if (a.type !== 'file_edit') return 0;
  const before = (a.oldContent ?? '').split('\n').length;
  const after = (a.newContent ?? '').split('\n').length;
  return Math.abs(after - before) + Math.min(before, after);
}

// ============================================================================
// RiskAssessor
// ============================================================================

export interface RiskAssessorOptions {
  rules?: RiskAssessmentRules;
  /**
   * Optional detector. If omitted, a detector is constructed with the
   * default sensitive patterns.
   */
  sensitiveFiles?: SensitiveFileDetector;
}

export class RiskAssessor {
  private readonly rules: RiskAssessmentRules;
  private readonly sensitive: SensitiveFileDetector;

  constructor(options: RiskAssessorOptions = {}) {
    this.rules = options.rules ?? DEFAULT_RISK_RULES;
    this.sensitive = options.sensitiveFiles ?? new SensitiveFileDetector();
  }

  /**
   * Assess an intent. Returns both the effective risk level and the
   * individual factors that contributed.
   */
  assess(intent: Intent): RiskAssessment {
    const factors: RiskFactor[] = [];
    let level: RiskLevel = 'moderate';

    // 1. Intent type classification.
    if (this.rules.alwaysSafe.includes(intent.type)) {
      level = 'safe';
      factors.push({
        name: 'intent-type',
        description: `Intent type '${intent.type}' is classified as always safe.`,
        severity: 'safe',
        weight: 0.4,
      });
    } else if (this.rules.alwaysDangerous.includes(intent.type)) {
      level = 'dangerous';
      factors.push({
        name: 'intent-type',
        description: `Intent type '${intent.type}' is classified as always dangerous.`,
        severity: 'dangerous',
        weight: 0.8,
      });
    } else {
      factors.push({
        name: 'intent-type',
        description: `Intent type '${intent.type}' has no static classification; defaulting to moderate.`,
        severity: 'moderate',
        weight: 0.3,
      });
    }

    // 2. Agent's self-declared risk never lowers our assessment.
    if (levelIndex(intent.risk) > levelIndex(level)) {
      factors.push({
        name: 'agent-declared-risk',
        description: `Agent declared risk '${intent.risk}', higher than inferred level.`,
        severity: intent.risk,
        weight: 0.3,
      });
      level = intent.risk;
    }

    // 3. Sensitive-file check — hard escalate to 'dangerous'.
    const path = targetPath(intent);
    let sensitiveMatch: SensitiveFileMatch | null = null;
    if (path) {
      sensitiveMatch = this.sensitive.check(path);
      if (sensitiveMatch) {
        factors.push({
          name: 'sensitive-file',
          description: `File '${path}' matches pattern '${sensitiveMatch.pattern}' (${sensitiveMatch.reason}).`,
          severity: 'dangerous',
          weight: 1.0,
        });
        level = 'dangerous';
      }
    }

    // 4. Risky file patterns — one-step escalation.
    if (path && !sensitiveMatch) {
      for (const pattern of this.rules.riskyFilePatterns) {
        if (matchesGlob(path, pattern)) {
          factors.push({
            name: 'risky-file-pattern',
            description: `File '${path}' matches risky pattern '${pattern}'.`,
            severity: 'moderate',
            weight: 0.5,
          });
          level = maxLevel(level, escalate(level, 1));
          break;
        }
      }
    }

    // 5. Large edits — one-step escalation if over the configured threshold.
    const lines = linesChanged(intent);
    if (lines > this.rules.maxSafeLinesChanged) {
      factors.push({
        name: 'edit-magnitude',
        description: `Edit affects ~${lines} lines, above safe threshold of ${this.rules.maxSafeLinesChanged}.`,
        severity: 'moderate',
        weight: 0.4,
      });
      level = maxLevel(level, escalate(level, 1));
    }

    return {
      level,
      factors,
      recommendation: recommend(level, Boolean(sensitiveMatch)),
    };
  }

  /** Access the configured detector for downstream reuse. */
  getSensitiveDetector(): SensitiveFileDetector {
    return this.sensitive;
  }

  /** Access the configured rules. */
  getRules(): RiskAssessmentRules {
    return this.rules;
  }
}

/**
 * Map an effective risk level + sensitive-file flag to a recommendation.
 * `block` is reserved for future use and not produced by this function.
 */
function recommend(level: RiskLevel, sensitive: boolean): RiskRecommendation {
  if (sensitive) return 'require_review';
  if (level === 'safe') return 'auto_approve';
  return 'require_review';
}
