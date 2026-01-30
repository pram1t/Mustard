/**
 * Session Types
 *
 * Types for session persistence and management.
 * Sessions store conversation context to disk for resumption.
 */

import type { ContextState } from '../context/types.js';

/**
 * Session metadata
 */
export interface SessionMetadata {
  /** Working directory when session was created */
  cwd: string;

  /** ISO timestamp when session was created */
  createdAt: string;

  /** ISO timestamp when session was last updated */
  updatedAt: string;

  /** Number of messages in the session */
  messageCount: number;

  /** LLM provider name (e.g., 'openai', 'anthropic') */
  provider?: string;

  /** Model name used */
  model?: string;
}

/**
 * Complete session data for persistence
 */
export interface SessionData {
  /** Unique session identifier */
  id: string;

  /** Schema version for future migrations */
  version: 1;

  /** Session metadata */
  metadata: SessionMetadata;

  /** Conversation context state */
  context: ContextState;
}

/**
 * Session list item for display
 */
export interface SessionListItem {
  /** Unique session identifier */
  id: string;

  /** ISO timestamp when session was created */
  createdAt: string;

  /** ISO timestamp when session was last updated */
  updatedAt: string;

  /** Number of messages in the session */
  messageCount: number;

  /** Working directory when session was created */
  cwd: string;
}
