/**
 * Bus adapter for the IntentEngine.
 *
 * Fans IntentEngine events out to an @openagent/message-bus instance so
 * cross-package consumers (Phase-6 collab-permissions, the web
 * workspace, the Phase-11 agent-loop integration) can subscribe without
 * holding a direct reference to the engine.
 *
 * The adapter is additive — it doesn't replace IntentEngine's local
 * `on()` subscribers. Local subscribers (tests, in-process cleanup,
 * AgentRegistry.touch) stay synchronous and typed; the bus is the
 * cross-package fan-out channel.
 *
 * Emission is synchronous: local listeners fire first, then the
 * adapter's listener publishes to the bus in the same microtask as the
 * state transition. Bus subscribers with synchronous handlers see the
 * event before the calling code regains control.
 */

import type { IMessageBus, MessageType } from '@openagent/message-bus';
import type { IntentEngine } from './intent-engine.js';
import type { Intent } from './types.js';

// ============================================================================
// Topics
// ============================================================================

/**
 * IntentEngine event names that are forwarded to the bus. These match
 * the strings passed to `engine.on(event, ...)`. Note that `proposed`
 * is the initial-emission event, not a status value — hence a local
 * type rather than `Exclude<IntentStatus, ...>`.
 */
export type IntentEventName =
  | 'proposed'
  | 'approved'
  | 'rejected'
  | 'executing'
  | 'completed'
  | 'failed'
  | 'invalidated';

/**
 * Canonical bus topic names for IntentEngine events. Consumers subscribe
 * with `collab.ai.intent.*` or one of these specific topics.
 */
export const INTENT_TOPICS = {
  proposed: 'collab.ai.intent.proposed',
  approved: 'collab.ai.intent.approved',
  rejected: 'collab.ai.intent.rejected',
  executing: 'collab.ai.intent.executing',
  completed: 'collab.ai.intent.completed',
  failed: 'collab.ai.intent.failed',
  invalidated: 'collab.ai.intent.invalidated',
} as const satisfies Record<IntentEventName, string>;

/**
 * Wildcard pattern that matches every intent topic. Convenience for
 * consumers that want to observe all transitions.
 */
export const INTENT_TOPIC_WILDCARD = 'collab.ai.intent.*';

const FORWARD_MAP: ReadonlyArray<[IntentEventName, (typeof INTENT_TOPICS)[IntentEventName]]> = [
  ['proposed', INTENT_TOPICS.proposed],
  ['approved', INTENT_TOPICS.approved],
  ['rejected', INTENT_TOPICS.rejected],
  ['executing', INTENT_TOPICS.executing],
  ['completed', INTENT_TOPICS.completed],
  ['failed', INTENT_TOPICS.failed],
  ['invalidated', INTENT_TOPICS.invalidated],
];

// ============================================================================
// Attach
// ============================================================================

export interface AttachIntentEngineOptions {
  /**
   * Optional `source` string attached to every published envelope. Useful
   * when multiple engines share a bus (e.g., one per room).
   */
  source?: string;
}

/**
 * Attach an IntentEngine to a message bus. Every intent-lifecycle event
 * is forwarded to the corresponding topic.
 *
 * @returns a disposer that detaches every forwarded listener. Call it on
 *   teardown; the engine and bus remain live for other consumers.
 */
export function attachIntentEngineToBus(
  engine: IntentEngine,
  bus: IMessageBus,
  options: AttachIntentEngineOptions = {},
): () => void {
  const disposers: Array<() => void> = [];

  for (const [event, topic] of FORWARD_MAP) {
    const unsub = engine.on(event, (intent: Intent) => {
      bus.publish(topic as MessageType, intent, {
        source: options.source,
      });
    });
    if (unsub) disposers.push(unsub);
  }

  return () => {
    for (const dispose of disposers) {
      try {
        dispose();
      } catch {
        /* swallow — match IntentEngine's listener error policy */
      }
    }
  };
}
