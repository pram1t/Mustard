import type { BrowserWindow } from 'electron';

/**
 * Verifies context isolation is working correctly.
 * Run this in development to catch configuration errors.
 */
export async function verifyContextIsolation(
  window: BrowserWindow
): Promise<boolean> {
  try {
    // Check if Node.js APIs are accessible from renderer
    const hasNodeAccess = await window.webContents.executeJavaScript(`
      (function() {
        try {
          return typeof require !== 'undefined' ||
                 typeof process !== 'undefined' ||
                 typeof global !== 'undefined';
        } catch (e) {
          return false;
        }
      })();
    `);

    if (hasNodeAccess) {
      console.error('SECURITY ERROR: Renderer has Node.js access!');
      return false;
    }

    // Verify window.api exists and is limited
    const apiCheck = await window.webContents.executeJavaScript(`
      (function() {
        if (typeof window.api === 'undefined') {
          return { error: 'window.api not found' };
        }
        const methods = Object.keys(window.api);
        return { methods: methods, count: methods.length };
      })();
    `);

    if (apiCheck.error) {
      console.error('SECURITY ERROR:', apiCheck.error);
      return false;
    }

    if (apiCheck.count > 15) {
      console.warn(
        `WARNING: window.api has ${apiCheck.count} methods (limit: 15)`
      );
    }

    console.log('Context isolation verified:', apiCheck.methods);
    return true;
  } catch (error) {
    console.error('Failed to verify context isolation:', error);
    return false;
  }
}
