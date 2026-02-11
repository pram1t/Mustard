/**
 * Global Keyboard Shortcuts
 *
 * Registers global shortcuts for quick access to the app.
 * These work even when the app doesn't have focus.
 */

import { globalShortcut } from 'electron';
import type { BrowserWindow } from 'electron';

/**
 * Register global keyboard shortcuts.
 * Called after window creation.
 */
export function registerGlobalShortcuts(mainWindow: BrowserWindow): void {
  // Toggle window visibility with a global shortcut
  const toggleRegistered = globalShortcut.register('CommandOrControl+Shift+O', () => {
    if (mainWindow.isVisible() && mainWindow.isFocused()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  if (!toggleRegistered) {
    console.warn('[Shortcuts] Failed to register Ctrl+Shift+O');
  }
}

/**
 * Unregister all global shortcuts.
 * Called on app quit.
 */
export function unregisterGlobalShortcuts(): void {
  globalShortcut.unregisterAll();
}
