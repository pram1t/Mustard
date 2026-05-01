/**
 * Context Manager Types
 *
 * Types for managing conversation context and token-based compaction.
 */

import type { Message } from '@pram1t/mustard-llm';

/**
 * Configuration for the context manager
 */
export interface ContextConfig {
  /**
   * Maximum tokens allowed in context window.
   * Default: 128000 (Claude/GPT-4 size)
   */
  maxTokens: number;

  /**
   * Threshold (0-1) at which to trigger compaction.
   * When token count exceeds (maxTokens * compactionThreshold), compact.
   * Default: 0.85
   */
  compactionThreshold: number;

  /**
   * Whether to always keep the system message during compaction.
   * Default: true
   */
  keepSystemMessage: boolean;

  /**
   * Number of recent messages to keep during compaction.
   * These are kept in addition to the system message.
   * Default: 10
   */
  keepRecentMessages: number;
}

/**
 * Default context configuration values
 */
export const DEFAULT_CONTEXT_CONFIG: ContextConfig = {
  maxTokens: 128000,
  compactionThreshold: 0.85,
  keepSystemMessage: true,
  keepRecentMessages: 10,
};

/**
 * Snapshot of the current context state
 */
export interface ContextState {
  /**
   * All messages in the context
   */
  messages: Message[];

  /**
   * Estimated total token count
   */
  tokenCount: number;

  /**
   * Token count for system message (if present)
   */
  systemTokens: number;

  /**
   * Whether context has been compacted
   */
  wasCompacted: boolean;

  /**
   * Number of messages removed during last compaction
   */
  messagesRemoved: number;
}
