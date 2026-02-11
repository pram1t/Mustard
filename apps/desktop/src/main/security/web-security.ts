import { app, session } from 'electron';
import type { BrowserWindow } from 'electron';
import { buildCSPString, getCSP } from '../../shared/csp';

/**
 * Configures web security settings for the default session.
 * Includes security response headers and CSP header (belt-and-suspenders with meta tag).
 * Must be called after app.whenReady().
 */
export function configureWebSecurity(): void {
  const ses = session.defaultSession;
  const cspString = buildCSPString(getCSP(!app.isPackaged));

  ses.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [cspString],
        'X-Content-Type-Options': ['nosniff'],
        'X-Frame-Options': ['DENY'],
        'X-XSS-Protection': ['1; mode=block'],
      },
    });
  });

  console.log('Web security configured (CSP + security headers)');
}

/**
 * Permission decision map.
 * Most permissions are denied by default.
 */
const PERMISSION_DECISIONS: Record<string, 'grant' | 'deny' | 'prompt'> = {
  // Always deny
  'media': 'deny',
  'display-capture': 'deny',
  'geolocation': 'deny',
  'midi': 'deny',
  'midiSysex': 'deny',
  'pointerLock': 'deny',
  'idle-detection': 'deny',
  'clipboard-read': 'deny',
  'hid': 'deny',
  'serial': 'deny',
  'usb': 'deny',

  // Allow
  'fullscreen': 'grant',
  'clipboard-sanitized-write': 'grant',
  'storage-access': 'grant',
  'window-placement': 'grant',

  // Prompt (default deny until prompt UI is implemented)
  'notifications': 'prompt',
  'openExternal': 'prompt',
};

/**
 * Configures the permission handler for the default session.
 * Defaults to deny for most permissions. Verifies request origin.
 * Must be called after app.whenReady() and window creation.
 */
export function configurePermissionHandler(mainWindow: BrowserWindow): void {
  const ses = session.defaultSession;

  ses.setPermissionRequestHandler((webContents, permission, callback) => {
    if (webContents !== mainWindow.webContents) {
      console.warn(`Permission ${permission} denied: not main window`);
      callback(false);
      return;
    }

    const decision = PERMISSION_DECISIONS[permission] ?? 'deny';

    if (decision === 'grant') {
      callback(true);
    } else if (decision === 'prompt') {
      // TODO: Implement proper prompt UI in a later phase
      console.log(`Permission ${permission} denied (prompt not implemented)`);
      callback(false);
    } else {
      console.log(`Permission ${permission} denied by policy`);
      callback(false);
    }
  });

  ses.setPermissionCheckHandler((webContents, permission) => {
    if (webContents !== mainWindow.webContents) {
      return false;
    }
    const decision = PERMISSION_DECISIONS[permission] ?? 'deny';
    return decision === 'grant';
  });

  console.log('Permission handler configured');
}
