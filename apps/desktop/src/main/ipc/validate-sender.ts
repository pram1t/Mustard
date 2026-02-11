import type { IpcMainInvokeEvent } from 'electron';
import { getMainWindow } from '../window';

/**
 * Validates that an IPC message originated from the main window.
 * Must be the first call in every ipcMain.handle callback.
 *
 * Checks:
 * 1. event.senderFrame exists
 * 2. event.sender matches mainWindow.webContents
 * 3. Origin is file:// or app://
 */
export function validateSender(event: IpcMainInvokeEvent): void {
  if (!event.senderFrame) {
    throw new Error('IPC: No sender frame');
  }

  const mainWindow = getMainWindow();
  if (!mainWindow || event.sender !== mainWindow.webContents) {
    throw new Error('IPC: Unauthorized sender');
  }

  const url = event.senderFrame.url;
  if (!url.startsWith('file://') && !url.startsWith('app://')) {
    throw new Error(`IPC: Unauthorized origin: ${url}`);
  }
}
