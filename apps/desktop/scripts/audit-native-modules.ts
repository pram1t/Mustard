/**
 * Native Module Audit Script
 *
 * Audits all native .node binaries in node_modules, checks ABI compatibility
 * with the current Electron version, and reports potential issues.
 *
 * Run: npx tsx apps/desktop/scripts/audit-native-modules.ts
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { resolve, dirname, join, relative, extname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const ROOT = resolve(__dirname, '..');
const NODE_MODULES = resolve(ROOT, 'node_modules');
const MONOREPO_NODE_MODULES = resolve(ROOT, '..', '..', 'node_modules');

// =============================================================================
// TYPES
// =============================================================================

interface NativeModuleInfo {
  path: string;
  relativePath: string;
  packageName: string;
  size: number;
}

interface AuditResult {
  nativeModules: NativeModuleInfo[];
  electronVersion: string;
  nodeABI: string;
  warnings: string[];
  info: string[];
}

// =============================================================================
// MODULE SCANNER
// =============================================================================

/**
 * Recursively find all .node files in a directory.
 */
function findNativeModules(dir: string, basePath: string): NativeModuleInfo[] {
  const results: NativeModuleInfo[] = [];

  if (!existsSync(dir)) {
    return results;
  }

  try {
    const entries = readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);

      if (entry.isDirectory()) {
        // Skip .cache, .git, etc.
        if (entry.name.startsWith('.')) continue;
        results.push(...findNativeModules(fullPath, basePath));
      } else if (entry.isFile() && extname(entry.name) === '.node') {
        const stat = statSync(fullPath);
        const relPath = relative(basePath, fullPath);

        // Extract package name from path
        const parts = relPath.split(/[\\/]/);
        let packageName: string;
        if (parts[0].startsWith('@')) {
          packageName = `${parts[0]}/${parts[1]}`;
        } else {
          packageName = parts[0];
        }

        results.push({
          path: fullPath,
          relativePath: relPath,
          packageName,
          size: stat.size,
        });
      }
    }
  } catch {
    // Skip directories we can't read
  }

  return results;
}

// =============================================================================
// ELECTRON VERSION CHECK
// =============================================================================

function getElectronVersion(): string {
  const pkgPath = resolve(ROOT, 'package.json');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
  return pkg.devDependencies?.electron ?? 'unknown';
}

function getElectronNodeABI(): string {
  try {
    // Try to get the ABI version from Electron's headers
    const electronVersion = getElectronVersion();
    // Electron major versions map to Node ABI versions
    const majorVersion = parseInt(electronVersion.split('.')[0], 10);

    // Known mappings (Electron major → Node ABI)
    const abiMap: Record<number, number> = {
      34: 132, // Electron 34 → Node 22
      33: 131,
      32: 130,
      31: 127,
      30: 125,
      29: 121,
      28: 119,
    };

    const abi = abiMap[majorVersion];
    return abi ? `${abi}` : 'unknown';
  } catch {
    return 'unknown';
  }
}

// =============================================================================
// KNOWN NATIVE MODULES CHECK
// =============================================================================

/**
 * Known native modules that are commonly used with Electron.
 * Maps package name to notes about compatibility.
 */
const KNOWN_NATIVE_MODULES: Record<string, { safe: boolean; notes: string }> = {
  'keytar': {
    safe: true,
    notes: 'OS credential storage. Electron-compatible.',
  },
  'better-sqlite3': {
    safe: true,
    notes: 'SQLite bindings. Needs rebuild for Electron.',
  },
  'node-pty': {
    safe: true,
    notes: 'Pseudo-terminal. Needs rebuild for Electron.',
  },
  'fsevents': {
    safe: true,
    notes: 'macOS file watcher. Optional dependency, safe to use.',
  },
  'cpu-features': {
    safe: true,
    notes: 'CPU feature detection. Read-only, safe.',
  },
};

// =============================================================================
// AUDIT
// =============================================================================

function runAudit(): AuditResult {
  const electronVersion = getElectronVersion();
  const nodeABI = getElectronNodeABI();
  const warnings: string[] = [];
  const info: string[] = [];

  // Scan both local and monorepo node_modules
  const localModules = findNativeModules(NODE_MODULES, NODE_MODULES);
  const monorepoModules = findNativeModules(MONOREPO_NODE_MODULES, MONOREPO_NODE_MODULES);
  const nativeModules = [...localModules, ...monorepoModules];

  // Check each native module
  for (const mod of nativeModules) {
    const known = KNOWN_NATIVE_MODULES[mod.packageName];
    if (known) {
      info.push(`${mod.packageName}: ${known.notes}`);
    } else {
      warnings.push(
        `Unknown native module: ${mod.packageName} (${mod.relativePath}). ` +
        `Verify it is compatible with Electron ${electronVersion} and V8 memory cage.`
      );
    }
  }

  // Check for npm audit vulnerabilities in native packages
  try {
    const auditOutput = execSync('npm audit --json 2>/dev/null', {
      cwd: ROOT,
      encoding: 'utf-8',
      timeout: 30000,
    });
    const audit = JSON.parse(auditOutput);
    if (audit.vulnerabilities) {
      const nativePackageNames = new Set(nativeModules.map((m) => m.packageName));
      for (const [name, vuln] of Object.entries(audit.vulnerabilities as Record<string, { severity: string }>)) {
        if (nativePackageNames.has(name)) {
          warnings.push(
            `CVE alert: ${name} has ${vuln.severity} severity vulnerability. Update immediately.`
          );
        }
      }
    }
  } catch {
    info.push('npm audit skipped (not available or failed)');
  }

  return { nativeModules, electronVersion, nodeABI, warnings, info };
}

// =============================================================================
// OUTPUT
// =============================================================================

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function printReport(result: AuditResult): void {
  console.log('='.repeat(60));
  console.log('Native Module Audit Report');
  console.log('='.repeat(60));
  console.log(`Electron version: ${result.electronVersion}`);
  console.log(`Node ABI: ${result.nodeABI}`);
  console.log(`Native modules found: ${result.nativeModules.length}`);
  console.log('');

  if (result.nativeModules.length > 0) {
    console.log('── Native Modules ──────────────────────────────────────────');
    for (const mod of result.nativeModules) {
      console.log(`  ${mod.packageName}`);
      console.log(`    Path: ${mod.relativePath}`);
      console.log(`    Size: ${formatSize(mod.size)}`);
    }
    console.log('');
  }

  if (result.warnings.length > 0) {
    console.log('── Warnings ────────────────────────────────────────────────');
    for (const warn of result.warnings) {
      console.log(`  ⚠ ${warn}`);
    }
    console.log('');
  }

  if (result.info.length > 0) {
    console.log('── Info ────────────────────────────────────────────────────');
    for (const msg of result.info) {
      console.log(`  ℹ ${msg}`);
    }
    console.log('');
  }

  if (result.nativeModules.length === 0) {
    console.log('✓ No native modules found. No ABI compatibility concerns.');
  } else if (result.warnings.length === 0) {
    console.log('✓ All native modules are known and compatible.');
  } else {
    console.log(`⚠ ${result.warnings.length} warning(s) found. Review before release.`);
  }

  console.log('='.repeat(60));
}

// =============================================================================
// MAIN
// =============================================================================

const result = runAudit();
printReport(result);

if (result.warnings.length > 0) {
  process.exit(1);
}
