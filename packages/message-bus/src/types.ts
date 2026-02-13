/**
 * OpenAgent V2 - Message Bus Types
 *
 * In-memory event bus with wildcard pattern matching for inter-component communication.
 */

// =============================================================================
// MESSAGE TYPES
// =============================================================================

/**
 * Message type strings used across the system.
 * Format: "domain.action" (e.g., "task.created", "worker.status")
 */
export type MessageType =
  // Task lifecycle
  | 'task.created'
  | 'task.assigned'
  | 'task.started'
  | 'task.progress'
  | 'task.completed'
  | 'task.failed'
  | 'task.cancelled'
  // Worker events
  | 'worker.status'
  | 'worker.error'
  | 'worker.heartbeat'
  | 'worker.hired'
  | 'worker.fired'
  // Handoff events
  | 'handoff.requested'
  | 'handoff.started'
  | 'handoff.approved'
  | 'handoff.rejected'
  | 'handoff.completed'
  // Artifact events
  | 'artifact.created'
  | 'artifact.updated'
  | 'artifact.versioned'
  // Plan events
  | 'plan.created'
  | 'plan.approved'
  | 'plan.completed'
  | 'plan.failed'
  // System events
  | 'system.error'
  | 'system.warning'
  | 'system.info'
  // Allow custom string types
  | (string & {});

// =============================================================================
// MESSAGE ENVELOPE
// =============================================================================

/**
 * Message envelope wrapping every published message.
 */
export interface MessageEnvelope<T = unknown> {
  /** Unique message ID */
  id: string;

  /** Message type (e.g., "task.created") */
  type: MessageType;

  /** The message payload */
  payload: T;

  /** When the message was published */
  timestamp: Date;

  /** Optional correlation ID to link related messages */
  correlationId?: string;

  /** Source identifier (e.g., worker ID, service name) */
  source?: string;
}

// =============================================================================
// SUBSCRIPTION
// =============================================================================

/**
 * A subscription to messages matching a pattern.
 */
export interface Subscription {
  /** Unique subscription ID */
  id: string;

  /** Pattern to match (supports * wildcard, e.g., "task.*") */
  pattern: string;

  /** The handler function */
  handler: MessageHandler;
}

/**
 * Message handler function type.
 */
export type MessageHandler<T = unknown> = (message: MessageEnvelope<T>) => void | Promise<void>;

// =============================================================================
// PUBLISH OPTIONS
// =============================================================================

/**
 * Options when publishing a message.
 */
export interface PublishOptions {
  /** Correlation ID to link related messages */
  correlationId?: string;

  /** Source identifier */
  source?: string;
}

// =============================================================================
// HISTORY QUERY
// =============================================================================

/**
 * Query options for message history.
 */
export interface HistoryQuery {
  /** Filter by exact message type */
  type?: MessageType;

  /** Filter by correlation ID */
  correlationId?: string;

  /** Filter messages after this date */
  since?: Date;

  /** Maximum number of messages to return */
  limit?: number;
}

// =============================================================================
// BUS CONFIGURATION
// =============================================================================

/**
 * Configuration for the EventBus.
 */
export interface EventBusConfig {
  /** Maximum number of messages to keep in history (default: 1000) */
  maxHistory?: number;

  /** Whether to log messages (default: false) */
  debug?: boolean;
}

// =============================================================================
// BUS INTERFACE
// =============================================================================

/**
 * Interface for the message bus.
 */
export interface IMessageBus {
  /**
   * Publish a message to all matching subscribers.
   * @returns The message envelope that was published.
   */
  publish<T>(type: MessageType, payload: T, options?: PublishOptions): MessageEnvelope<T>;

  /**
   * Subscribe to messages matching a pattern.
   * Supports `*` wildcard: "task.*" matches "task.created", "task.completed", etc.
   * @returns Unsubscribe function.
   */
  subscribe<T = unknown>(pattern: string, handler: MessageHandler<T>): () => void;

  /**
   * Subscribe to a single message matching a pattern, then auto-unsubscribe.
   * @returns Promise that resolves with the first matching message.
   */
  once<T = unknown>(pattern: string, timeout?: number): Promise<MessageEnvelope<T>>;

  /**
   * Query message history.
   */
  getHistory(query?: HistoryQuery): MessageEnvelope[];

  /**
   * Get the number of active subscriptions.
   */
  getSubscriptionCount(): number;

  /**
   * Clear all history and subscriptions.
   */
  clear(): void;
}
