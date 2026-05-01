/**
 * Permission checker — pure functions that combine a mode, an intent,
 * and a risk assessment into a terminal decision.
 *
 * No state here. The mode-manager, approval-manager, and gateway all
 * consume these helpers.
 */

import type { Intent, RiskLevel } from '@pram1t/mustard-collab-ai';
import type { PermissionMode } from '@pram1t/mustard-collab-core';
import type {
  ApprovalPolicy,
  ModeCapabilities,
  ModeRules,
  RiskAssessment,
  SensitiveFileMatch,
} from './types.js';
import {
  DEFAULT_APPROVAL_POLICIES,
  DEFAULT_MODE_RULES,
} from './types.js';

// ============================================================================
// Capability queries (simple wrappers)
// ============================================================================

/** Possible low-level actions we gate. */
export type GatedAction = 'read' | 'write' | 'execute' | 'propose';

/**
 * Does `mode` allow `action` at all?
 */
export function canPerform(
  mode: PermissionMode,
  action: GatedAction,
  rules: ModeRules = DEFAULT_MODE_RULES,
): boolean {
  const cap = rules[mode];
  switch (action) {
    case 'read':
      return cap.canRead;
    case 'write':
      return cap.canWrite;
    case 'execute':
      return cap.canExecute;
    case 'propose':
      return cap.canPropose;
  }
}

/**
 * Does `mode` require approval for `action`?
 *
 * 'read' and 'propose' are never approval-gated on their own; approval
 * gating for an entire intent is handled by `decide()`.
 */
export function needsApproval(
  mode: PermissionMode,
  action: 'write' | 'execute',
  rules: ModeRules = DEFAULT_MODE_RULES,
): boolean {
  const cap = rules[mode];
  return action === 'write' ? cap.writeRequiresApproval : cap.executeRequiresApproval;
}

/**
 * Would `mode` auto-approve an intent of `risk`?
 *
 * This only answers the "is auto-approve enabled AND the risk is low enough"
 * question. Sensitive-file gating and the countdown are applied by `decide()`.
 */
export function canAutoApprove(
  mode: PermissionMode,
  risk: RiskLevel,
  rules: ModeRules = DEFAULT_MODE_RULES,
  policies: Record<PermissionMode, ApprovalPolicy> = DEFAULT_APPROVAL_POLICIES,
): boolean {
  const cap = rules[mode];
  if (!cap.autoApproveSafe) return false;

  const policy = policies[mode];
  if (risk === 'safe') return policy.safeAutoApproveSeconds > 0;
  if (risk === 'moderate') return policy.moderateAutoApproveSeconds > 0;
  // dangerous
  return policy.allowDangerousAutoApprove;
}

/** Seconds to wait before auto-approving, or 0 if no auto-approval applies. */
export function getAutoApproveCountdown(
  mode: PermissionMode,
  risk: RiskLevel,
  rules: ModeRules = DEFAULT_MODE_RULES,
  policies: Record<PermissionMode, ApprovalPolicy> = DEFAULT_APPROVAL_POLICIES,
): number {
  if (!canAutoApprove(mode, risk, rules, policies)) return 0;
  const policy = policies[mode];
  if (risk === 'safe') return policy.safeAutoApproveSeconds;
  if (risk === 'moderate') return policy.moderateAutoApproveSeconds;
  return 0;
}

/** Approval timeout (seconds) for the mode. */
export function getApprovalTimeout(
  mode: PermissionMode,
  policies: Record<PermissionMode, ApprovalPolicy> = DEFAULT_APPROVAL_POLICIES,
): number {
  return policies[mode].timeoutSeconds;
}

/** Number of approvers required for the mode. */
export function getRequiredApprovals(
  mode: PermissionMode,
  policies: Record<PermissionMode, ApprovalPolicy> = DEFAULT_APPROVAL_POLICIES,
): number {
  return policies[mode].requiredApprovals;
}

/** Expose the mode's capability block as-is. */
export function getCapabilities(
  mode: PermissionMode,
  rules: ModeRules = DEFAULT_MODE_RULES,
): ModeCapabilities {
  return rules[mode];
}

// ============================================================================
// Unified decision
// ============================================================================

/**
 * Kind of action an intent implies. `command_run` maps to 'execute',
 * `file_read`/`search`/`analyze` to 'read', everything else to 'write'.
 * Used to pick the right capability flag.
 */
export function intentGatedAction(intent: Intent): GatedAction {
  switch (intent.type) {
    case 'file_read':
    case 'search':
    case 'analyze':
      return 'read';
    case 'command_run':
      return 'execute';
    case 'file_create':
    case 'file_edit':
    case 'file_delete':
    case 'file_rename':
    case 'other':
      return 'write';
  }
}

/**
 * Decision returned by `decide()`.
 */
export type PermissionDecision =
  | { kind: 'auto_approve'; reason: string; approver: string }
  | { kind: 'auto_reject'; reason: string }
  | {
      kind: 'require_approval';
      countdownSec: number;
      timeoutSec: number;
      requiredApprovers: number;
      reason: string;
    }
  | { kind: 'hold_pending'; reason: string };

export interface DecideOptions {
  mode: PermissionMode;
  intent: Intent;
  assessment: RiskAssessment;
  sensitive?: SensitiveFileMatch | null;
  rules?: ModeRules;
  policies?: Record<PermissionMode, ApprovalPolicy>;
  /** Identity recorded on auto-approve. Default: `'collab-permissions:auto'`. */
  autoApprover?: string;
}

/**
 * Apply all rules together and produce a terminal decision for the
 * gateway to act on.
 *
 * Precedence (first match wins):
 *   1. Mode disallows propose → auto_reject
 *   2. Mode disallows the implied action → auto_reject
 *   3. Mode is 'plan' → hold_pending (documentation only)
 *   4. Sensitive file matched → require_approval (regardless of mode/risk)
 *   5. Risk is 'dangerous' → require_approval
 *   6. Mode auto-approves the risk level → auto_approve with countdown
 *   7. Default → require_approval
 */
export function decide(opts: DecideOptions): PermissionDecision {
  const {
    mode,
    intent,
    assessment,
    sensitive = null,
    rules = DEFAULT_MODE_RULES,
    policies = DEFAULT_APPROVAL_POLICIES,
    autoApprover = 'collab-permissions:auto',
  } = opts;

  const cap = rules[mode];
  const action = intentGatedAction(intent);

  // 1. Mode disallows proposing at all.
  if (!cap.canPropose) {
    return {
      kind: 'auto_reject',
      reason: `Mode '${mode}' does not allow proposing intents.`,
    };
  }

  // 2. Mode disallows the implied action.
  if (action === 'read' && !cap.canRead) {
    return { kind: 'auto_reject', reason: `Mode '${mode}' disallows reads.` };
  }
  if (action === 'write' && !cap.canWrite) {
    return {
      kind: 'auto_reject',
      reason: `Mode '${mode}' disallows writes.`,
    };
  }
  if (action === 'execute' && !cap.canExecute) {
    return {
      kind: 'auto_reject',
      reason: `Mode '${mode}' disallows command execution.`,
    };
  }

  // 3. Plan mode: intent stays pending as a documented proposal.
  if (mode === 'plan') {
    return {
      kind: 'hold_pending',
      reason:
        "Plan mode — intent recorded as a proposal; switch to 'code' mode to execute.",
    };
  }

  // 4. Sensitive-file override — always require manual approval.
  if (sensitive) {
    return {
      kind: 'require_approval',
      countdownSec: 0,
      timeoutSec: getApprovalTimeout(mode, policies),
      requiredApprovers: getRequiredApprovals(mode, policies),
      reason: `Sensitive file '${sensitive.path}' matched '${sensitive.pattern}'.`,
    };
  }

  // 5. Dangerous risk — manual approval.
  if (assessment.level === 'dangerous') {
    return {
      kind: 'require_approval',
      countdownSec: 0,
      timeoutSec: getApprovalTimeout(mode, policies),
      requiredApprovers: getRequiredApprovals(mode, policies),
      reason: 'Dangerous risk level — manual approval required.',
    };
  }

  // 6. Auto-approve if the mode + risk permits.
  if (canAutoApprove(mode, assessment.level, rules, policies)) {
    const countdown = getAutoApproveCountdown(mode, assessment.level, rules, policies);
    if (countdown > 0) {
      return {
        kind: 'require_approval',
        countdownSec: countdown,
        timeoutSec: getApprovalTimeout(mode, policies),
        requiredApprovers: getRequiredApprovals(mode, policies),
        reason: `Auto-approval in ${countdown}s unless cancelled (${assessment.level} risk).`,
      };
    }
    return {
      kind: 'auto_approve',
      reason: `Mode '${mode}' auto-approves ${assessment.level}-risk intents.`,
      approver: autoApprover,
    };
  }

  // 7. Default — manual approval.
  return {
    kind: 'require_approval',
    countdownSec: 0,
    timeoutSec: getApprovalTimeout(mode, policies),
    requiredApprovers: getRequiredApprovals(mode, policies),
    reason: 'Manual approval required.',
  };
}
