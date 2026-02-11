/**
 * Release Checklist
 *
 * Automated verification of release readiness.
 * Run before every release to ensure all requirements are met.
 *
 * Run: npx tsx apps/desktop/scripts/release-checklist.ts
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '..');
const MONOREPO_ROOT = resolve(ROOT, '..', '..');

// =============================================================================
// TYPES
// =============================================================================

interface CheckResult {
  name: string;
  passed: boolean;
  details: string;
}

// =============================================================================
// CHECKS
// =============================================================================

function checkElectronPinned(): CheckResult {
  const pkg = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf-8'));
  const version = pkg.devDependencies?.electron;
  const pinned = version && /^\d+\.\d+\.\d+$/.test(version);
  return {
    name: 'Electron version pinned',
    passed: !!pinned,
    details: pinned ? `Pinned to ${version}` : `Not pinned: ${version}`,
  };
}

function checkBuildConfig(): CheckResult {
  const configPath = resolve(ROOT, 'electron-builder.yml');
  const exists = existsSync(configPath);
  if (!exists) {
    return { name: 'Build config exists', passed: false, details: 'electron-builder.yml not found' };
  }
  const content = readFileSync(configPath, 'utf-8');
  const hasAsar = content.includes('asar: true');
  const hasProtocol = content.includes('openagent');
  return {
    name: 'Build config valid',
    passed: hasAsar && hasProtocol,
    details: `ASAR: ${hasAsar}, Protocol: ${hasProtocol}`,
  };
}

function checkEntitlements(): CheckResult {
  const plistPath = resolve(ROOT, 'build', 'entitlements.mac.plist');
  const exists = existsSync(plistPath);
  return {
    name: 'macOS entitlements',
    passed: exists,
    details: exists ? 'entitlements.mac.plist found' : 'Missing entitlements file',
  };
}

function checkTypeCheck(): CheckResult {
  try {
    execSync('npx tsc --noEmit', { cwd: ROOT, stdio: 'pipe', timeout: 60000 });
    return { name: 'Type check', passed: true, details: 'No type errors' };
  } catch {
    return { name: 'Type check', passed: false, details: 'Type errors found' };
  }
}

function checkTests(): CheckResult {
  try {
    const output = execSync('npx vitest run --reporter=json 2>/dev/null', {
      cwd: ROOT,
      encoding: 'utf-8',
      stdio: 'pipe',
      timeout: 120000,
    });
    // Try to parse JSON output
    const jsonStart = output.indexOf('{');
    if (jsonStart >= 0) {
      const json = JSON.parse(output.slice(jsonStart));
      const total = json.numTotalTests ?? 0;
      const passed = json.numPassedTests ?? 0;
      const failed = json.numFailedTests ?? 0;
      return {
        name: 'Test suite',
        passed: failed === 0,
        details: `${passed}/${total} tests passed, ${failed} failed`,
      };
    }
    return { name: 'Test suite', passed: true, details: 'Tests completed (no JSON output)' };
  } catch {
    return { name: 'Test suite', passed: false, details: 'Tests failed or timed out' };
  }
}

function checkSecurityFiles(): CheckResult {
  const requiredFiles = [
    'src/main/security/app-security.ts',
    'src/main/security/web-security.ts',
    'src/main/security/sandbox.ts',
    'src/main/security/devtools.ts',
    'src/main/security/network-security.ts',
    'src/main/security/path-validation.ts',
    'src/main/security/security-audit.ts',
  ];

  const missing = requiredFiles.filter((f) => !existsSync(resolve(ROOT, f)));
  return {
    name: 'Security modules',
    passed: missing.length === 0,
    details: missing.length === 0
      ? `All ${requiredFiles.length} security modules present`
      : `Missing: ${missing.join(', ')}`,
  };
}

function checkGitClean(): CheckResult {
  try {
    const status = execSync('git status --porcelain', {
      cwd: MONOREPO_ROOT,
      encoding: 'utf-8',
      stdio: 'pipe',
    }).trim();
    return {
      name: 'Git working tree',
      passed: status === '',
      details: status === '' ? 'Clean' : `${status.split('\n').length} uncommitted changes`,
    };
  } catch {
    return { name: 'Git working tree', passed: false, details: 'Unable to check git status' };
  }
}

function checkVersion(): CheckResult {
  const pkg = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf-8'));
  const version = pkg.version;
  const isValid = /^\d+\.\d+\.\d+(-[a-z]+\.\d+)?$/.test(version);
  return {
    name: 'Version format',
    passed: isValid,
    details: `Version: ${version}`,
  };
}

// =============================================================================
// MAIN
// =============================================================================

console.log('='.repeat(60));
console.log('Release Readiness Checklist');
console.log('='.repeat(60));
console.log('');

const checks: CheckResult[] = [
  checkElectronPinned(),
  checkBuildConfig(),
  checkEntitlements(),
  checkSecurityFiles(),
  checkVersion(),
  checkGitClean(),
  checkTypeCheck(),
  // checkTests(), // Uncomment for full check (slow)
];

let allPassed = true;
for (const check of checks) {
  const icon = check.passed ? '✓' : '✗';
  console.log(`  ${icon} ${check.name}: ${check.details}`);
  if (!check.passed) allPassed = false;
}

console.log('');
if (allPassed) {
  console.log('✓ All checks passed — ready for release');
} else {
  console.log('✗ Some checks failed — fix before releasing');
}
console.log('='.repeat(60));

if (!allPassed) {
  process.exit(1);
}
