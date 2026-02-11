import { app } from 'electron';

/**
 * Configures app-level security settings.
 * Must be called before app is ready.
 */
export function configureAppSecurity(): void {
  // Prevent Electron from being used as a plain Node.js process
  delete process.env.ELECTRON_RUN_AS_NODE;
}

/**
 * Configures command line switches for security.
 * Must be called before app is ready.
 */
export function configureSecureSwitches(): void {
  // Disable remote debugging in production
  if (app.isPackaged) {
    app.commandLine.appendSwitch('remote-debugging-port', '0');
  }

  // Require user gesture for autoplay
  app.commandLine.appendSwitch('autoplay-policy', 'user-gesture-required');
}
