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
import { initializeServices, disposeServices } from './services';
import { initAllowedPaths } from './security/path-validation';
import { registerProtocol, parseDeepLink, extractDeepLinkFromArgs } from './protocol/deep-link';
import { createTray, destroyTray } from './window/tray';
import { registerGlobalShortcuts, unregisterGlobalShortcuts } from './window/shortcuts';

// ── Pre-ready security (must run before app.whenReady) ──────────────────────
configureAppSecurity();
configureSecureSwitches();
enforceSandbox();
registerProtocol();

// ── Single instance lock (production only) ──────────────────────────────────
if (app.isPackaged) {
  const gotTheLock = app.requestSingleInstanceLock();
  if (!gotTheLock) {
    app.quit();
  } else {
    app.on('second-instance', (_event, argv) => {
      const win = getMainWindow();
      if (win) {
        if (win.isMinimized()) win.restore();
        win.focus();

        // Handle deep link from second instance (Windows/Linux)
        const deepLink = extractDeepLinkFromArgs(argv);
        if (deepLink) {
          handleDeepLink(deepLink);
        }
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
  configurePermissionHandler(mainWindow);

  if (savedState?.isMaximized) {
    mainWindow.maximize();
  }

  // Register ready-to-show BEFORE loading content (event fires once)
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    if (!app.isPackaged) {
      mainWindow.webContents.openDevTools();
      // Verify after show so it doesn't block window display
      verifyContextIsolation(mainWindow).catch((err) =>
        console.error('Context isolation verification failed:', err)
      );
    }
  });

  // Load renderer
  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    await mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    await mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }

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
  initAllowedPaths();
  await initializeServices();
  registerIpcHandlers();
  await createMainWindow();

  // Set up tray and global shortcuts after window creation
  const mainWindow = getMainWindow();
  if (mainWindow) {
    createTray(mainWindow);
    registerGlobalShortcuts(mainWindow);
  }
});

app.on('before-quit', () => {
  unregisterGlobalShortcuts();
  destroyTray();
  disposeServices();
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

// ── Deep link handling (macOS) ──────────────────────────────────────────────
app.on('open-url', (event, url) => {
  event.preventDefault();
  handleDeepLink(url);
});

function handleDeepLink(rawUrl: string): void {
  const result = parseDeepLink(rawUrl);
  if (!result) return;

  const win = getMainWindow();
  if (!win) return;

  // Navigate to the deep link route via hash
  const params = new URLSearchParams(result.params).toString();
  const hash = params ? `${result.route}?${params}` : result.route;
  win.webContents.send('navigate', hash);
  console.log(`[DeepLink] Navigated to: ${hash}`);
}
