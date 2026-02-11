import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('electron', () => ({
  app: {
    getVersion: vi.fn(() => '0.1.0'),
    getPath: vi.fn((name: string) => `/mock/${name}`),
  },
}));

import {
  getPlatform,
  isMacOS,
  isWindows,
  isLinux,
  detectSecureStorage,
  getModifierKey,
  getAppDisplayName,
  getAppVersion,
  getPlatformPaths,
  getLinuxDesktopEntry,
  MACOS_ENTITLEMENTS,
} from '../index';

describe('Platform Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Platform Detection', () => {
    it('returns current platform', () => {
      const platform = getPlatform();
      expect(['darwin', 'win32', 'linux']).toContain(platform);
    });

    it('isMacOS returns boolean', () => {
      expect(typeof isMacOS()).toBe('boolean');
    });

    it('isWindows returns boolean', () => {
      expect(typeof isWindows()).toBe('boolean');
    });

    it('isLinux returns boolean', () => {
      expect(typeof isLinux()).toBe('boolean');
    });

    it('exactly one platform function returns true', () => {
      const platforms = [isMacOS(), isWindows(), isLinux()];
      expect(platforms.filter(Boolean)).toHaveLength(1);
    });
  });

  describe('Secure Storage Detection', () => {
    it('returns storage backend info', () => {
      const info = detectSecureStorage();
      expect(info).toHaveProperty('name');
      expect(info).toHaveProperty('available');
      expect(info).toHaveProperty('secure');
      expect(info).toHaveProperty('notes');
    });

    it('reports available storage on all platforms', () => {
      const info = detectSecureStorage();
      expect(info.available).toBe(true);
    });
  });

  describe('Modifier Key', () => {
    it('returns Cmd on macOS, Ctrl otherwise', () => {
      const key = getModifierKey();
      if (isMacOS()) {
        expect(key).toBe('Cmd');
      } else {
        expect(key).toBe('Ctrl');
      }
    });
  });

  describe('App Info', () => {
    it('returns app display name', () => {
      expect(getAppDisplayName()).toBe('OpenAgent');
    });

    it('returns app version', () => {
      expect(getAppVersion()).toBe('0.1.0');
    });

    it('returns platform paths', () => {
      const paths = getPlatformPaths();
      expect(paths).toHaveProperty('userData');
      expect(paths).toHaveProperty('logs');
      expect(paths).toHaveProperty('temp');
      expect(paths).toHaveProperty('home');
    });
  });

  describe('macOS Entitlements', () => {
    it('includes required entitlements', () => {
      expect(MACOS_ENTITLEMENTS['com.apple.security.cs.allow-jit']).toBe(true);
      expect(MACOS_ENTITLEMENTS['com.apple.security.network.client']).toBe(true);
    });
  });

  describe('Linux Desktop Entry', () => {
    it('generates valid desktop entry', () => {
      const entry = getLinuxDesktopEntry();
      expect(entry).toContain('[Desktop Entry]');
      expect(entry).toContain('Name=OpenAgent');
      expect(entry).toContain('Type=Application');
      expect(entry).toContain('Categories=Development');
      expect(entry).toContain('x-scheme-handler/openagent');
    });
  });
});
