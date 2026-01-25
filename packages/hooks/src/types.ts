/**
 * Hook System Types
 *
 * Defines types for the lifecycle hook system that allows
 * custom scripts to run at various agent events.
 */

/**
 * Hook event types - lifecycle points where hooks can run
 */
export type HookEvent =
  | 'session_start'        // New session begins
  | 'user_prompt_submit'   // User sends a message
  | 'pre_tool_use'         // Before tool executes
  | 'post_tool_use'        // After tool completes
  | 'stop';                // Session ends

/**
 * Matcher for filtering when hooks run
 */
export interface HookMatcher {
  /** Exact tool name to match (for pre/post_tool_use) */
  tool?: string;
  /** Regex pattern for tool name */
  toolPattern?: string;
}

/**
 * Hook configuration
 */
export interface HookConfig {
  /** Shell command to execute */
  command: string;
  /** Timeout in milliseconds (default: 10000) */
  timeout?: number;
  /** Matcher to filter when hook runs */
  matcher?: HookMatcher;
  /** Environment variables to set */
  env?: Record<string, string>;
  /** Working directory for the hook */
  cwd?: string;
}

/**
 * Hooks configuration by event type
 */
export type HooksConfig = Partial<Record<HookEvent, HookConfig[]>>;

/**
 * Data passed to hooks via stdin as JSON
 */
export interface HookInput {
  /** The event type that triggered this hook */
  event: HookEvent;
  /** Unix timestamp when hook was triggered */
  timestamp: number;
  /** Current session ID */
  sessionId: string;
  /** User message (for user_prompt_submit) */
  message?: string;
  /** Tool name (for pre/post_tool_use) */
  tool?: string;
  /** Tool parameters (for pre/post_tool_use) */
  params?: unknown;
  /** Tool result (for post_tool_use) */
  result?: unknown;
}

/**
 * Result returned from hook execution
 */
export interface HookResult {
  /** Whether the hook blocked the action */
  blocked: boolean;
  /** Modified message (for user_prompt_submit) */
  modifiedMessage?: string;
  /** Modified parameters (for pre_tool_use) */
  modifiedParams?: unknown;
  /** Output to display to user */
  output?: string;
  /** Error message if hook failed */
  error?: string;
}

/**
 * Internal hook execution context
 */
export interface HookContext {
  /** Session ID */
  sessionId: string;
  /** Current working directory */
  cwd: string;
}
