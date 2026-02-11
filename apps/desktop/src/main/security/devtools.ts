import { app } from 'electron';
import type { BrowserWindow } from 'electron';

/**
 * Checks if DevTools should be enabled.
 */
export function isDevToolsAllowed(): boolean {
  return !app.isPackaged;
}

/**
 * Controls DevTools access based on environment.
 */
export function configureDevTools(window: BrowserWindow): void {
  if (isDevToolsAllowed()) {
    // Allow DevTools in development via keyboard shortcut
    window.webContents.on('before-input-event', (_event, input) => {
      if (
        input.type === 'keyDown' &&
        input.key === 'I' &&
        (input.control || input.meta) &&
        input.shift
      ) {
        window.webContents.toggleDevTools();
      }
    });
  } else {
    // Disable DevTools in production
    window.webContents.on('devtools-opened', () => {
      window.webContents.closeDevTools();
    });

    window.webContents.on('before-input-event', (event, input) => {
      if (
        input.type === 'keyDown' &&
        input.key === 'I' &&
        (input.control || input.meta) &&
        input.shift
      ) {
        event.preventDefault();
      }
    });
  }
}
