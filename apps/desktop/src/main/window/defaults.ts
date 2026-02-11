import type { BrowserWindowConstructorOptions } from 'electron';

/**
 * Security-hardened defaults for all BrowserWindow instances.
 * These MUST be used for every window creation.
 */
export function getSecureWindowDefaults(
  preloadPath: string
): BrowserWindowConstructorOptions {
  return {
    webPreferences: {
      // SECURITY CRITICAL - Never change these
      contextIsolation: true,
      nodeIntegration: false,
      nodeIntegrationInWorker: false,
      nodeIntegrationInSubFrames: false,
      sandbox: true,
      webSecurity: true,
      webviewTag: false,

      // Preload configuration
      preload: preloadPath,

      // Additional hardening
      experimentalFeatures: false,
      navigateOnDragDrop: false,
      allowRunningInsecureContent: false,
      spellcheck: true,
    },

    // Window defaults
    show: false, // Show after ready-to-show
    backgroundColor: '#1e1e1e',
  };
}

/**
 * Validates that a window options object has secure settings.
 * Throws if any security-critical setting is wrong.
 */
export function validateSecureOptions(
  options: BrowserWindowConstructorOptions
): void {
  const wp = options.webPreferences;

  if (!wp) {
    throw new Error('webPreferences is required');
  }

  if (wp.contextIsolation !== true) {
    throw new Error('contextIsolation must be true');
  }

  if (wp.nodeIntegration !== false) {
    throw new Error('nodeIntegration must be false');
  }

  if (wp.sandbox !== true) {
    throw new Error('sandbox must be true');
  }

  if (wp.webSecurity !== true) {
    throw new Error('webSecurity must be true');
  }

  if (wp.webviewTag !== false) {
    throw new Error('webviewTag must be false');
  }
}
