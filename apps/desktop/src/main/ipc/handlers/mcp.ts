import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../../shared/ipc-channels';
import { validateSender } from '../validate-sender';

/**
 * Registers MCP (Model Context Protocol) IPC handlers.
 * Stub implementations — real MCP service comes in Phase 8+.
 */
export function registerMCPHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.MCP_LIST, async (event) => {
    validateSender(event);
    return [];
  });

  ipcMain.handle(IPC_CHANNELS.MCP_ADD, async (event, _payload: { server: { name: string; command: string; args?: string[]; env?: Record<string, string> } }) => {
    validateSender(event);
    return { success: true, serverId: 'stub-id' };
  });

  ipcMain.handle(IPC_CHANNELS.MCP_REMOVE, async (event, _payload: { serverId: string }) => {
    validateSender(event);
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.MCP_STATUS, async (event, _payload: { serverId: string }) => {
    validateSender(event);
    return { id: 'stub-id', status: 'disconnected' as const };
  });

  ipcMain.handle(IPC_CHANNELS.MCP_RESTART, async (event, _payload: { serverId: string }) => {
    validateSender(event);
    return { success: true };
  });
}
