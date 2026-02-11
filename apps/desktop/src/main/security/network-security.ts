/**
 * Network Security
 *
 * HTTPS enforcement, external link validation, and request filtering.
 * Blocks insecure HTTP requests in production.
 */

import { session, shell, app } from 'electron';

// =============================================================================
// HTTPS ENFORCEMENT
// =============================================================================

/**
 * Enforce HTTPS for all network requests in production.
 * Blocks plain HTTP requests except for localhost (dev servers).
 * Must be called after app.whenReady().
 */
export function enforceHTTPS(): void {
  const ses = session.defaultSession;

  ses.webRequest.onBeforeRequest((details, callback) => {
    const url = details.url;

    // Allow devtools, file, and chrome-extension protocols
    if (!url.startsWith('http://')) {
      callback({ cancel: false });
      return;
    }

    // Allow localhost in development
    if (!app.isPackaged && isLocalhostURL(url)) {
      callback({ cancel: false });
      return;
    }

    // Block HTTP in production
    if (app.isPackaged) {
      console.warn(`[NetworkSecurity] Blocked insecure HTTP request: ${url}`);
      callback({ cancel: true });
      return;
    }

    // In development, allow but warn
    console.warn(`[NetworkSecurity] Insecure HTTP request in dev: ${url}`);
    callback({ cancel: false });
  });

  console.log('[NetworkSecurity] HTTPS enforcement configured');
}

// =============================================================================
// EXTERNAL LINK VALIDATION
// =============================================================================

/**
 * Allowed protocols for external links.
 */
const ALLOWED_EXTERNAL_PROTOCOLS = new Set(['https:', 'mailto:']);

/**
 * Blocked domains for external links.
 */
const BLOCKED_DOMAINS = new Set([
  'localhost',
  '127.0.0.1',
  '[::1]',
  '0.0.0.0',
]);

/**
 * Validate a URL for safe external opening.
 * Returns the validated URL string or null if rejected.
 */
export function validateExternalURL(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl);

    // Check protocol
    if (!ALLOWED_EXTERNAL_PROTOCOLS.has(url.protocol)) {
      console.warn(`[NetworkSecurity] Rejected external URL: bad protocol "${url.protocol}"`);
      return null;
    }

    // Check for blocked domains (only for non-mailto)
    if (url.protocol === 'https:') {
      if (BLOCKED_DOMAINS.has(url.hostname)) {
        console.warn(`[NetworkSecurity] Rejected external URL: blocked domain "${url.hostname}"`);
        return null;
      }

      // Block IP addresses
      if (isIPAddress(url.hostname)) {
        console.warn(`[NetworkSecurity] Rejected external URL: IP address not allowed`);
        return null;
      }

      // Block URLs with auth info
      if (url.username || url.password) {
        console.warn(`[NetworkSecurity] Rejected external URL: contains auth info`);
        return null;
      }

      // Block non-standard ports
      if (url.port && url.port !== '443') {
        console.warn(`[NetworkSecurity] Rejected external URL: non-standard port`);
        return null;
      }
    }

    // Block javascript: and data: embedded in any part
    const lowerUrl = rawUrl.toLowerCase();
    if (lowerUrl.includes('javascript:') || lowerUrl.includes('data:')) {
      console.warn(`[NetworkSecurity] Rejected external URL: contains dangerous scheme`);
      return null;
    }

    return url.toString();
  } catch {
    console.warn(`[NetworkSecurity] Rejected external URL: invalid URL`);
    return null;
  }
}

/**
 * Safely open an external URL.
 * Validates the URL before passing to shell.openExternal().
 */
export async function openExternalSafe(rawUrl: string): Promise<boolean> {
  const validated = validateExternalURL(rawUrl);
  if (!validated) {
    return false;
  }

  try {
    await shell.openExternal(validated);
    return true;
  } catch (error) {
    console.error('[NetworkSecurity] Failed to open external URL:', error);
    return false;
  }
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Check if URL is a localhost URL.
 */
function isLocalhostURL(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.hostname === 'localhost' ||
      parsed.hostname === '127.0.0.1' ||
      parsed.hostname === '[::1]' ||
      parsed.hostname === '0.0.0.0'
    );
  } catch {
    return false;
  }
}

/**
 * Check if a hostname is an IP address.
 */
function isIPAddress(hostname: string): boolean {
  // IPv4
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) {
    return true;
  }
  // IPv6
  if (hostname.startsWith('[') || hostname.includes(':')) {
    return true;
  }
  return false;
}
