import { app, ipcMain } from 'electron';

/**
 * Registers IPC handlers.
 * Phase 2: Only app:version handler.
 * Full IPC implementation comes in Phase 4.
 */
export function registerIpcHandlers(): void {
  ipcMain.handle('app:version', () => {
    return app.getVersion();
  });
}
