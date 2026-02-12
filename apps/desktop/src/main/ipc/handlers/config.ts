import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../../shared/ipc-channels';
import { validateSender } from '../validate-sender';
import { getConfigService, getAgentService } from '../../services';

/**
 * Registers configuration IPC handlers.
 * Each handler: validateSender first, then delegate to ConfigService.
 */
export function registerConfigHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.CONFIG_GET, async (event) => {
    validateSender(event);
    return getConfigService().get();
  });

  ipcMain.handle(IPC_CHANNELS.CONFIG_SET, async (event, payload: { config: Record<string, unknown> }) => {
    validateSender(event);
    return getConfigService().set(payload.config);
  });

  ipcMain.handle(IPC_CHANNELS.CONFIG_GET_PROVIDERS, async (event) => {
    validateSender(event);
    return getConfigService().getProviders();
  });

  ipcMain.handle(IPC_CHANNELS.CONFIG_GET_MODELS, async (event, payload: { provider: string }) => {
    validateSender(event);
    return getConfigService().getModels(payload.provider);
  });

  ipcMain.handle(IPC_CHANNELS.CONFIG_SET_API_KEY, async (event, payload: { provider: string; apiKey: string }) => {
    validateSender(event);
    const result = await getConfigService().setApiKey(payload.provider, payload.apiKey);
    // Reset agent so it picks up the new provider on next chat
    getAgentService().dispose();
    return result;
  });

  ipcMain.handle(IPC_CHANNELS.CONFIG_REMOVE_API_KEY, async (event, payload: { provider: string }) => {
    validateSender(event);
    return getConfigService().removeApiKey(payload.provider);
  });
}
