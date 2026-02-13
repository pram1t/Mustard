/**
 * OpenAgent V2 - EventBus Implementation
 *
 * In-memory pub/sub message bus with wildcard pattern matching.
 * Supports "task.*" patterns to match "task.created", "task.completed", etc.
 */

import { randomUUID } from 'node:crypto';
import type {
  EventBusConfig,
  HistoryQuery,
  IMessageBus,
  MessageEnvelope,
  MessageHandler,
  MessageType,
  PublishOptions,
  Subscription,
} from './types.js';

/**
 * Convert a subscription pattern to a RegExp.
 * Supports `*` as a single-segment wildcard.
 * Examples:
 *   "task.*"     → matches "task.created", "task.failed"
 *   "*.error"    → matches "worker.error", "system.error"
 *   "*"          → matches everything
 *   "task.created" → exact match only
 */
function patternToRegex(pattern: string): RegExp {
  const escaped = pattern
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&') // escape regex specials (except *)
    .replace(/\\\./g, '\\.') // fix double-escaped dots
    .replace(/\*/g, '[^.]+'); // * matches one segment (no dots)
  return new RegExp(`^${escaped}$`);
}

/**
 * In-memory event bus with pattern matching and message history.
 */
export class EventBus implements IMessageBus {
  private subscriptions = new Map<string, Subscription>();
  private history: MessageEnvelope[] = [];
  private maxHistory: number;
  private debug: boolean;

  constructor(config?: EventBusConfig) {
    this.maxHistory = config?.maxHistory ?? 1000;
    this.debug = config?.debug ?? false;
  }

  /**
   * Publish a message to all matching subscribers.
   */
  publish<T>(type: MessageType, payload: T, options?: PublishOptions): MessageEnvelope<T> {
    const envelope: MessageEnvelope<T> = {
      id: randomUUID(),
      type,
      payload,
      timestamp: new Date(),
      correlationId: options?.correlationId,
      source: options?.source,
    };

    // Add to history
    this.history.push(envelope as MessageEnvelope);
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }

    if (this.debug) {
      console.log(`[EventBus] publish: ${type}`, payload);
    }

    // Notify matching subscribers
    for (const sub of this.subscriptions.values()) {
      const regex = patternToRegex(sub.pattern);
      if (regex.test(type)) {
        try {
          sub.handler(envelope as MessageEnvelope);
        } catch (err) {
          // Don't let subscriber errors break the bus
          if (this.debug) {
            console.error(`[EventBus] subscriber error for pattern "${sub.pattern}":`, err);
          }
        }
      }
    }

    return envelope;
  }

  /**
   * Subscribe to messages matching a pattern.
   * Returns an unsubscribe function.
   */
  subscribe<T = unknown>(pattern: string, handler: MessageHandler<T>): () => void {
    const id = randomUUID();
    const subscription: Subscription = {
      id,
      pattern,
      handler: handler as MessageHandler,
    };

    this.subscriptions.set(id, subscription);

    if (this.debug) {
      console.log(`[EventBus] subscribe: ${pattern} (id: ${id})`);
    }

    // Return unsubscribe function
    return () => {
      this.subscriptions.delete(id);
      if (this.debug) {
        console.log(`[EventBus] unsubscribe: ${pattern} (id: ${id})`);
      }
    };
  }

  /**
   * Subscribe to a single message matching a pattern, then auto-unsubscribe.
   * Optionally specify a timeout in milliseconds.
   */
  once<T = unknown>(pattern: string, timeout?: number): Promise<MessageEnvelope<T>> {
    return new Promise<MessageEnvelope<T>>((resolve, reject) => {
      let timer: ReturnType<typeof setTimeout> | undefined;

      const unsubscribe = this.subscribe<T>(pattern, (message) => {
        if (timer) clearTimeout(timer);
        unsubscribe();
        resolve(message as MessageEnvelope<T>);
      });

      if (timeout !== undefined) {
        timer = setTimeout(() => {
          unsubscribe();
          reject(new Error(`EventBus.once("${pattern}") timed out after ${timeout}ms`));
        }, timeout);
      }
    });
  }

  /**
   * Query message history with optional filters.
   */
  getHistory(query?: HistoryQuery): MessageEnvelope[] {
    if (!query) {
      return [...this.history];
    }

    let results = this.history;

    if (query.type) {
      results = results.filter((m) => m.type === query.type);
    }

    if (query.correlationId) {
      results = results.filter((m) => m.correlationId === query.correlationId);
    }

    if (query.since) {
      const since = query.since.getTime();
      results = results.filter((m) => m.timestamp.getTime() >= since);
    }

    if (query.limit) {
      results = results.slice(-query.limit);
    }

    return [...results];
  }

  /**
   * Get the number of active subscriptions.
   */
  getSubscriptionCount(): number {
    return this.subscriptions.size;
  }

  /**
   * Clear all history and subscriptions.
   */
  clear(): void {
    this.subscriptions.clear();
    this.history = [];
  }
}
