/**
 * @openagent/core
 *
 * Core functionality for OpenAgent.
 * Provides the agent loop, context management, and tool execution orchestration.
 */

export const version = '0.0.0';

// ============================================================================
// Context Management
// ============================================================================

export type { ContextConfig, ContextState } from './context/types.js';
export { DEFAULT_CONTEXT_CONFIG } from './context/types.js';
export { ContextManager } from './context/manager.js';

// ============================================================================
// Agent Loop
// ============================================================================

export type {
  AgentConfig,
  AgentEvent,
  AgentState,
  RunOptions,
  TextEvent,
  ToolCallEvent,
  ToolResultEvent,
  ErrorEvent,
  DoneEvent,
  ThinkingEvent,
  CompactionEvent,
  PermissionDeniedEvent,
  PermissionAskEvent,
} from './agent/types.js';

export { DEFAULT_AGENT_CONFIG } from './agent/types.js';
export { AgentLoop, createAgent } from './agent/loop.js';
export { executeTools, executeSingleTool, validateToolCalls } from './agent/execution.js';

// ============================================================================
// System Prompt Utilities
// ============================================================================

export { createSystemPrompt } from './agent/system-prompt.js';
export type { SystemPromptOptions } from './agent/system-prompt.js';

// ============================================================================
// Permission System
// ============================================================================

export type {
  PermissionMode,
  PermissionDecision,
  PermissionRuleType,
  PermissionRule,
  PermissionResult,
  PermissionContext,
  ApprovalCallback,
  PermissionConfig,
} from './permissions/index.js';

export {
  PermissionManager,
  createPermissionManager,
  BUILTIN_RULES,
} from './permissions/index.js';

// ============================================================================
// Session Management
// ============================================================================

export type {
  SessionMetadata,
  SessionData,
  SessionListItem,
} from './session/index.js';

export { SessionManager } from './session/index.js';

// ============================================================================
// Utilities
// ============================================================================

export {
  DEFAULT_SAFE_ENV_VARS,
  BLOCKED_ENV_VARS,
  filterEnvVars,
} from './utils/index.js';

export type { FilterEnvOptions } from './utils/index.js';
