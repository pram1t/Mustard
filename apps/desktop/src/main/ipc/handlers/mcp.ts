import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../../shared/ipc-channels';
import { validateSender } from '../validate-sender';
import { getMCPService } from '../../services';

/**
 * Registers MCP (Model Context Protocol) IPC handlers.
 * Each handler: validateSender first, then delegate to MCPService.
 */
export function registerMCPHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.MCP_LIST, async (event) => {
    validateSender(event);
    return getMCPService().listServers();
  });

  ipcMain.handle(IPC_CHANNELS.MCP_ADD, async (event, payload: { server: { name: string; command: string; args?: string[]; env?: Record<string, string> } }) => {
    validateSender(event);
    return getMCPService().addServer(payload.server);
  });

  ipcMain.handle(IPC_CHANNELS.MCP_REMOVE, async (event, payload: { serverId: string }) => {
    validateSender(event);
    return getMCPService().removeServer(payload.serverId);
  });

  ipcMain.handle(IPC_CHANNELS.MCP_STATUS, async (event, payload: { serverId: string }) => {
    validateSender(event);
    return getMCPService().getStatus(payload.serverId);
  });

  ipcMain.handle(IPC_CHANNELS.MCP_RESTART, async (event, payload: { serverId: string }) => {
    validateSender(event);
    return getMCPService().restartServer(payload.serverId);
  });
}
