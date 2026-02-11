import { getMainWindow } from '../window';
import { IPC_CHANNELS } from '../../shared/ipc-channels';
import { isValidEvent } from '../../shared/event-types';
import type { AgentEvent, AgentStatus } from '../../shared/event-types';

/**
 * Sends an AgentEvent from main process to renderer.
 * Uses webContents.send (one-way, no response expected).
 *
 * Guards:
 * - Window must exist and not be destroyed
 * - Event must pass validation
 */
export function emitEvent(event: AgentEvent): void {
  const window = getMainWindow();
  if (!window || window.isDestroyed()) {
    return;
  }

  if (!isValidEvent(event as unknown)) {
    console.error('IPC event-emitter: Invalid event dropped');
    return;
  }

  window.webContents.send(IPC_CHANNELS.AGENT_EVENT, event);
}

/**
 * Convenience: emit a status event.
 */
export function emitStatus(
  sessionId: string,
  status: AgentStatus,
  message?: string,
): void {
  emitEvent({
    version: 1,
    type: 'status',
    timestamp: Date.now(),
    sessionId,
    data: { status, message },
  });
}
