import { app, BrowserWindow } from 'electron';
import { join } from 'path';
import { setDefaultLogger } from '@mustard/logger';
import type { Logger, LogContext } from '@mustard/logger';

// ── Root cause fix: Electron GUI has no stdout/stderr ────────────────────────
// When Electron runs as a GUI app (not from terminal), process.stdout and
// process.stderr are destroyed/broken pipes. ANY write to them (console.log,
// pino, etc.) throws EPIPE and crashes the app.
//
// Fix: Create a completely silent logger and replace console.* with noops.
// Logs are not needed in the main process — use renderer DevTools for debugging.

const noop = () => {};

// Silent logger for @openagent packages (replaces pino)
const silentLogger: Logger = {
  get level() { return 'silent' as any; },
  child(_ctx: LogContext) { return silentLogger; },
  trace: noop,
  debug: noop,
  info: noop,
  warn: noop,
  error: noop,
  fatal: noop,
};
setDefaultLogger(silentLogger);

// Replace console methods to prevent ANY stdout/stderr writes
console.log = noop;
console.debug = noop;
console.info = noop;
console.warn = noop;
console.error = noop;

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
import { enforceHTTPS } from './security/network-security';
import { IPC_CHANNELS } from '../shared/ipc-channels';

// ── Pre-ready security (must run before app.whenReady) ──────────────────────
configureAppSecurity();
configureSecureSwitches();
enforceSandbox();
registerProtocol();

// ── Deep link queue ─────────────────────────────────────────────────────────
// Stores a deep link URL that arrived before the window was ready.
let pendingDeepLink: string | null = null;

// Extract deep link from initial launch args (Windows/Linux only — macOS uses open-url event)
if (process.platform !== 'darwin') {
  pendingDeepLink = extractDeepLinkFromArgs(process.argv);
}

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
      // DevTools available via View menu or Ctrl+Shift+I — don't auto-open
      verifyContextIsolation(mainWindow).catch(() => {});
    }
    // Deliver any queued deep link after renderer has mounted
    if (pendingDeepLink) {
      const queued = pendingDeepLink;
      pendingDeepLink = null;
      setTimeout(() => handleDeepLink(queued), 100);
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
  enforceHTTPS();
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
  if (!win || win.isDestroyed()) {
    // Queue for delivery after window is ready
    pendingDeepLink = rawUrl;
    return;
  }

  if (win.webContents.isLoading()) {
    pendingDeepLink = rawUrl;
    return;
  }

  // Send structured payload via typed IPC channel
  win.webContents.send(IPC_CHANNELS.APP_NAVIGATE, {
    route: result.route,
    params: result.params,
  });
}
