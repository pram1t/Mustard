import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../../shared/ipc-channels';
import { validateSender } from '../validate-sender';

/**
 * Registers agent-related IPC handlers.
 * Stub implementations — real agent integration comes in Phase 5.
 */
export function registerAgentHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.AGENT_CHAT, async (event, _payload: { message: string }) => {
    validateSender(event);
    // TODO(phase-5): Forward to agent.chat(payload.message)
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.AGENT_STOP, async (event) => {
    validateSender(event);
    // TODO(phase-5): Forward to agent.stop()
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.AGENT_STATUS, async (event) => {
    validateSender(event);
    // TODO(phase-5): Forward to agent.getStatus()
    return { state: 'idle' as const };
  });
}
