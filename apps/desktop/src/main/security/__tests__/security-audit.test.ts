import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('electron', () => ({
  app: {
    isPackaged: false,
  },
}));

import {
  checkRunAsNode,
  checkNodeOptions,
  checkRemoteModule,
  checkSandbox,
  checkDebugPorts,
  checkProductionSecurity,
  runSecurityAudit,
} from '../security-audit';

describe('Security Audit', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Reset relevant env vars
    delete process.env.ELECTRON_RUN_AS_NODE;
    delete process.env.NODE_OPTIONS;
    delete process.env.ELECTRON_ENABLE_REMOTE_MODULE;
    delete process.env.ELECTRON_DISABLE_SANDBOX;
    delete process.env.ELECTRON_DEBUG_PORT;
    delete process.env.ELECTRON_ENABLE_LOGGING;
  });

  afterEach(() => {
    // Restore original env
    process.env = { ...originalEnv };
  });

  describe('checkRunAsNode', () => {
    it('passes when ELECTRON_RUN_AS_NODE is not set', () => {
      const result = checkRunAsNode();
      expect(result.passed).toBe(true);
      expect(result.category).toBe('critical');
    });

    it('fails when ELECTRON_RUN_AS_NODE is set', () => {
      process.env.ELECTRON_RUN_AS_NODE = '1';
      const result = checkRunAsNode();
      expect(result.passed).toBe(false);
    });
  });

  describe('checkNodeOptions', () => {
    it('passes when NODE_OPTIONS is not set', () => {
      const result = checkNodeOptions();
      expect(result.passed).toBe(true);
      expect(result.category).toBe('critical');
    });

    it('fails when NODE_OPTIONS contains --inspect', () => {
      process.env.NODE_OPTIONS = '--inspect=0.0.0.0:9229';
      const result = checkNodeOptions();
      expect(result.passed).toBe(false);
    });

    it('fails when NODE_OPTIONS contains --require', () => {
      process.env.NODE_OPTIONS = '--require ./malicious.js';
      const result = checkNodeOptions();
      expect(result.passed).toBe(false);
    });

    it('passes with safe NODE_OPTIONS', () => {
      process.env.NODE_OPTIONS = '--max-old-space-size=4096';
      const result = checkNodeOptions();
      expect(result.passed).toBe(true);
    });
  });

  describe('checkRemoteModule', () => {
    it('passes when remote module is not enabled', () => {
      const result = checkRemoteModule();
      expect(result.passed).toBe(true);
    });

    it('fails when ELECTRON_ENABLE_REMOTE_MODULE is set', () => {
      process.env.ELECTRON_ENABLE_REMOTE_MODULE = '1';
      const result = checkRemoteModule();
      expect(result.passed).toBe(false);
    });
  });

  describe('checkSandbox', () => {
    it('passes when sandbox is not disabled', () => {
      const result = checkSandbox();
      expect(result.passed).toBe(true);
      expect(result.category).toBe('critical');
    });

    it('fails when ELECTRON_DISABLE_SANDBOX is set', () => {
      process.env.ELECTRON_DISABLE_SANDBOX = '1';
      const result = checkSandbox();
      expect(result.passed).toBe(false);
    });
  });

  describe('checkDebugPorts', () => {
    it('passes when no debug ports are exposed', () => {
      const result = checkDebugPorts();
      expect(result.passed).toBe(true);
    });

    it('fails when ELECTRON_DEBUG_PORT is set', () => {
      process.env.ELECTRON_DEBUG_PORT = '9229';
      const result = checkDebugPorts();
      expect(result.passed).toBe(false);
    });
  });

  describe('checkProductionSecurity', () => {
    it('passes in development (skips prod checks)', () => {
      const result = checkProductionSecurity();
      expect(result.passed).toBe(true);
    });
  });

  describe('runSecurityAudit', () => {
    it('returns a complete audit report', () => {
      const report = runSecurityAudit();
      expect(report.checks).toHaveLength(6);
      expect(report.platform).toBe(process.platform);
      expect(report.passed).toBe(true);
    });

    it('reports failure when a critical check fails', () => {
      process.env.ELECTRON_RUN_AS_NODE = '1';
      const report = runSecurityAudit();
      expect(report.passed).toBe(false);
      const failed = report.checks.filter((c) => !c.passed);
      expect(failed.length).toBeGreaterThan(0);
    });

    it('includes timestamp', () => {
      const before = Date.now();
      const report = runSecurityAudit();
      const after = Date.now();
      expect(report.timestamp).toBeGreaterThanOrEqual(before);
      expect(report.timestamp).toBeLessThanOrEqual(after);
    });
  });
});
