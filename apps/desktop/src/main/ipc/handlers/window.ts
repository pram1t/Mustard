import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../../shared/ipc-channels';
import { validateSender } from '../validate-sender';
import { getMainWindow } from '../../window';

/**
 * Registers window control IPC handlers.
 * These forward commands directly to BrowserWindow.
 */
export function registerWindowHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.WINDOW_MINIMIZE, async (event) => {
    validateSender(event);
    getMainWindow()?.minimize();
  });

  ipcMain.handle(IPC_CHANNELS.WINDOW_MAXIMIZE, async (event) => {
    validateSender(event);
    const win = getMainWindow();
    if (win?.isMaximized()) win.unmaximize();
    else win?.maximize();
  });

  ipcMain.handle(IPC_CHANNELS.WINDOW_CLOSE, async (event) => {
    validateSender(event);
    getMainWindow()?.close();
  });

  ipcMain.handle(IPC_CHANNELS.WINDOW_IS_MAXIMIZED, async (event) => {
    validateSender(event);
    return getMainWindow()?.isMaximized() ?? false;
  });
}
