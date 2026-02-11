/**
 * Security Audit
 *
 * Comprehensive security checks for the Electron app.
 * Can be run at build time or as part of CI/CD.
 */

import { app } from 'electron';

// =============================================================================
// AUDIT TYPES
// =============================================================================

export interface AuditCheck {
  name: string;
  category: 'critical' | 'high' | 'medium' | 'low';
  passed: boolean;
  details: string;
}

export interface AuditReport {
  timestamp: number;
  platform: string;
  electronVersion: string;
  isPackaged: boolean;
  checks: AuditCheck[];
  passed: boolean;
}

// =============================================================================
// RUNTIME SECURITY CHECKS
// =============================================================================

/**
 * Check that ELECTRON_RUN_AS_NODE is not set.
 */
export function checkRunAsNode(): AuditCheck {
  const isSet = !!process.env.ELECTRON_RUN_AS_NODE;
  return {
    name: 'ELECTRON_RUN_AS_NODE disabled',
    category: 'critical',
    passed: !isSet,
    details: isSet
      ? 'ELECTRON_RUN_AS_NODE is set — Electron can be used as plain Node.js'
      : 'ELECTRON_RUN_AS_NODE is not set',
  };
}

/**
 * Check that NODE_OPTIONS is not set (or safe).
 */
export function checkNodeOptions(): AuditCheck {
  const nodeOpts = process.env.NODE_OPTIONS ?? '';
  const dangerous = ['--inspect', '--inspect-brk', '--require', '--loader'];
  const found = dangerous.filter((opt) => nodeOpts.includes(opt));

  return {
    name: 'NODE_OPTIONS is safe',
    category: 'critical',
    passed: found.length === 0,
    details:
      found.length > 0
        ? `Dangerous NODE_OPTIONS found: ${found.join(', ')}`
        : 'No dangerous NODE_OPTIONS detected',
  };
}

/**
 * Check that remote module is not enabled.
 */
export function checkRemoteModule(): AuditCheck {
  // In Electron 34+, remote module is removed, but check env anyway
  const isEnabled = !!process.env.ELECTRON_ENABLE_REMOTE_MODULE;
  return {
    name: 'Remote module disabled',
    category: 'high',
    passed: !isEnabled,
    details: isEnabled
      ? 'ELECTRON_ENABLE_REMOTE_MODULE is set'
      : 'Remote module is not enabled',
  };
}

/**
 * Check that the app is running in sandbox mode.
 */
export function checkSandbox(): AuditCheck {
  const sandboxDisabled = !!process.env.ELECTRON_DISABLE_SANDBOX;
  return {
    name: 'Sandbox enabled',
    category: 'critical',
    passed: !sandboxDisabled,
    details: sandboxDisabled
      ? 'ELECTRON_DISABLE_SANDBOX is set — sandbox bypassed'
      : 'Sandbox is enabled',
  };
}

/**
 * Check that debugging ports are not exposed via environment variables.
 */
export function checkDebugPorts(): AuditCheck {
  const debugPort = process.env.ELECTRON_DEBUG_PORT;
  const remoteDebug = process.env.ELECTRON_ENABLE_REMOTE_DEBUGGING;

  const issues: string[] = [];
  if (debugPort) issues.push(`ELECTRON_DEBUG_PORT is set to ${debugPort}`);
  if (remoteDebug) issues.push('ELECTRON_ENABLE_REMOTE_DEBUGGING is set');

  return {
    name: 'Debug ports not exposed',
    category: 'high',
    passed: issues.length === 0,
    details: issues.length > 0 ? issues.join('; ') : 'No debug ports exposed',
  };
}

/**
 * Check production-specific security.
 */
export function checkProductionSecurity(): AuditCheck {
  if (!app.isPackaged) {
    return {
      name: 'Production security (skipped in dev)',
      category: 'medium',
      passed: true,
      details: 'Running in development mode — production checks skipped',
    };
  }

  const issues: string[] = [];

  // Check that DevTools env vars aren't set
  if (process.env.ELECTRON_ENABLE_LOGGING) {
    issues.push('ELECTRON_ENABLE_LOGGING is set');
  }

  return {
    name: 'Production security',
    category: 'high',
    passed: issues.length === 0,
    details: issues.length > 0 ? issues.join('; ') : 'All production checks passed',
  };
}

// =============================================================================
// FULL AUDIT
// =============================================================================

/**
 * Run all security checks and return a report.
 */
export function runSecurityAudit(): AuditReport {
  const checks: AuditCheck[] = [
    checkRunAsNode(),
    checkNodeOptions(),
    checkRemoteModule(),
    checkSandbox(),
    checkDebugPorts(),
    checkProductionSecurity(),
  ];

  return {
    timestamp: Date.now(),
    platform: process.platform,
    electronVersion: process.versions.electron ?? 'unknown',
    isPackaged: app.isPackaged,
    checks,
    passed: checks.every((c) => c.passed),
  };
}

/**
 * Log audit report to console.
 */
export function logAuditReport(report: AuditReport): void {
  console.log('='.repeat(60));
  console.log('Security Audit Report');
  console.log('='.repeat(60));
  console.log(`Platform: ${report.platform}`);
  console.log(`Electron: ${report.electronVersion}`);
  console.log(`Packaged: ${report.isPackaged}`);
  console.log('');

  for (const check of report.checks) {
    const icon = check.passed ? '✓' : '✗';
    const level = check.category.toUpperCase();
    console.log(`  ${icon} [${level}] ${check.name}`);
    if (!check.passed) {
      console.log(`    → ${check.details}`);
    }
  }

  console.log('');
  const failed = report.checks.filter((c) => !c.passed);
  if (failed.length === 0) {
    console.log('✓ All security checks passed');
  } else {
    console.log(`✗ ${failed.length} check(s) failed`);
  }
  console.log('='.repeat(60));
}
