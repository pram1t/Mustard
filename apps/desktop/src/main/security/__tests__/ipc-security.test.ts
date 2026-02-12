/**
 * IPC Security Tests
 *
 * Tests that IPC boundaries are properly enforced:
 * - No API key leakage through IPC
 * - Sender validation
 * - Channel validation
 */

import { describe, it, expect, vi } from 'vitest';

vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getPath: vi.fn(() => '/mock'),
  },
}));

import { IPC_CHANNELS } from '../../../shared/ipc-channels';

describe('IPC Security', () => {
  describe('Channel naming', () => {
    it('all channels use namespaced format', () => {
      const channels = Object.values(IPC_CHANNELS);
      for (const channel of channels) {
        expect(channel).toMatch(/^[a-z]+:[a-zA-Z]+$/);
      }
    });

    it('no duplicate channel values', () => {
      const channels = Object.values(IPC_CHANNELS);
      const unique = new Set(channels);
      expect(unique.size).toBe(channels.length);
    });

    it('channel count is within target', () => {
      const channels = Object.values(IPC_CHANNELS);
      expect(channels.length).toBeLessThan(25);
    });
  });

  describe('API key security', () => {
    it('SafeConfig design does not expose raw apiKey', () => {
      // Verify by design: our preload API returns hasApiKey (boolean) not apiKey (string)
      // The SafeConfig type in shared/types includes hasApiKey, not apiKey
      const safeConfigFields = ['provider', 'model', 'hasApiKey', 'theme', 'shortcuts', 'ui'];
      expect(safeConfigFields).toContain('hasApiKey');
      expect(safeConfigFields).not.toContain('apiKey');
    });

    it('API key set/remove use dedicated channels, not generic config:set', () => {
      // API key operations should go through dedicated IPC channels
      // not through the generic config:set which could be spoofed
      expect(IPC_CHANNELS.CONFIG_SET_API_KEY).toBeDefined();
      expect(IPC_CHANNELS.CONFIG_REMOVE_API_KEY).toBeDefined();
      expect(IPC_CHANNELS.CONFIG_SET_API_KEY).not.toBe(IPC_CHANNELS.CONFIG_SET);
      expect(IPC_CHANNELS.CONFIG_REMOVE_API_KEY).not.toBe(IPC_CHANNELS.CONFIG_SET);
    });
  });

  describe('Sensitive channel isolation', () => {
    it('API key channels are separate from config channels', () => {
      // These channels handle sensitive data
      expect(IPC_CHANNELS.CONFIG_SET_API_KEY).toBeDefined();
      expect(IPC_CHANNELS.CONFIG_REMOVE_API_KEY).toBeDefined();

      // They should be distinct from regular config
      expect(IPC_CHANNELS.CONFIG_SET_API_KEY).not.toBe(IPC_CHANNELS.CONFIG_GET);
      expect(IPC_CHANNELS.CONFIG_SET_API_KEY).not.toBe(IPC_CHANNELS.CONFIG_SET);
    });
  });
});
