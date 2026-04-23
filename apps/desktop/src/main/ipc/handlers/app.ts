import { ipcMain, app } from 'electron';
import { IPC_CHANNELS } from '../../../shared/ipc-channels';
import { validateSender } from '../validate-sender';
import { getUpdateService } from '../../services';

/**
 * Registers application-level IPC handlers.
 */
export function registerAppHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.APP_VERSION, async (event) => {
    validateSender(event);
    return app.getVersion();
  });

  ipcMain.handle(IPC_CHANNELS.APP_CHECK_UPDATE, async (event) => {
    validateSender(event);
    getUpdateService().checkForUpdates();
    return getUpdateService().getStatus();
  });

  ipcMain.handle(IPC_CHANNELS.APP_QUIT, async (event) => {
    validateSender(event);
    app.quit();
  });
}
