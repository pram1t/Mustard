/**
 * Auto-approval policy for AI intents.
 *
 * A small, composable policy that lets low-risk intents skip manual approval
 * while keeping higher-risk actions in the human-in-the-loop flow.
 *
 * The rule evaluation order is intentional:
 *   1. `enabled` — master switch
 *   2. `allowedRisks` — intent risk must be in the allowed set
 *   3. `allowedTypes` — if configured, intent type must match
 *   4. `minConfidence` — intent confidence must clear the floor
 *
 * First mismatch rejects. No rule DSL, no predicate callbacks — by design.
 * Extra expressiveness belongs in the Phase-6 permission modes.
 */

import type { Intent, IntentType, RiskLevel } from './types.js';

// ============================================================================
// Policy type
// ============================================================================

/**
 * Declarative rules for when an intent may bypass manual approval.
 */
export interface AutoApprovalPolicy {
  /** Master switch. When false, nothing auto-approves. */
  enabled: boolean;

  /**
   * UI hint for consumers (Phase-6 permission prompts, CLI status bar).
   * Does not affect policy evaluation.
   */
  mode?: 'manual' | 'auto' | 'review';

  /** Risk levels eligible for auto-approval. */
  allowedRisks: readonly RiskLevel[];

  /** Optional allowlist of intent types. If omitted, all types pass this gate. */
  allowedTypes?: readonly IntentType[];

  /** Minimum confidence (0–1) required. Defaults to 0. */
  minConfidence?: number;

  /**
   * Identity recorded as `resolvedBy` on auto-approved intents.
   * Keep this stable — consumers filter on it (e.g., the Phase-6 permission
   * UI ignores intents whose resolver starts with "auto-approval").
   */
  approverIdentity: string;
}

// ============================================================================
// Default policy
// ============================================================================

/**
 * Conservative default: auto-approval disabled.
 *
 * When consumers flip `enabled: true`, they inherit the read-only allowlist
 * (file_read, search, analyze) at `risk: 'safe'`. Everything else still
 * requires manual approval.
 */
export const defaultAutoApprovalPolicy: AutoApprovalPolicy = {
  enabled: false,
  allowedRisks: ['safe'],
  allowedTypes: ['file_read', 'search', 'analyze'],
  minConfidence: 0,
  approverIdentity: 'auto-approval',
};

// ============================================================================
// Evaluation
// ============================================================================

/**
 * Decide whether an intent qualifies for auto-approval under the given policy.
 *
 * Pure function. Returns true only when every rule passes.
 */
export function shouldAutoApprove(
  intent: Intent,
  policy: AutoApprovalPolicy,
): boolean {
  if (!policy.enabled) return false;
  if (!policy.allowedRisks.includes(intent.risk)) return false;
  if (policy.allowedTypes && !policy.allowedTypes.includes(intent.type)) return false;
  const floor = policy.minConfidence ?? 0;
  if (intent.confidence < floor) return false;
  return true;
}
