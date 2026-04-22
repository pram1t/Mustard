/**
 * @openagent/collab-permissions
 *
 * Permission modes and risk assessment for OpenAgent Collab.
 */

// ============================================================================
// Classes / functions
// ============================================================================

export { SensitiveFileDetector } from './sensitive-files.js';
export type {
  SensitivePatternEntry,
  SensitiveFileDetectorOptions,
} from './sensitive-files.js';

export { RiskAssessor } from './risk-assessor.js';
export type { RiskAssessorOptions } from './risk-assessor.js';

export {
  canPerform,
  needsApproval,
  canAutoApprove,
  getAutoApproveCountdown,
  getApprovalTimeout,
  getRequiredApprovals,
  getCapabilities,
  intentGatedAction,
  decide,
} from './permission-checker.js';
export type {
  GatedAction,
  PermissionDecision,
  DecideOptions,
} from './permission-checker.js';

// ============================================================================
// Glob matcher (exposed for consumers that want to reuse the helper)
// ============================================================================

export {
  matchesGlob,
  globToRegExp,
  normalizePath,
  firstMatch,
} from './glob-match.js';

// ============================================================================
// Mode manager + bus integration
// ============================================================================

export { ModeManager } from './mode-manager.js';
export type { ModeManagerOptions } from './mode-manager.js';

export {
  attachModeManagerToBus,
  MODE_TOPICS,
  MODE_TOPIC_WILDCARD,
} from './bus-adapter.js';
export type { AttachModeManagerOptions } from './bus-adapter.js';

// ============================================================================
// Approval manager
// ============================================================================

export { ApprovalManager } from './approval-manager.js';
export type {
  ApprovalManagerOptions,
  ApprovalEventName,
  OpenApprovalInput,
} from './approval-manager.js';

// ============================================================================
// Types (existing, unchanged)
// ============================================================================

export type {
  // Mode rules
  ModeCapabilities,
  ModeRules,

  // Mode management
  ModeState,
  ModeChangeEvent,

  // Approval flow
  ApprovalRequest,
  ApprovalStatus,
  ApprovalPolicy,

  // Sensitive files
  SensitiveFileMatch,

  // Risk assessment
  RiskAssessment,
  RiskFactor,
  RiskRecommendation,
  RiskAssessmentRules,
} from './types.js';

export {
  DEFAULT_MODE_RULES,
  DEFAULT_APPROVAL_POLICIES,
  DEFAULT_SENSITIVE_PATTERNS,
  DEFAULT_RISK_RULES,
} from './types.js';
