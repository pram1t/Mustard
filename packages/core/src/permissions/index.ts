/**
 * Permission System
 *
 * Four-level permission system for controlling tool access:
 * 1. Built-in Deny Rules - Hardcoded safety rules (never bypassable)
 * 2. Custom Deny Rules - User-configured blocked patterns
 * 3. Allow Rules - User-configured whitelisted patterns
 * 4. Ask Rules / Default Mode - Prompt user for approval
 */

// Types
export type {
  PermissionMode,
  PermissionDecision,
  PermissionRuleType,
  PermissionRule,
  PermissionResult,
  PermissionContext,
  ApprovalCallback,
  PermissionConfig,
} from './types.js';

// Manager
export {
  PermissionManager,
  createPermissionManager,
  BUILTIN_RULES,
} from './manager.js';
