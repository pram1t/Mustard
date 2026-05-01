/**
 * Agent Types
 *
 * Types for the agent loop and event streaming.
 */

import type { Message, ToolCall, ToolDefinition } from '@pram1t/mustard-llm';
import type { ToolResult, IToolRegistry } from '@pram1t/mustard-tools';
import type { HookExecutor, HookEvent as HookEventType } from '@pram1t/mustard-hooks';
import type { PermissionManager } from '../permissions/index.js';

// Re-export HookEvent for convenience
export type { HookEventType as HookEvent };
import type { ContextConfig } from '../context/types';
import { createSystemPrompt } from './system-prompt.js';

// ============================================================================
// Agent Configuration
// ============================================================================

/**
 * Configuration for the agent loop
 */
export interface AgentConfig {
  /**
   * Tool registry containing available tools
   */
  tools: IToolRegistry;

  /**
   * System prompt for the agent
   */
  systemPrompt?: string;

  /**
   * Maximum iterations (tool call loops) to prevent infinite loops.
   * Default: 50
   */
  maxIterations?: number;

  /**
   * Context configuration for managing conversation history
   */
  contextConfig?: Partial<ContextConfig>;

  /**
   * Working directory for tool execution
   */
  cwd?: string;

  /**
   * Session ID for audit logging
   */
  sessionId?: string;

  /**
   * Home directory for tools
   */
  homeDir?: string;

  /**
   * Hook executor for lifecycle events
   */
  hooks?: HookExecutor;

  /**
   * Permission manager for controlling tool access
   */
  permissions?: PermissionManager;

  /**
   * Enable subagent support (Task tool).
   * When true, a SubagentManager will be created and made available to tools.
   */
  enableSubagents?: boolean;
}

/**
 * Default agent configuration values.
 * Note: systemPrompt is a getter that dynamically generates an OS-aware prompt.
 */
export const DEFAULT_AGENT_CONFIG = {
  maxIterations: 50,
  /**
   * Default system prompt - dynamically generated with OS awareness.
   * This ensures all LLM providers know the platform they're running on.
   */
  get systemPrompt(): string {
    return createSystemPrompt();
  },
};

// ============================================================================
// Agent Events (for streaming)
// ============================================================================

/**
 * Text content event - streamed as the LLM generates text
 */
export interface TextEvent {
  type: 'text';
  content: string;
}

/**
 * Tool call event - when the LLM decides to call a tool
 */
export interface ToolCallEvent {
  type: 'tool_call';
  tool_call: ToolCall;
}

/**
 * Tool result event - after a tool has been executed
 */
export interface ToolResultEvent {
  type: 'tool_result';
  tool_call_id: string;
  tool_name: string;
  result: ToolResult;
}

/**
 * Error event - when an error occurs during processing
 */
export interface ErrorEvent {
  type: 'error';
  error: string;
  recoverable: boolean;
}

/**
 * Done event - signals the end of the agent loop
 */
export interface DoneEvent {
  type: 'done';
  totalIterations: number;
  totalToolCalls: number;
}

/**
 * Thinking event - when the agent is processing (useful for UI feedback)
 */
export interface ThinkingEvent {
  type: 'thinking';
  iteration: number;
}

/**
 * Context compaction event - when context was compacted
 */
export interface CompactionEvent {
  type: 'compaction';
  messagesRemoved: number;
  tokensRemoved: number;
}

/**
 * Hook triggered event - when a hook is executed
 */
export interface HookTriggeredEvent {
  type: 'hook_triggered';
  event: HookEventType;
  hookCount: number;
}

/**
 * Hook blocked event - when a hook blocks an action
 */
export interface HookBlockedEvent {
  type: 'hook_blocked';
  event: HookEventType;
  reason?: string;
}

/**
 * Hook output event - when a hook produces output
 */
export interface HookOutputEvent {
  type: 'hook_output';
  event: HookEventType;
  output: string;
}

/**
 * Permission denied event - when a tool is denied by permission rules
 */
export interface PermissionDeniedEvent {
  type: 'permission_denied';
  tool: string;
  reason: string;
}

/**
 * Permission ask event - when user approval is requested for a tool
 */
export interface PermissionAskEvent {
  type: 'permission_ask';
  tool: string;
  reason: string;
  approved?: boolean;
}

/**
 * Union type for all agent events
 */
export type AgentEvent =
  | TextEvent
  | ToolCallEvent
  | ToolResultEvent
  | ErrorEvent
  | DoneEvent
  | ThinkingEvent
  | CompactionEvent
  | HookTriggeredEvent
  | HookBlockedEvent
  | HookOutputEvent
  | PermissionDeniedEvent
  | PermissionAskEvent;

// ============================================================================
// Agent State
// ============================================================================

/**
 * Current state of the agent loop
 */
export interface AgentState {
  /**
   * Current iteration number
   */
  iteration: number;

  /**
   * Total tool calls made in this run
   */
  toolCallCount: number;

  /**
   * Whether the agent is currently running
   */
  isRunning: boolean;

  /**
   * Last error if any
   */
  lastError?: string;
}

/**
 * Run options for a single agent execution
 */
export interface RunOptions {
  /**
   * Abort signal for cancellation
   */
  signal?: AbortSignal;

  /**
   * Override max iterations for this run
   */
  maxIterations?: number;
}
