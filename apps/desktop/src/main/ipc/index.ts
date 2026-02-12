import { registerAgentHandlers } from './handlers/agent';
import { registerConfigHandlers } from './handlers/config';
import { registerMCPHandlers } from './handlers/mcp';
import { registerWindowHandlers } from './handlers/window';
import { registerAppHandlers } from './handlers/app';
import { registerDialogHandlers } from './handlers/dialog';

/**
 * Registers all IPC handlers.
 * Called once during app initialization in main/index.ts.
 *
 * Each handler group registers its own ipcMain.handle calls.
 * No business logic lives here — this is purely aggregation.
 */
export function registerIpcHandlers(): void {
  registerAgentHandlers();
  registerConfigHandlers();
  registerMCPHandlers();
  registerWindowHandlers();
  registerAppHandlers();
  registerDialogHandlers();
}
