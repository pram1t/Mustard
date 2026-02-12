import { ipcMain, dialog } from 'electron';
import { IPC_CHANNELS } from '../../../shared/ipc-channels';
import { validateSender } from '../validate-sender';
import { getMainWindow } from '../../window';
import { getAgentService } from '../../services';

/**
 * Registers dialog IPC handlers.
 */
export function registerDialogHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.DIALOG_SELECT_FOLDER, async (event) => {
    validateSender(event);

    const win = getMainWindow();
    const result = await dialog.showOpenDialog(win!, {
      properties: ['openDirectory'],
      title: 'Select Project Folder',
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    const folder = result.filePaths[0];
    getAgentService().setCwd(folder);
    return folder;
  });
}
