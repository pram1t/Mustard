import { session } from 'electron';

/**
 * Configures web security settings for the default session.
 * Must be called after app.whenReady().
 */
export function configureWebSecurity(): void {
  const ses = session.defaultSession;

  // Set security response headers
  ses.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'X-Content-Type-Options': ['nosniff'],
        'X-Frame-Options': ['DENY'],
        'X-XSS-Protection': ['1; mode=block'],
      },
    });
  });

  console.log('Web security configured');
}

/**
 * Configures the permission handler for the default session.
 * Defaults to deny for most permissions.
 * Must be called after app.whenReady().
 */
export function configurePermissionHandler(): void {
  const ses = session.defaultSession;

  const grantedPermissions = new Set([
    'fullscreen',
    'clipboard-sanitized-write',
    'storage-access',
    'window-placement',
  ]);

  ses.setPermissionRequestHandler((_webContents, permission, callback) => {
    if (grantedPermissions.has(permission)) {
      callback(true);
    } else {
      console.warn(`Denied permission request: ${permission}`);
      callback(false);
    }
  });

  ses.setPermissionCheckHandler((_webContents, permission) => {
    return grantedPermissions.has(permission);
  });

  console.log('Permission handler configured');
}
