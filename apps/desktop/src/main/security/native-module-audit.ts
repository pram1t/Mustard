/**
 * Native Module Audit Utilities
 *
 * Provides functions for auditing native .node modules for compatibility
 * with Electron's V8 memory cage and ABI requirements.
 */

// =============================================================================
// ELECTRON ABI MAPPING
// =============================================================================

/**
 * Maps Electron major version to Node.js ABI version.
 * Updated when new Electron stable releases ship.
 */
const ELECTRON_TO_NODE_ABI: Record<number, number> = {
  34: 132,
  33: 131,
  32: 130,
  31: 127,
  30: 125,
  29: 121,
  28: 119,
  27: 116,
};

/**
 * Get the Node.js ABI version for an Electron major version.
 */
export function getNodeABIForElectron(electronMajor: number): number | null {
  return ELECTRON_TO_NODE_ABI[electronMajor] ?? null;
}

// =============================================================================
// URL SAFETY FOR NPM REGISTRY
// =============================================================================

/**
 * Validate that a package registry URL is safe.
 */
export function isRegistryURLSafe(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') {
      return false;
    }
    // Only allow known registries
    const safeRegistries = [
      'registry.npmjs.org',
      'registry.yarnpkg.com',
      'npm.pkg.github.com',
    ];
    return safeRegistries.includes(parsed.hostname);
  } catch {
    return false;
  }
}

// =============================================================================
// V8 MEMORY CAGE COMPATIBILITY
// =============================================================================

/**
 * Known modules that are compatible with V8 memory cage (sandboxed pointers).
 * Modules that use V8 externalized ArrayBuffers may not be compatible.
 */
const V8_CAGE_COMPATIBLE = new Set([
  'keytar',
  'better-sqlite3',
  'fsevents',
  'cpu-features',
  'node-pty',
  '@electron/rebuild',
]);

/**
 * Check if a package is known to be V8 memory cage compatible.
 * Returns null if unknown (needs manual verification).
 */
export function isV8CageCompatible(packageName: string): boolean | null {
  if (V8_CAGE_COMPATIBLE.has(packageName)) {
    return true;
  }
  return null; // Unknown — needs manual verification
}

// =============================================================================
// CVE TRACKING
// =============================================================================

/**
 * Known CVEs for native modules used in Electron apps.
 * Updated periodically. This is a complementary check to npm audit.
 */
const KNOWN_CVES: Record<string, { cve: string; severity: string; fixedIn: string }[]> = {
  // Example entries — real entries would be maintained by security team
};

/**
 * Check for known CVEs for a package.
 */
export function getKnownCVEs(
  packageName: string
): { cve: string; severity: string; fixedIn: string }[] {
  return KNOWN_CVES[packageName] ?? [];
}

/**
 * Validate a file extension against allowed native module extensions.
 */
export function isNativeModuleExtension(filename: string): boolean {
  const ext = filename.split('.').pop()?.toLowerCase();
  return ext === 'node' || ext === 'dll' || ext === 'dylib' || ext === 'so';
}
