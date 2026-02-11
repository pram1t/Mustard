import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../../shared/ipc-channels';
import { validateSender } from '../validate-sender';
import { getAgentService } from '../../services';

/**
 * Registers agent-related IPC handlers.
 * Each handler: validateSender first, then delegate to AgentService.
 */
export function registerAgentHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.AGENT_CHAT, async (event, payload: { message: string }) => {
    validateSender(event);
    return getAgentService().chat(payload.message);
  });

  ipcMain.handle(IPC_CHANNELS.AGENT_STOP, async (event) => {
    validateSender(event);
    return getAgentService().stop();
  });

  ipcMain.handle(IPC_CHANNELS.AGENT_STATUS, async (event) => {
    validateSender(event);
    return getAgentService().getStatus();
  });
}
