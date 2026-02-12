import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IPC_CHANNELS, VALID_CHANNELS, CHANNEL_COUNT } from '../../../shared/ipc-channels';

const handlers = new Map<string, Function>();

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn((channel: string, handler: Function) => {
      handlers.set(channel, handler);
    }),
  },
  app: {
    getVersion: () => '0.1.0',
    quit: vi.fn(),
  },
  dialog: {
    showOpenDialog: vi.fn(async () => ({ canceled: true, filePaths: [] })),
  },
}));

vi.mock('../../window', () => ({
  getMainWindow: vi.fn(() => ({})),
}));

vi.mock('../../services', () => ({
  getAgentService: vi.fn(() => ({ setCwd: vi.fn() })),
}));

import { registerAgentHandlers } from '../handlers/agent';
import { registerConfigHandlers } from '../handlers/config';
import { registerMCPHandlers } from '../handlers/mcp';
import { registerWindowHandlers } from '../handlers/window';
import { registerAppHandlers } from '../handlers/app';
import { registerDialogHandlers } from '../handlers/dialog';

describe('IPC Channel Definitions', () => {
  it('should have fewer than 25 channels', () => {
    expect(CHANNEL_COUNT).toBeLessThanOrEqual(25);
  });

  it('should have exactly 23 channel definitions', () => {
    expect(CHANNEL_COUNT).toBe(23);
  });

  it('should have all channel values in VALID_CHANNELS set', () => {
    for (const channel of Object.values(IPC_CHANNELS)) {
      expect(VALID_CHANNELS.has(channel)).toBe(true);
    }
  });
});

describe('Handler Registration', () => {
  beforeEach(() => {
    handlers.clear();
  });

  it('registerAgentHandlers registers 3 invoke channels', () => {
    registerAgentHandlers();
    expect(handlers.has(IPC_CHANNELS.AGENT_CHAT)).toBe(true);
    expect(handlers.has(IPC_CHANNELS.AGENT_STOP)).toBe(true);
    expect(handlers.has(IPC_CHANNELS.AGENT_STATUS)).toBe(true);
    expect(handlers.has(IPC_CHANNELS.AGENT_EVENT)).toBe(false);
  });

  it('registerConfigHandlers registers 6 invoke channels', () => {
    registerConfigHandlers();
    expect(handlers.has(IPC_CHANNELS.CONFIG_GET)).toBe(true);
    expect(handlers.has(IPC_CHANNELS.CONFIG_SET)).toBe(true);
    expect(handlers.has(IPC_CHANNELS.CONFIG_GET_PROVIDERS)).toBe(true);
    expect(handlers.has(IPC_CHANNELS.CONFIG_GET_MODELS)).toBe(true);
    expect(handlers.has(IPC_CHANNELS.CONFIG_SET_API_KEY)).toBe(true);
    expect(handlers.has(IPC_CHANNELS.CONFIG_REMOVE_API_KEY)).toBe(true);
  });

  it('registerMCPHandlers registers 5 invoke channels', () => {
    registerMCPHandlers();
    expect(handlers.has(IPC_CHANNELS.MCP_LIST)).toBe(true);
    expect(handlers.has(IPC_CHANNELS.MCP_ADD)).toBe(true);
    expect(handlers.has(IPC_CHANNELS.MCP_REMOVE)).toBe(true);
    expect(handlers.has(IPC_CHANNELS.MCP_STATUS)).toBe(true);
    expect(handlers.has(IPC_CHANNELS.MCP_RESTART)).toBe(true);
  });

  it('registerWindowHandlers registers 4 invoke channels', () => {
    registerWindowHandlers();
    expect(handlers.has(IPC_CHANNELS.WINDOW_MINIMIZE)).toBe(true);
    expect(handlers.has(IPC_CHANNELS.WINDOW_MAXIMIZE)).toBe(true);
    expect(handlers.has(IPC_CHANNELS.WINDOW_CLOSE)).toBe(true);
    expect(handlers.has(IPC_CHANNELS.WINDOW_IS_MAXIMIZED)).toBe(true);
  });

  it('registerAppHandlers registers 3 invoke channels', () => {
    registerAppHandlers();
    expect(handlers.has(IPC_CHANNELS.APP_VERSION)).toBe(true);
    expect(handlers.has(IPC_CHANNELS.APP_CHECK_UPDATE)).toBe(true);
    expect(handlers.has(IPC_CHANNELS.APP_QUIT)).toBe(true);
  });

  it('registerDialogHandlers registers 1 invoke channel', () => {
    registerDialogHandlers();
    expect(handlers.has(IPC_CHANNELS.DIALOG_SELECT_FOLDER)).toBe(true);
  });

  it('all registered channels are in the allowlist', () => {
    registerAgentHandlers();
    registerConfigHandlers();
    registerMCPHandlers();
    registerWindowHandlers();
    registerAppHandlers();
    registerDialogHandlers();

    for (const channel of handlers.keys()) {
      expect(VALID_CHANNELS.has(channel)).toBe(true);
    }
  });

  it('total registered handlers equals 22 (all invoke channels)', () => {
    registerAgentHandlers();
    registerConfigHandlers();
    registerMCPHandlers();
    registerWindowHandlers();
    registerAppHandlers();
    registerDialogHandlers();
    expect(handlers.size).toBe(22);
  });
});
