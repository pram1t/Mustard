/**
 * Platform Integration
 *
 * Platform-specific utilities and configuration for macOS, Windows, and Linux.
 * Handles secure storage detection, platform-specific behaviors, and system integration.
 */

import { app } from 'electron';

// =============================================================================
// PLATFORM DETECTION
// =============================================================================

export type Platform = 'darwin' | 'win32' | 'linux';

/**
 * Get the current platform.
 */
export function getPlatform(): Platform {
  return process.platform as Platform;
}

/**
 * Check if running on macOS.
 */
export function isMacOS(): boolean {
  return process.platform === 'darwin';
}

/**
 * Check if running on Windows.
 */
export function isWindows(): boolean {
  return process.platform === 'win32';
}

/**
 * Check if running on Linux.
 */
export function isLinux(): boolean {
  return process.platform === 'linux';
}

// =============================================================================
// SECURE STORAGE BACKEND DETECTION
// =============================================================================

export interface StorageBackendInfo {
  name: string;
  available: boolean;
  secure: boolean;
  notes: string;
}

/**
 * Detect the available secure storage backend for the current platform.
 */
export function detectSecureStorage(): StorageBackendInfo {
  if (isMacOS()) {
    return {
      name: 'macOS Keychain',
      available: true,
      secure: true,
      notes: 'Uses macOS Keychain via Electron safeStorage.',
    };
  }

  if (isWindows()) {
    return {
      name: 'Windows DPAPI',
      available: true,
      secure: true,
      notes: 'Uses Windows Data Protection API via Electron safeStorage.',
    };
  }

  // Linux: depends on desktop environment
  if (isLinux()) {
    const desktop = process.env.XDG_CURRENT_DESKTOP?.toLowerCase() ?? '';
    const hasKeyring =
      desktop.includes('gnome') ||
      desktop.includes('kde') ||
      desktop.includes('xfce') ||
      desktop.includes('unity') ||
      desktop.includes('cinnamon');

    if (hasKeyring) {
      return {
        name: 'Secret Service (GNOME Keyring / KWallet)',
        available: true,
        secure: true,
        notes: `Desktop: ${desktop}. Uses libsecret via Electron safeStorage.`,
      };
    }

    return {
      name: 'AES-256-GCM fallback',
      available: true,
      secure: false,
      notes:
        'No keyring detected. Using AES-256-GCM with machine-derived key. ' +
        'Install gnome-keyring or kwallet for better security.',
    };
  }

  return {
    name: 'Unknown',
    available: false,
    secure: false,
    notes: `Unsupported platform: ${process.platform}`,
  };
}

// =============================================================================
// PLATFORM-SPECIFIC BEHAVIORS
// =============================================================================

/**
 * Get the platform-specific modifier key name.
 * Used for displaying keyboard shortcuts.
 */
export function getModifierKey(): string {
  return isMacOS() ? 'Cmd' : 'Ctrl';
}

/**
 * Get the platform-specific app name for display.
 */
export function getAppDisplayName(): string {
  return 'OpenAgent';
}

/**
 * Get application version from package.json.
 */
export function getAppVersion(): string {
  return app.getVersion();
}

/**
 * Get platform-specific paths info.
 */
export function getPlatformPaths(): Record<string, string> {
  return {
    userData: app.getPath('userData'),
    logs: app.getPath('logs'),
    temp: app.getPath('temp'),
    home: app.getPath('home'),
  };
}

// =============================================================================
// MACOS SPECIFIC
// =============================================================================

/**
 * macOS: Hardened runtime entitlements configuration.
 * Used by electron-builder for code signing.
 */
export const MACOS_ENTITLEMENTS = {
  'com.apple.security.cs.allow-jit': true,
  'com.apple.security.cs.allow-unsigned-executable-memory': true,
  'com.apple.security.cs.disable-library-validation': true,
  'com.apple.security.network.client': true,
} as const;

// =============================================================================
// WINDOWS SPECIFIC
// =============================================================================

/**
 * Windows: Check if running with elevated privileges.
 */
export function isElevated(): boolean {
  if (!isWindows()) return false;
  try {
    // On Windows, check if running as admin
    const { execSync } = require('child_process');
    execSync('net session', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

// =============================================================================
// LINUX SPECIFIC
// =============================================================================

/**
 * Linux: Desktop file content for .desktop file creation.
 */
export function getLinuxDesktopEntry(): string {
  return `[Desktop Entry]
Name=OpenAgent
Comment=AI-powered coding assistant
Exec=openagent %U
Icon=openagent
Type=Application
Categories=Development;Utility;
MimeType=x-scheme-handler/openagent;
StartupNotify=true
Terminal=false
`;
}
