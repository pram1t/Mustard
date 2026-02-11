import { BrowserWindow } from 'electron';
import type { BrowserWindowConstructorOptions } from 'electron';
import { join } from 'path';
import { getSecureWindowDefaults, validateSecureOptions } from './defaults';
import { configureDevTools } from '../security/devtools';

/**
 * Creates a secure BrowserWindow.
 * All window creation MUST go through this factory.
 */
export function createSecureWindow(
  customOptions: Partial<BrowserWindowConstructorOptions> = {}
): BrowserWindow {
  const preloadPath = join(__dirname, '../preload/index.js');
  const defaults = getSecureWindowDefaults(preloadPath);

  // Merge options, but never allow overriding security settings
  const options: BrowserWindowConstructorOptions = {
    ...defaults,
    ...customOptions,
    webPreferences: {
      ...defaults.webPreferences,
      // Only allow customizing non-security settings
      spellcheck: customOptions.webPreferences?.spellcheck ?? defaults.webPreferences!.spellcheck,
    },
  };

  // Validate before creation
  validateSecureOptions(options);

  const window = new BrowserWindow(options);

  setupSecurityHandlers(window);
  configureDevTools(window);

  return window;
}

/**
 * Sets up security-related event handlers for a window.
 */
function setupSecurityHandlers(window: BrowserWindow): void {
  // Prevent navigation to arbitrary URLs
  window.webContents.on('will-navigate', (event, url) => {
    const allowed = ['file://', 'app://'];
    if (!allowed.some(prefix => url.startsWith(prefix))) {
      console.warn(`Blocked navigation to: ${url}`);
      event.preventDefault();
    }
  });

  // Prevent new window creation
  window.webContents.setWindowOpenHandler(({ url }) => {
    console.warn(`Blocked window.open for: ${url}`);
    return { action: 'deny' };
  });

  // Log security-relevant console messages from renderer
  window.webContents.on('console-message', (_event, level, message) => {
    if (level >= 2) {
      console.log(`[Renderer Console] ${message}`);
    }
  });
}
