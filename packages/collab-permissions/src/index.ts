/**
 * @openagent/collab-permissions
 *
 * Permission modes and risk assessment for OpenAgent Collab.
 */

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
