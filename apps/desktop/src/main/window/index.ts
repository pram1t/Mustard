import type { BrowserWindow } from 'electron';

/**
 * Reference to the main window.
 * Used by IPC handlers to send events.
 */
let mainWindow: BrowserWindow | null = null;

export function setMainWindow(window: BrowserWindow | null): void {
  mainWindow = window;
}

export function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}

export function getMainWindowOrThrow(): BrowserWindow {
  if (!mainWindow) {
    throw new Error('Main window not initialized');
  }
  return mainWindow;
}
