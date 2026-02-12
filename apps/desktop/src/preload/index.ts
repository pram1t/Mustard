import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS } from '../shared/ipc-channels';
import type { PreloadAPI, NavigatePayload } from '../shared/preload-api';
import type { AgentEvent } from '../shared/event-types';

/**
 * Preload script: Exposes the complete PreloadAPI to the renderer.
 *
 * Rules:
 * - All methods use ipcRenderer.invoke (request/response) except onEvent
 * - onEvent uses ipcRenderer.on (one-way stream) and returns unsubscribe
 * - No direct Node.js APIs are exposed
 */
const api: PreloadAPI = {
  // ── Agent Operations ────────────────────────────────────────────────────
  chat: (message: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.AGENT_CHAT, { message }),

  stop: () =>
    ipcRenderer.invoke(IPC_CHANNELS.AGENT_STOP),

  onEvent: (callback: (event: AgentEvent) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, data: AgentEvent) => {
      callback(data);
    };
    ipcRenderer.on(IPC_CHANNELS.AGENT_EVENT, listener);
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.AGENT_EVENT, listener);
    };
  },

  getStatus: () =>
    ipcRenderer.invoke(IPC_CHANNELS.AGENT_STATUS),

  // ── Configuration ───────────────────────────────────────────────────────
  getConfig: () =>
    ipcRenderer.invoke(IPC_CHANNELS.CONFIG_GET),

  setConfig: (config) =>
    ipcRenderer.invoke(IPC_CHANNELS.CONFIG_SET, { config }),

  getProviders: () =>
    ipcRenderer.invoke(IPC_CHANNELS.CONFIG_GET_PROVIDERS),

  getModels: (providerId: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.CONFIG_GET_MODELS, { provider: providerId }),

  setApiKey: (providerId: string, apiKey: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.CONFIG_SET_API_KEY, { provider: providerId, apiKey }),

  removeApiKey: (providerId: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.CONFIG_REMOVE_API_KEY, { provider: providerId }),

  // ── MCP Management ─────────────────────────────────────────────────────
  getMCPServers: () =>
    ipcRenderer.invoke(IPC_CHANNELS.MCP_LIST),

  setMCPServer: (server) =>
    ipcRenderer.invoke(IPC_CHANNELS.MCP_ADD, { server })
      .then((r: { serverId: string }) => r.serverId),

  removeMCPServer: (serverId: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.MCP_REMOVE, { serverId }),

  // ── Navigation ────────────────────────────────────────────────────────
  onNavigate: (callback: (payload: NavigatePayload) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, data: NavigatePayload) => {
      callback(data);
    };
    ipcRenderer.on(IPC_CHANNELS.APP_NAVIGATE, listener);
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.APP_NAVIGATE, listener);
    };
  },

  // ── Dialog ────────────────────────────────────────────────────────────
  selectFolder: () =>
    ipcRenderer.invoke(IPC_CHANNELS.DIALOG_SELECT_FOLDER),

  // ── Window Controls ────────────────────────────────────────────────────
  minimize: () =>
    ipcRenderer.invoke(IPC_CHANNELS.WINDOW_MINIMIZE),

  toggleMaximize: () =>
    ipcRenderer.invoke(IPC_CHANNELS.WINDOW_MAXIMIZE),

  close: () =>
    ipcRenderer.invoke(IPC_CHANNELS.WINDOW_CLOSE),

  // ── Application ────────────────────────────────────────────────────────
  getAppInfo: async () => {
    const version = await ipcRenderer.invoke(IPC_CHANNELS.APP_VERSION);
    return {
      version,
      platform: process.platform,
      arch: process.arch,
      isDev: process.env.NODE_ENV === 'development',
    };
  },
};

contextBridge.exposeInMainWorld('api', api);
