/**
 * Permission System Types
 *
 * Types for the four-level permission system:
 * 1. Built-in Deny Rules - Hardcoded safety rules (never bypassable)
 * 2. Custom Deny Rules - User-configured blocked patterns
 * 3. Allow Rules - User-configured whitelisted patterns
 * 4. Ask Rules / Default Mode - Prompt user for approval
 */

// ============================================================================
// Permission Modes
// ============================================================================

/**
 * Permission mode determines default behavior for tools without explicit rules.
 *
 * - `permissive`: Allow everything not explicitly denied
 * - `default`: Allow safe tools (Read, Glob, Grep), ask for others
 * - `strict`: Ask for everything not explicitly allowed
 */
export type PermissionMode = 'permissive' | 'default' | 'strict';

/**
 * Decision returned by the permission system.
 */
export type PermissionDecision = 'allow' | 'deny' | 'ask';

// ============================================================================
// Permission Rules
// ============================================================================

/**
 * Type of permission rule (determines priority).
 *
 * Priority order (highest first):
 * 1. builtin_deny - Hardcoded safety rules, never bypassable
 * 2. deny - User-configured blocked patterns
 * 3. allow - User-configured whitelisted patterns
 * 4. ask - Prompt user for approval
 */
export type PermissionRuleType = 'builtin_deny' | 'deny' | 'allow' | 'ask';

/**
 * A permission rule that matches tool invocations.
 */
export interface PermissionRule {
  /**
   * Type of rule (determines priority and behavior)
   */
  type: PermissionRuleType;

  /**
   * Exact tool name to match (e.g., "Bash", "Write")
   */
  tool?: string;

  /**
   * Regex pattern to match tool names
   */
  toolPattern?: string;

  /**
   * Regex pattern to match file paths (for Write, Edit, Read tools)
   */
  pathPattern?: string;

  /**
   * Regex pattern to match commands (for Bash tool)
   */
  commandPattern?: string;

  /**
   * Human-readable reason for this rule
   */
  reason?: string;
}

// ============================================================================
// Permission Result
// ============================================================================

/**
 * Result of a permission check.
 */
export interface PermissionResult {
  /**
   * The decision made by the permission system
   */
  decision: PermissionDecision;

  /**
   * The rule that matched (if any)
   */
  matchedRule?: PermissionRule;

  /**
   * Human-readable reason for the decision
   */
  reason: string;

  /**
   * Whether the user approved the action (only for 'ask' decisions)
   */
  userApproved?: boolean;
}

// ============================================================================
// Permission Context
// ============================================================================

/**
 * Context for a permission check request.
 */
export interface PermissionContext {
  /**
   * Name of the tool being invoked
   */
  tool: string;

  /**
   * Parameters passed to the tool
   */
  params: Record<string, unknown>;

  /**
   * Session ID for caching approvals
   */
  sessionId: string;
}

// ============================================================================
// Approval Callback
// ============================================================================

/**
 * Callback function for requesting user approval.
 *
 * @param tool - Name of the tool requesting approval
 * @param params - Parameters the tool will be called with
 * @param reason - Human-readable reason for the approval request
 * @returns Promise resolving to true if approved, false if denied
 */
export type ApprovalCallback = (
  tool: string,
  params: Record<string, unknown>,
  reason: string
) => Promise<boolean>;

// ============================================================================
// Permission Configuration
// ============================================================================

/**
 * Configuration for the permission system.
 */
export interface PermissionConfig {
  /**
   * Permission mode determines default behavior
   */
  mode: PermissionMode;

  /**
   * Custom deny rules (added to built-in rules)
   */
  denyRules?: PermissionRule[];

  /**
   * Allow rules (override ask behavior)
   */
  allowRules?: PermissionRule[];

  /**
   * Ask rules (force approval for specific patterns)
   */
  askRules?: PermissionRule[];

  /**
   * Tools that are always allowed (shorthand for allow rules)
   */
  defaultAllowTools?: string[];

  /**
   * Whether to cache user approvals within a session
   * Default: true
   */
  cacheApprovals?: boolean;
}
