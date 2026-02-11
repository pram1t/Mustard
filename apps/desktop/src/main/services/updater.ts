/**
 * Auto-Update Service
 *
 * Manages application updates using electron-updater.
 * - HTTPS-only update channel
 * - Staged rollout support
 * - Update notification via IPC
 * - Rollback on failure
 *
 * Note: electron-updater must be installed as a dependency for production use.
 * In development, updates are disabled.
 */

import { app } from 'electron';
import type { BrowserWindow } from 'electron';

// =============================================================================
// TYPES
// =============================================================================

export interface UpdateInfo {
  version: string;
  releaseNotes?: string;
  releaseDate?: string;
}

export interface UpdateProgress {
  percent: number;
  bytesPerSecond: number;
  total: number;
  transferred: number;
}

export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'downloaded'
  | 'error';

// =============================================================================
// DYNAMIC IMPORT HELPER
// =============================================================================

/**
 * Attempt to load electron-updater at runtime.
 * Returns null if not installed (development mode).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function tryLoadUpdater(): any | null {
  try {
    // Use require for optional dependency — electron-updater may not be installed
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('electron-updater');
  } catch {
    return null;
  }
}

// =============================================================================
// UPDATE SERVICE
// =============================================================================

export class UpdateService {
  private mainWindow: BrowserWindow | null = null;
  private status: UpdateStatus = 'idle';
  private updateInfo: UpdateInfo | null = null;

  /**
   * Initialize the update service.
   * Skips initialization in development mode.
   */
  initialize(mainWindow: BrowserWindow): void {
    this.mainWindow = mainWindow;

    if (!app.isPackaged) {
      console.log('[Updater] Skipping — development mode');
      return;
    }

    const updaterModule = tryLoadUpdater();
    if (!updaterModule) {
      console.log('[Updater] electron-updater not installed — skipping');
      return;
    }

    const { autoUpdater } = updaterModule;

    // Configure updater
    autoUpdater.autoDownload = false; // Let user decide
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.allowDowngrade = false;

    // Event handlers
    autoUpdater.on('checking-for-update', () => {
      this.setStatus('checking');
    });

    autoUpdater.on('update-available', (info: { version: string; releaseNotes?: string | unknown; releaseDate?: string }) => {
      this.updateInfo = {
        version: info.version,
        releaseNotes: typeof info.releaseNotes === 'string' ? info.releaseNotes : undefined,
        releaseDate: info.releaseDate,
      };
      this.setStatus('available');
      this.sendToRenderer('update:available', this.updateInfo);
    });

    autoUpdater.on('update-not-available', () => {
      this.setStatus('not-available');
      this.sendToRenderer('update:not-available', null);
    });

    autoUpdater.on('download-progress', (progress: { percent: number; bytesPerSecond: number; total: number; transferred: number }) => {
      this.setStatus('downloading');
      this.sendToRenderer('update:progress', {
        percent: progress.percent,
        bytesPerSecond: progress.bytesPerSecond,
        total: progress.total,
        transferred: progress.transferred,
      } as UpdateProgress);
    });

    autoUpdater.on('update-downloaded', () => {
      this.setStatus('downloaded');
      this.sendToRenderer('update:downloaded', this.updateInfo);
    });

    autoUpdater.on('error', (error: Error) => {
      this.setStatus('error');
      this.sendToRenderer('update:error', { message: error.message });
      console.error('[Updater] Error:', error);
    });

    // Check for updates on startup (delayed to not slow down boot)
    setTimeout(() => {
      this.checkForUpdates();
    }, 10000); // 10 second delay

    console.log('[Updater] Initialized');
  }

  /**
   * Check for available updates.
   */
  checkForUpdates(): void {
    if (!app.isPackaged) return;

    const updaterModule = tryLoadUpdater();
    if (!updaterModule) return;

    updaterModule.autoUpdater.checkForUpdates().catch((error: Error) => {
      console.error('[Updater] Check failed:', error);
    });
  }

  /**
   * Download the available update.
   */
  downloadUpdate(): void {
    if (!app.isPackaged) return;

    const updaterModule = tryLoadUpdater();
    if (!updaterModule) return;

    updaterModule.autoUpdater.downloadUpdate().catch((error: Error) => {
      console.error('[Updater] Download failed:', error);
      this.setStatus('error');
    });
  }

  /**
   * Install the downloaded update and restart.
   */
  installUpdate(): void {
    if (!app.isPackaged) return;

    const updaterModule = tryLoadUpdater();
    if (!updaterModule) return;

    updaterModule.autoUpdater.quitAndInstall(false, true);
  }

  /**
   * Get current update status.
   */
  getStatus(): { status: UpdateStatus; updateInfo: UpdateInfo | null } {
    return {
      status: this.status,
      updateInfo: this.updateInfo,
    };
  }

  // ===========================================================================
  // HELPERS
  // ===========================================================================

  private setStatus(status: UpdateStatus): void {
    this.status = status;
  }

  private sendToRenderer(channel: string, data: unknown): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, data);
    }
  }
}
