/**
 * Bus adapter for ModeManager.
 *
 * Mirrors the pattern used by @openagent/collab-ai's bus adapter: local
 * listeners stay synchronous and typed; the bus is the cross-package
 * fan-out channel.
 */

import type { IMessageBus, MessageType } from '@openagent/message-bus';
import type { ModeChangeEvent } from './types.js';
import type { ModeManager } from './mode-manager.js';

// ============================================================================
// Topics
// ============================================================================

/**
 * Canonical bus topics. Consumers subscribe with the specific topic or
 * the wildcard.
 */
export const MODE_TOPICS = {
  changed: 'collab.permissions.mode.changed',
} as const;

export const MODE_TOPIC_WILDCARD = 'collab.permissions.mode.*';

// ============================================================================
// Attach
// ============================================================================

export interface AttachModeManagerOptions {
  /**
   * Optional envelope source. Defaults to the ModeManager's roomId so
   * downstream filters like `envelope.source === roomId` work out of
   * the box.
   */
  source?: string;
}

/**
 * Forward mode-change events from a ModeManager to a message bus.
 * Returns a disposer.
 */
export function attachModeManagerToBus(
  manager: ModeManager,
  bus: IMessageBus,
  options: AttachModeManagerOptions = {},
): () => void {
  const source = options.source ?? manager.getRoomId();

  const unsub = manager.on('changed', (event: ModeChangeEvent) => {
    bus.publish(MODE_TOPICS.changed as MessageType, event, { source });
  });

  return () => {
    try {
      unsub();
    } catch {
      /* swallow — symmetric with ModeManager.emit */
    }
  };
}
