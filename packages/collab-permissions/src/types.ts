/**
 * Permission and mode types for OpenAgent Collab.
 *
 * Types for Plan/Code/Ask/Auto modes, risk assessment, and sensitive file detection.
 */

import type { PermissionMode } from '@openagent/collab-core';
import type { IntentType, RiskLevel } from '@openagent/collab-ai';

// ============================================================================
// Mode Rules
// ============================================================================

/**
 * Capability flags for a permission mode.
 */
export interface ModeCapabilities {
  /** Can read files */
  canRead: boolean;

  /** Can write/edit files */
  canWrite: boolean;

  /** Can execute commands */
  canExecute: boolean;

  /** Can propose intents */
  canPropose: boolean;

  /** Write requires approval */
  writeRequiresApproval: boolean;

  /** Execute requires approval */
  executeRequiresApproval: boolean;

  /** Auto-approve safe intents */
  autoApproveSafe: boolean;
}

/**
 * Mode rule set — defines what each mode allows.
 */
export type ModeRules = Record<PermissionMode, ModeCapabilities>;

/** Default mode rules */
export const DEFAULT_MODE_RULES: ModeRules = {
  plan: {
    canRead: true,
    canWrite: false,
    canExecute: false,
    canPropose: true,
    writeRequiresApproval: true,
    executeRequiresApproval: true,
    autoApproveSafe: false,
  },
  code: {
    canRead: true,
    canWrite: true,
    canExecute: true,
    canPropose: true,
    writeRequiresApproval: true,
    executeRequiresApproval: true,
    autoApproveSafe: false,
  },
  ask: {
    canRead: true,
    canWrite: false,
    canExecute: false,
    canPropose: false,
    writeRequiresApproval: true,
    executeRequiresApproval: true,
    autoApproveSafe: false,
  },
  auto: {
    canRead: true,
    canWrite: true,
    canExecute: true,
    canPropose: true,
    writeRequiresApproval: false,
    executeRequiresApproval: true,
    autoApproveSafe: true,
  },
};

// ============================================================================
// Mode Management
// ============================================================================

/**
 * Mode state for a room.
 */
export interface ModeState {
  /** Current active mode */
  current: PermissionMode;

  /** Previous mode (for undo) */
  previous?: PermissionMode;

  /** Who set the current mode */
  setBy: string;

  /** When the mode was set */
  setAt: Date;
}

/** Mode change event */
export interface ModeChangeEvent {
  type: 'mode_changed';
  roomId: string;
  oldMode: PermissionMode;
  newMode: PermissionMode;
  changedBy: string;
  timestamp: number;
}

// ============================================================================
// Approval Flow
// ============================================================================

/**
 * Approval request.
 */
export interface ApprovalRequest {
  /** Request ID */
  id: string;

  /** Intent ID being approved */
  intentId: string;

  /** Who needs to approve */
  requiredApprovers: string[];

  /** Who has approved */
  approvals: string[];

  /** Auto-approval countdown (seconds, 0 = no auto) */
  autoApproveCountdown: number;

  /** Status */
  status: ApprovalStatus;

  /** Created at */
  createdAt: number;

  /** Resolved at */
  resolvedAt?: number;
}

/** Approval status */
export type ApprovalStatus = 'waiting' | 'approved' | 'rejected' | 'expired' | 'auto_approved';

/**
 * Approval policy for a mode.
 */
export interface ApprovalPolicy {
  /** Mode this policy applies to */
  mode: PermissionMode;

  /** Number of approvals required */
  requiredApprovals: number;

  /** Auto-approve countdown for safe intents (seconds, 0 = disabled) */
  safeAutoApproveSeconds: number;

  /** Auto-approve countdown for moderate intents (seconds, 0 = disabled) */
  moderateAutoApproveSeconds: number;

  /** Allow auto-approve for dangerous intents */
  allowDangerousAutoApprove: boolean;

  /** Approval timeout (seconds) */
  timeoutSeconds: number;
}

/** Default approval policies */
export const DEFAULT_APPROVAL_POLICIES: Record<PermissionMode, ApprovalPolicy> = {
  plan: {
    mode: 'plan',
    requiredApprovals: 1,
    safeAutoApproveSeconds: 0,
    moderateAutoApproveSeconds: 0,
    allowDangerousAutoApprove: false,
    timeoutSeconds: 300,
  },
  code: {
    mode: 'code',
    requiredApprovals: 1,
    safeAutoApproveSeconds: 0,
    moderateAutoApproveSeconds: 0,
    allowDangerousAutoApprove: false,
    timeoutSeconds: 300,
  },
  ask: {
    mode: 'ask',
    requiredApprovals: 1,
    safeAutoApproveSeconds: 0,
    moderateAutoApproveSeconds: 0,
    allowDangerousAutoApprove: false,
    timeoutSeconds: 300,
  },
  auto: {
    mode: 'auto',
    requiredApprovals: 1,
    safeAutoApproveSeconds: 10,
    moderateAutoApproveSeconds: 30,
    allowDangerousAutoApprove: false,
    timeoutSeconds: 120,
  },
};

// ============================================================================
// Sensitive File Detection
// ============================================================================

/**
 * Sensitive file match.
 */
export interface SensitiveFileMatch {
  /** File path */
  path: string;

  /** Why it's sensitive */
  reason: string;

  /** Match pattern */
  pattern: string;

  /** Severity */
  severity: 'warning' | 'critical';
}

/** Default sensitive file patterns */
export const DEFAULT_SENSITIVE_PATTERNS: string[] = [
  '.env',
  '.env.*',
  '*.pem',
  '*.key',
  '*.p12',
  '*.pfx',
  '*.jks',
  '*.keystore',
  '**/credentials.*',
  '**/secrets.*',
  '**/.ssh/*',
  '**/id_rsa*',
  '**/id_ed25519*',
  '**/.aws/credentials',
  '**/.gcp/credentials.json',
];

// ============================================================================
// Risk Assessment
// ============================================================================

/**
 * Risk assessment result.
 */
export interface RiskAssessment {
  /** Overall risk level */
  level: RiskLevel;

  /** Risk factors */
  factors: RiskFactor[];

  /** Recommended action */
  recommendation: RiskRecommendation;
}

/** Risk factor */
export interface RiskFactor {
  /** Factor name */
  name: string;

  /** Description */
  description: string;

  /** Severity */
  severity: RiskLevel;

  /** Weight (0-1) */
  weight: number;
}

/** Risk recommendation */
export type RiskRecommendation =
  | 'auto_approve'   // Safe to auto-approve
  | 'require_review' // Needs human review
  | 'block';         // Should be blocked

/**
 * Risk assessment rules.
 */
export interface RiskAssessmentRules {
  /** Intent types that are always safe */
  alwaysSafe: IntentType[];

  /** Intent types that are always dangerous */
  alwaysDangerous: IntentType[];

  /** File patterns that increase risk */
  riskyFilePatterns: string[];

  /** Max lines of change before elevated risk */
  maxSafeLinesChanged: number;
}

/** Default risk assessment rules */
export const DEFAULT_RISK_RULES: RiskAssessmentRules = {
  alwaysSafe: ['file_read', 'search', 'analyze'],
  alwaysDangerous: ['command_run'],
  riskyFilePatterns: [
    'package.json',
    'tsconfig.json',
    '*.config.*',
    '.github/**',
    'Dockerfile*',
    'docker-compose*',
  ],
  maxSafeLinesChanged: 50,
};
