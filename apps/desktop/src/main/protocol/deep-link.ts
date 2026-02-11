/**
 * Deep Link Handler
 *
 * Implements the openagent:// protocol with strict URL validation
 * and argument injection prevention (CVE-2018-1000006).
 */

import { app } from 'electron';

const PROTOCOL = 'openagent';

/**
 * Valid deep link routes and their allowed parameters.
 */
const VALID_ROUTES: Record<string, Set<string>> = {
  '/chat': new Set(['message', 'provider']),
  '/settings': new Set(['tab']),
  '/mcp': new Set(['server']),
};

export interface DeepLinkResult {
  route: string;
  params: Record<string, string>;
}

/**
 * Register the openagent:// protocol handler.
 * Must be called before app.whenReady().
 */
export function registerProtocol(): void {
  if (!app.isDefaultProtocolClient(PROTOCOL)) {
    // CVE-2018-1000006 mitigation: append "--" to prevent argument injection
    // on Windows, Chromium-based apps can be launched via protocol handlers
    // with arbitrary args. The "--" stops Chromium arg parsing.
    if (process.platform === 'win32') {
      app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, ['--']);
    } else {
      app.setAsDefaultProtocolClient(PROTOCOL);
    }
  }
}

/**
 * Parse and validate a deep link URL.
 * Returns null if the URL is invalid or contains suspicious content.
 */
export function parseDeepLink(rawUrl: string): DeepLinkResult | null {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return null;
  }

  // Strip any leading/trailing whitespace
  const trimmed = rawUrl.trim();

  // Must start with our protocol
  if (!trimmed.startsWith(`${PROTOCOL}://`)) {
    console.warn(`[DeepLink] Rejected: not openagent:// protocol: ${trimmed}`);
    return null;
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    console.warn(`[DeepLink] Rejected: malformed URL: ${trimmed}`);
    return null;
  }

  // Validate protocol
  if (parsed.protocol !== `${PROTOCOL}:`) {
    console.warn(`[DeepLink] Rejected: wrong protocol: ${parsed.protocol}`);
    return null;
  }

  // Block any auth info (username:password@)
  if (parsed.username || parsed.password) {
    console.warn('[DeepLink] Rejected: URL contains auth info');
    return null;
  }

  // Build route from pathname (normalize)
  const route = '/' + (parsed.hostname + parsed.pathname).replace(/\/+/g, '/').replace(/\/$/, '');

  // Validate route
  const allowedParams = VALID_ROUTES[route];
  if (!allowedParams) {
    console.warn(`[DeepLink] Rejected: unknown route: ${route}`);
    return null;
  }

  // Extract and validate parameters
  const params: Record<string, string> = {};
  for (const [key, value] of parsed.searchParams) {
    if (!allowedParams.has(key)) {
      console.warn(`[DeepLink] Rejected: unknown param "${key}" for route ${route}`);
      return null;
    }
    // Sanitize value (no control characters, reasonable length)
    if (value.length > 500 || /[\x00-\x1f\x7f]/.test(value)) {
      console.warn(`[DeepLink] Rejected: invalid param value for "${key}"`);
      return null;
    }
    params[key] = value;
  }

  return { route, params };
}

/**
 * Extract a deep link URL from process.argv (Windows) or open-url event (macOS).
 * Filters out Electron/Chromium arguments.
 */
export function extractDeepLinkFromArgs(argv: string[]): string | null {
  // Skip the executable path and any Chromium flags
  for (const arg of argv) {
    if (arg.startsWith(`${PROTOCOL}://`)) {
      return arg;
    }
  }
  return null;
}
