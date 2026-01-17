/**
 * Agent System Type Specification
 *
 * This file defines the types for the agent loop, context management,
 * sessions, and subagents.
 */

import type { Message, ToolCall, StreamChunk } from './llm-provider-interface';
import type { ToolResult } from './tool-interface';

// ============================================================================
// AGENT EVENTS
// ============================================================================

/**
 * Text output event
 */
export interface TextEvent {
  type: 'text';
  content: string;
}

/**
 * Tool call started event
 */
export interface ToolCallStartEvent {
  type: 'tool_call_start';
  tool: string;
  params: Record<string, unknown>;
  id: string;
}

/**
 * Tool call completed event
 */
export interface ToolCallEndEvent {
  type: 'tool_call_end';
  tool: string;
  result: ToolResult;
  id: string;
}

/**
 * Permission request event
 */
export interface PermissionRequestEvent {
  type: 'permission_request';
  id: string;
  tool: string;
  params: Record<string, unknown>;
}

/**
 * Error event
 */
export interface ErrorEvent {
  type: 'error';
  message: string;
  recoverable: boolean;
}

/**
 * Session started event
 */
export interface SessionStartEvent {
  type: 'session_start';
  sessionId: string;
}

/**
 * Agent completed event
 */
export interface DoneEvent {
  type: 'done';
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

/**
 * All possible agent events
 */
export type AgentEvent =
  | TextEvent
  | ToolCallStartEvent
  | ToolCallEndEvent
  | PermissionRequestEvent
  | ErrorEvent
  | SessionStartEvent
  | DoneEvent;

// ============================================================================
// AGENT LOOP CONFIGURATION
// ============================================================================

/**
 * Agent loop configuration
 */
export interface AgentLoopConfig {
  /** Maximum turns before stopping */
  maxTurns?: number;

  /** Whether to stream responses */
  stream?: boolean;

  /** System prompt to prepend */
  systemPrompt?: string;

  /** Whether to allow tool use */
  allowTools?: boolean;

  /** Maximum tokens per response */
  maxTokensPerResponse?: number;
}

// ============================================================================
// CONTEXT MANAGEMENT
// ============================================================================

/**
 * Context manager configuration
 */
export interface ContextManagerConfig {
  /** Maximum tokens for context window */
  maxTokens: number;

  /** Threshold to trigger compaction (0-1) */
  compactionThreshold?: number;

  /** Minimum recent messages to preserve */
  preserveRecentCount?: number;

  /** Token counter function */
  countTokens?: (text: string) => number;
}

/**
 * Context manager interface
 */
export interface ContextManager {
  /** Unique session ID */
  readonly sessionId: string;

  /** Add a message to context */
  addMessage(message: Message): void;

  /** Get all messages */
  getMessages(): Message[];

  /** Check if compaction is needed */
  needsCompaction(): boolean;

  /** Compact the context */
  compact(): Promise<void>;

  /** Check if context is empty */
  isEmpty(): boolean;

  /** Get current token count */
  getTokenCount(): number;

  /** Get remaining token budget */
  getRemainingTokens(): number;

  /** Clear all messages */
  clear(): void;
}

// ============================================================================
// SESSION MANAGEMENT
// ============================================================================

/**
 * Session metadata
 */
export interface SessionMetadata {
  /** Creation timestamp */
  createdAt: number;

  /** Last update timestamp */
  updatedAt: number;

  /** Working directory when session was created */
  cwd: string;

  /** LLM provider used */
  provider: string;

  /** Model used */
  model?: string;

  /** Session title (auto-generated or user-set) */
  title?: string;

  /** Total tokens used in session */
  totalTokens?: number;
}

/**
 * Stored session data
 */
export interface SessionData {
  /** Session ID */
  id: string;

  /** Conversation messages */
  messages: Message[];

  /** Session metadata */
  metadata: SessionMetadata;
}

/**
 * Session summary for listing
 */
export interface SessionSummary {
  id: string;
  metadata: SessionMetadata;
}

/**
 * Session manager interface
 */
export interface SessionManager {
  /** Save current session */
  save(context: ContextManager): Promise<string>;

  /** Load a session */
  load(sessionId: string): Promise<SessionData | null>;

  /** List all sessions */
  list(): Promise<SessionSummary[]>;

  /** Delete a session */
  delete(sessionId: string): Promise<void>;

  /** Fork a session (create copy) */
  fork(sessionId: string): Promise<string>;
}

// ============================================================================
// SUBAGENT SYSTEM
// ============================================================================

/**
 * Subagent types
 */
export type SubagentType = 'Explore' | 'Plan' | 'Bash' | 'general-purpose';

/**
 * Subagent configuration
 */
export interface SubagentConfig {
  /** Short description of task */
  description: string;

  /** Detailed prompt */
  prompt: string;

  /** Type of subagent */
  subagent_type: SubagentType;

  /** Run in background */
  run_in_background?: boolean;

  /** Maximum turns */
  max_turns?: number;

  /** Specific model to use */
  model?: 'sonnet' | 'opus' | 'haiku';

  /** Resume previous subagent */
  resume?: string;
}

/**
 * Subagent result
 */
export interface SubagentResult {
  /** Unique agent ID */
  agentId: string;

  /** Final output */
  output: string;

  /** Whether completed successfully */
  success: boolean;

  /** Error if failed */
  error?: string;

  /** Token usage */
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

/**
 * Subagent type definition
 */
export interface SubagentTypeDefinition {
  /** Human-readable description */
  description: string;

  /** Allowed tools ('*' for all) */
  tools: string[] | '*';

  /** System prompt for this type */
  systemPrompt: string;

  /** Maximum turns */
  maxTurns: number;
}

/**
 * Subagent manager interface
 */
export interface SubagentManager {
  /** Spawn a new subagent */
  spawn(config: SubagentConfig): Promise<SubagentResult>;

  /** Get result of background subagent */
  getResult(agentId: string): Promise<SubagentResult | null>;

  /** List running background subagents */
  listRunning(): string[];

  /** Cancel a background subagent */
  cancel(agentId: string): Promise<void>;
}

// ============================================================================
// PERMISSION TYPES
// ============================================================================

/**
 * Permission result
 */
export type PermissionResult = 'allow' | 'deny' | 'ask';

/**
 * Permission mode
 */
export type PermissionMode = 'default' | 'strict' | 'permissive';

/**
 * Permission rule conditions
 */
export interface PermissionConditions {
  /** Match specific parameter values */
  params?: Record<string, unknown>;

  /** Match file path patterns */
  pathPattern?: string;

  /** Match command patterns (for Bash) */
  commandPattern?: string;
}

/**
 * Permission rule
 */
export interface PermissionRule {
  /** Tool name or pattern */
  tool: string;

  /** Whether tool is a regex pattern */
  pattern?: boolean;

  /** Additional conditions */
  conditions?: PermissionConditions;
}

/**
 * Permission configuration
 */
export interface PermissionConfig {
  /** Permission mode */
  mode: PermissionMode;

  /** Rules that automatically allow */
  allow: PermissionRule[];

  /** Rules that automatically deny */
  deny: PermissionRule[];

  /** Rules that prompt for approval */
  ask: PermissionRule[];
}

// ============================================================================
// HOOK TYPES
// ============================================================================

/**
 * Hook event types
 */
export type HookEvent =
  | 'session_start'
  | 'user_prompt_submit'
  | 'pre_tool_use'
  | 'post_tool_use'
  | 'notification'
  | 'stop';

/**
 * Hook matcher
 */
export interface HookMatcher {
  tool?: string;
  toolPattern?: string;
}

/**
 * Hook configuration
 */
export interface HookConfig {
  /** Shell command to execute */
  command: string;

  /** Timeout in milliseconds */
  timeout?: number;

  /** Matcher for filtering */
  matcher?: HookMatcher;

  /** Environment variables */
  env?: Record<string, string>;

  /** Working directory */
  cwd?: string;
}

/**
 * Hook input (passed via stdin)
 */
export interface HookInput {
  event: HookEvent;
  timestamp: number;
  sessionId: string;
  message?: string;
  tool?: string;
  params?: Record<string, unknown>;
  result?: ToolResult;
  notification?: string;
}

/**
 * Hook result
 */
export interface HookResult {
  /** Whether action was blocked */
  blocked: boolean;

  /** Modified message */
  modifiedMessage?: string;

  /** Modified parameters */
  modifiedParams?: Record<string, unknown>;

  /** Custom output */
  output?: string;

  /** Error message */
  error?: string;
}
