import { contextBridge, ipcRenderer } from 'electron';

/**
 * Minimal initial preload API.
 * Full PreloadAPI implementation will come in Phase 4 (IPC Architecture).
 * For Phase 1, we expose only getAppInfo for verification.
 */
contextBridge.exposeInMainWorld('api', {
  getAppInfo: () =>
    ipcRenderer.invoke('app:version').then((version: string) => ({
      version,
      platform: process.platform,
      arch: process.arch,
      isDev: process.env.NODE_ENV === 'development',
    })),
});
