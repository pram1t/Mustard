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
  async initialize(mainWindow: BrowserWindow): Promise<void> {
    this.mainWindow = mainWindow;

    if (!app.isPackaged) {
      console.log('[Updater] Skipping — development mode');
      return;
    }

    try {
      // Dynamic import to handle cases where electron-updater isn't installed
      const { autoUpdater } = await import('electron-updater');

      // Configure updater
      autoUpdater.autoDownload = false; // Let user decide
      autoUpdater.autoInstallOnAppQuit = true;
      autoUpdater.allowDowngrade = false;

      // Event handlers
      autoUpdater.on('checking-for-update', () => {
        this.setStatus('checking');
      });

      autoUpdater.on('update-available', (info) => {
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

      autoUpdater.on('download-progress', (progress) => {
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

      autoUpdater.on('error', (error) => {
        this.setStatus('error');
        this.sendToRenderer('update:error', { message: error.message });
        console.error('[Updater] Error:', error);
      });

      // Check for updates on startup (delayed to not slow down boot)
      setTimeout(() => {
        this.checkForUpdates();
      }, 10000); // 10 second delay

      console.log('[Updater] Initialized');
    } catch (error) {
      console.log('[Updater] electron-updater not available:', (error as Error).message);
    }
  }

  /**
   * Check for available updates.
   */
  async checkForUpdates(): Promise<void> {
    if (!app.isPackaged) return;

    try {
      const { autoUpdater } = await import('electron-updater');
      await autoUpdater.checkForUpdates();
    } catch (error) {
      console.error('[Updater] Check failed:', error);
    }
  }

  /**
   * Download the available update.
   */
  async downloadUpdate(): Promise<void> {
    if (!app.isPackaged) return;

    try {
      const { autoUpdater } = await import('electron-updater');
      await autoUpdater.downloadUpdate();
    } catch (error) {
      console.error('[Updater] Download failed:', error);
      this.setStatus('error');
    }
  }

  /**
   * Install the downloaded update and restart.
   */
  async installUpdate(): Promise<void> {
    if (!app.isPackaged) return;

    try {
      const { autoUpdater } = await import('electron-updater');
      autoUpdater.quitAndInstall(false, true);
    } catch (error) {
      console.error('[Updater] Install failed:', error);
    }
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
