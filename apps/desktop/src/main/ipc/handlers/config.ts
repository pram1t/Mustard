import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../../shared/ipc-channels';
import { validateSender } from '../validate-sender';

/**
 * Registers configuration IPC handlers.
 * Stub implementations — real config service comes in Phase 5+.
 */
export function registerConfigHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.CONFIG_GET, async (event) => {
    validateSender(event);
    // TODO(phase-5): Forward to configService.get()
    return { provider: '', model: '', theme: 'system' as const };
  });

  ipcMain.handle(IPC_CHANNELS.CONFIG_SET, async (event, _payload: { config: Record<string, unknown> }) => {
    validateSender(event);
    // TODO(phase-5): Forward to configService.set(payload.config)
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.CONFIG_GET_PROVIDERS, async (event) => {
    validateSender(event);
    // TODO(phase-5): Forward to configService.getProviders()
    return [];
  });

  ipcMain.handle(IPC_CHANNELS.CONFIG_GET_MODELS, async (event, _payload: { provider: string }) => {
    validateSender(event);
    // TODO(phase-5): Forward to configService.getModels(payload.provider)
    return [];
  });
}
