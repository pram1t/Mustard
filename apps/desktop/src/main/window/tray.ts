/**
 * System Tray Integration
 *
 * Creates a system tray icon with context menu for quick access.
 * Minimizes to tray on close (optional).
 */

import { Tray, Menu, nativeImage, app } from 'electron';
import type { BrowserWindow } from 'electron';
import path from 'path';
import { IPC_CHANNELS } from '../../shared/ipc-channels';

let tray: Tray | null = null;

/**
 * Create and configure the system tray icon.
 */
export function createTray(mainWindow: BrowserWindow): Tray {
  // Use a simple 16x16 icon - in production this would be a proper asset
  const iconPath = path.join(__dirname, '../../resources/icon.png');
  let icon: Electron.NativeImage;

  try {
    icon = nativeImage.createFromPath(iconPath);
  } catch {
    // Fallback: create a simple empty icon for development
    icon = nativeImage.createEmpty();
  }

  // Resize for tray (16x16 on most platforms)
  if (!icon.isEmpty()) {
    icon = icon.resize({ width: 16, height: 16 });
  }

  tray = new Tray(icon);
  tray.setToolTip('OpenAgent');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show Window',
      click: () => {
        mainWindow.show();
        mainWindow.focus();
      },
    },
    { type: 'separator' },
    {
      label: 'New Chat',
      click: () => {
        mainWindow.show();
        mainWindow.focus();
        mainWindow.webContents.send(IPC_CHANNELS.APP_NAVIGATE, { route: '/', params: {} });
      },
    },
    {
      label: 'Settings',
      click: () => {
        mainWindow.show();
        mainWindow.focus();
        mainWindow.webContents.send(IPC_CHANNELS.APP_NAVIGATE, { route: '/settings', params: {} });
      },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);

  // Click on tray icon shows the window
  tray.on('click', () => {
    if (mainWindow.isVisible()) {
      mainWindow.focus();
    } else {
      mainWindow.show();
    }
  });

  return tray;
}

/**
 * Destroy the tray icon.
 */
export function destroyTray(): void {
  if (tray) {
    tray.destroy();
    tray = null;
  }
}
