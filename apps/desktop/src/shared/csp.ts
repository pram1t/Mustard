/**
 * Content Security Policy configuration.
 * Defines security policies for all rendered content.
 */

export interface CSPDirectives {
  'default-src': string[];
  'script-src': string[];
  'style-src': string[];
  'img-src': string[];
  'font-src': string[];
  'connect-src': string[];
  'media-src': string[];
  'object-src': string[];
  'frame-src': string[];
  'worker-src': string[];
  'base-uri': string[];
  'form-action': string[];
  'frame-ancestors': string[];
}

/**
 * Production CSP - most restrictive.
 * Matches the meta tag in src/renderer/index.html.
 */
export const PRODUCTION_CSP: CSPDirectives = {
  'default-src': ["'self'"],
  'script-src': ["'self'"],
  'style-src': ["'self'", "'unsafe-inline'"],
  'img-src': ["'self'", 'data:', 'blob:'],
  'font-src': ["'self'"],
  'connect-src': ["'self'", 'https:'],
  'media-src': ["'none'"],
  'object-src': ["'none'"],
  'frame-src': ["'none'"],
  'worker-src': ["'self'", 'blob:'],
  'base-uri': ["'self'"],
  'form-action': ["'self'"],
  'frame-ancestors': ["'none'"],
};

/**
 * Development CSP - allows Vite HMR.
 * Relaxes script-src for inline scripts and connect-src for WebSocket.
 */
export const DEVELOPMENT_CSP: CSPDirectives = {
  ...PRODUCTION_CSP,
  'script-src': ["'self'", "'unsafe-inline'"],
  'connect-src': ["'self'", 'https:', 'ws:', 'wss:'],
};

/**
 * Builds CSP header string from directives.
 */
export function buildCSPString(directives: CSPDirectives): string {
  return Object.entries(directives)
    .map(([key, values]) => `${key} ${values.join(' ')}`)
    .join('; ');
}

/**
 * Gets appropriate CSP for current environment.
 * @param isDev - Pass `!app.isPackaged` from the main process.
 */
export function getCSP(isDev: boolean): CSPDirectives {
  return isDev ? DEVELOPMENT_CSP : PRODUCTION_CSP;
}
