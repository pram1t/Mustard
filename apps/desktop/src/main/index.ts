import { app, BrowserWindow } from 'electron';
import { join } from 'path';
import { configureAppSecurity, configureSecureSwitches } from './security/app-security';
import { enforceSandbox } from './security/sandbox';
import { configureWebSecurity, configurePermissionHandler } from './security/web-security';
import { verifyContextIsolation } from './security/verify-isolation';
import { createSecureWindow } from './window/factory';
import { setMainWindow, getMainWindow } from './window';
import { loadWindowState, saveWindowState } from './window/state';
import { registerIpcHandlers } from './ipc';

// ── Pre-ready security (must run before app.whenReady) ──────────────────────
configureAppSecurity();
configureSecureSwitches();
enforceSandbox();

// ── Single instance lock (production only) ──────────────────────────────────
if (app.isPackaged) {
  const gotTheLock = app.requestSingleInstanceLock();
  if (!gotTheLock) {
    app.quit();
  } else {
    app.on('second-instance', () => {
      const win = getMainWindow();
      if (win) {
        if (win.isMinimized()) win.restore();
        win.focus();
      }
    });
  }
}

// ── Window creation ─────────────────────────────────────────────────────────
async function createMainWindow(): Promise<void> {
  const savedState = loadWindowState();

  const mainWindow = createSecureWindow({
    width: savedState?.width ?? 900,
    height: savedState?.height ?? 700,
    x: savedState?.x,
    y: savedState?.y,
    minWidth: 400,
    minHeight: 300,
    title: 'OpenAgent',
  });

  setMainWindow(mainWindow);

  if (savedState?.isMaximized) {
    mainWindow.maximize();
  }

  // Load renderer
  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    await mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    await mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }

  mainWindow.once('ready-to-show', async () => {
    if (!app.isPackaged) {
      await verifyContextIsolation(mainWindow);
      mainWindow.webContents.openDevTools();
    }
    mainWindow.show();
  });

  mainWindow.on('close', () => {
    saveWindowState(mainWindow);
  });

  mainWindow.on('closed', () => {
    setMainWindow(null);
  });
}

// ── App lifecycle ───────────────────────────────────────────────────────────
app.whenReady().then(async () => {
  configureWebSecurity();
  configurePermissionHandler();
  registerIpcHandlers();
  await createMainWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', async () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    await createMainWindow();
  }
});
