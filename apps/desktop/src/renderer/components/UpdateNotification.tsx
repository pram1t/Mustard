/**
 * Update Notification
 *
 * Shows a notification banner when an app update is available.
 * Provides download and install actions.
 */

import { useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import './UpdateNotification.css';

interface UpdateInfo {
  version: string;
  releaseNotes?: string;
  releaseDate?: string;
}

interface UpdateProgress {
  percent: number;
  bytesPerSecond: number;
  total: number;
  transferred: number;
}

type UpdateState = 'idle' | 'available' | 'downloading' | 'downloaded' | 'error';

export function UpdateNotification(): ReactNode {
  const [state, setState] = useState<UpdateState>('idle');
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [progress, setProgress] = useState<UpdateProgress | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Listen for update events from main process
    const api = window.api;
    if (!api) return;

    // These events are sent via webContents.send from UpdateService
    const handleAvailable = (_event: unknown, info: UpdateInfo): void => {
      setUpdateInfo(info);
      setState('available');
      setDismissed(false);
    };

    const handleProgress = (_event: unknown, prog: UpdateProgress): void => {
      setProgress(prog);
      setState('downloading');
    };

    const handleDownloaded = (): void => {
      setState('downloaded');
      setProgress(null);
    };

    const handleError = (): void => {
      setState('error');
      setProgress(null);
    };

    // Electron IPC listeners would be set up via preload
    // For now, these are placeholders for the update event system
    const cleanup: (() => void)[] = [];

    if (typeof window !== 'undefined' && 'electronAPI' in window) {
      // Would use ipcRenderer.on for real Electron IPC
    }

    return () => {
      cleanup.forEach((fn) => fn());
    };
  }, []);

  const handleDownload = useCallback(() => {
    setState('downloading');
    // Would call window.api.downloadUpdate() when IPC is wired
  }, []);

  const handleInstall = useCallback(() => {
    // Would call window.api.installUpdate() when IPC is wired
  }, []);

  const handleDismiss = useCallback(() => {
    setDismissed(true);
  }, []);

  if (dismissed || state === 'idle') {
    return null;
  }

  return (
    <div className="update-notification" role="alert">
      {state === 'available' && updateInfo && (
        <div className="update-notification-content">
          <span className="update-notification-text">
            Update available: v{updateInfo.version}
          </span>
          <div className="update-notification-actions">
            <button
              className="update-notification-button update-button-primary"
              onClick={handleDownload}
            >
              Download
            </button>
            <button
              className="update-notification-button update-button-secondary"
              onClick={handleDismiss}
            >
              Later
            </button>
          </div>
        </div>
      )}

      {state === 'downloading' && progress && (
        <div className="update-notification-content">
          <span className="update-notification-text">
            Downloading update... {Math.round(progress.percent)}%
          </span>
          <div className="update-progress-bar">
            <div
              className="update-progress-fill"
              style={{ width: `${progress.percent}%` }}
            />
          </div>
        </div>
      )}

      {state === 'downloaded' && (
        <div className="update-notification-content">
          <span className="update-notification-text">
            Update ready to install
          </span>
          <div className="update-notification-actions">
            <button
              className="update-notification-button update-button-primary"
              onClick={handleInstall}
            >
              Restart & Update
            </button>
            <button
              className="update-notification-button update-button-secondary"
              onClick={handleDismiss}
            >
              Later
            </button>
          </div>
        </div>
      )}

      {state === 'error' && (
        <div className="update-notification-content">
          <span className="update-notification-text update-text-error">
            Update failed. Please try again later.
          </span>
          <button
            className="update-notification-button update-button-secondary"
            onClick={handleDismiss}
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}
