/**
 * Permission Manager Tests
 *
 * Tests for the four-level permission system.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PermissionManager, BUILTIN_RULES } from '../manager.js';
import type { PermissionRule, ApprovalCallback } from '../types.js';

describe('PermissionManager', () => {
  let manager: PermissionManager;

  beforeEach(() => {
    manager = new PermissionManager();
  });

  // ==========================================================================
  // Built-in Deny Rules
  // ==========================================================================

  describe('Built-in Deny Rules', () => {
    it('should block writes to /etc directory', async () => {
      const result = await manager.check({
        tool: 'Write',
        params: { file_path: '/etc/passwd' },
        sessionId: 'test',
      });

      expect(result.decision).toBe('deny');
      expect(result.reason).toContain('system directories');
    });

    it('should block writes to /usr directory', async () => {
      const result = await manager.check({
        tool: 'Write',
        params: { file_path: '/usr/bin/test' },
        sessionId: 'test',
      });

      expect(result.decision).toBe('deny');
    });

    it('should block edits to system directories', async () => {
      const result = await manager.check({
        tool: 'Edit',
        params: { file_path: '/var/log/syslog' },
        sessionId: 'test',
      });

      expect(result.decision).toBe('deny');
    });

    it('should block rm -rf /', async () => {
      const result = await manager.check({
        tool: 'Bash',
        params: { command: 'rm -rf /' },
        sessionId: 'test',
      });

      expect(result.decision).toBe('deny');
      expect(result.reason).toContain('not allowed');
    });

    it('should block rm -rf ~', async () => {
      const result = await manager.check({
        tool: 'Bash',
        params: { command: 'rm -rf ~' },
        sessionId: 'test',
      });

      expect(result.decision).toBe('deny');
    });

    it('should block reading .env files', async () => {
      const result = await manager.check({
        tool: 'Read',
        params: { file_path: '/app/.env' },
        sessionId: 'test',
      });

      expect(result.decision).toBe('deny');
      expect(result.reason).toContain('secrets');
    });

    it('should block reading .env.production files', async () => {
      const result = await manager.check({
        tool: 'Read',
        params: { file_path: '/app/.env.production' },
        sessionId: 'test',
      });

      expect(result.decision).toBe('deny');
    });

    it('should block reading private key files', async () => {
      const result = await manager.check({
        tool: 'Read',
        params: { file_path: '/app/server.key' },
        sessionId: 'test',
      });

      expect(result.decision).toBe('deny');
      expect(result.reason).toContain('private key');
    });

    it('should block reading SSH credentials', async () => {
      const result = await manager.check({
        tool: 'Read',
        params: { file_path: '/home/user/.ssh/id_rsa' },
        sessionId: 'test',
      });

      expect(result.decision).toBe('deny');
      expect(result.reason).toContain('SSH');
    });

    it('should block sudo commands', async () => {
      const result = await manager.check({
        tool: 'Bash',
        params: { command: 'sudo rm -rf /tmp/test' },
        sessionId: 'test',
      });

      expect(result.decision).toBe('deny');
      expect(result.reason.toLowerCase()).toContain('privilege');
    });

    it('should block disk formatting commands', async () => {
      const result = await manager.check({
        tool: 'Bash',
        params: { command: 'mkfs.ext4 /dev/sda1' },
        sessionId: 'test',
      });

      expect(result.decision).toBe('deny');
    });

    it('should have built-in rules exported', () => {
      expect(BUILTIN_RULES).toBeDefined();
      expect(BUILTIN_RULES.length).toBeGreaterThan(0);
      expect(BUILTIN_RULES[0].type).toBe('builtin_deny');
    });
  });

  // ==========================================================================
  // Permission Modes
  // ==========================================================================

  describe('Permission Modes', () => {
    describe('Permissive Mode', () => {
      beforeEach(() => {
        manager = new PermissionManager({ mode: 'permissive' });
      });

      it('should allow non-blocked tools without asking', async () => {
        const result = await manager.check({
          tool: 'Bash',
          params: { command: 'ls -la' },
          sessionId: 'test',
        });

        expect(result.decision).toBe('allow');
        expect(result.reason).toContain('Permissive mode');
      });

      it('should still block built-in deny rules', async () => {
        const result = await manager.check({
          tool: 'Read',
          params: { file_path: '/app/.env' },
          sessionId: 'test',
        });

        expect(result.decision).toBe('deny');
      });
    });

    describe('Default Mode', () => {
      beforeEach(() => {
        manager = new PermissionManager({ mode: 'default' });
      });

      it('should allow Read tool by default', async () => {
        const result = await manager.check({
          tool: 'Read',
          params: { file_path: '/app/README.md' },
          sessionId: 'test',
        });

        expect(result.decision).toBe('allow');
        expect(result.reason).toContain('safe tool');
      });

      it('should allow Glob tool by default', async () => {
        const result = await manager.check({
          tool: 'Glob',
          params: { pattern: '**/*.ts' },
          sessionId: 'test',
        });

        expect(result.decision).toBe('allow');
      });

      it('should allow Grep tool by default', async () => {
        const result = await manager.check({
          tool: 'Grep',
          params: { pattern: 'TODO' },
          sessionId: 'test',
        });

        expect(result.decision).toBe('allow');
      });

      it('should ask for Write tool', async () => {
        const result = await manager.check({
          tool: 'Write',
          params: { file_path: '/app/test.ts', content: 'test' },
          sessionId: 'test',
        });

        expect(result.decision).toBe('ask');
        expect(result.reason).toContain('requires approval');
      });

      it('should ask for Bash tool', async () => {
        const result = await manager.check({
          tool: 'Bash',
          params: { command: 'npm install' },
          sessionId: 'test',
        });

        expect(result.decision).toBe('ask');
      });
    });

    describe('Strict Mode', () => {
      beforeEach(() => {
        manager = new PermissionManager({ mode: 'strict' });
      });

      it('should ask for Read tool', async () => {
        const result = await manager.check({
          tool: 'Read',
          params: { file_path: '/app/README.md' },
          sessionId: 'test',
        });

        expect(result.decision).toBe('ask');
        expect(result.reason).toContain('Strict mode');
      });

      it('should ask for all tools', async () => {
        const tools = ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep'];

        for (const tool of tools) {
          const result = await manager.check({
            tool,
            params: {},
            sessionId: 'test',
          });

          // Built-in deny might trigger for some
          expect(['ask', 'deny']).toContain(result.decision);
        }
      });
    });
  });

  // ==========================================================================
  // Custom Rules
  // ==========================================================================

  describe('Custom Rules', () => {
    it('should apply custom deny rules', async () => {
      manager.addDenyRule({
        tool: 'Bash',
        commandPattern: 'npm\\s+publish',
        reason: 'Publishing is not allowed',
      });

      const result = await manager.check({
        tool: 'Bash',
        params: { command: 'npm publish' },
        sessionId: 'test',
      });

      expect(result.decision).toBe('deny');
      expect(result.reason).toBe('Publishing is not allowed');
    });

    it('should apply custom allow rules', async () => {
      manager = new PermissionManager({ mode: 'strict' });
      manager.addAllowRule({
        tool: 'Write',
        pathPattern: '\\.test\\.ts$',
        reason: 'Test files are allowed',
      });

      const result = await manager.check({
        tool: 'Write',
        params: { file_path: '/app/foo.test.ts', content: 'test' },
        sessionId: 'test',
      });

      expect(result.decision).toBe('allow');
      expect(result.reason).toBe('Test files are allowed');
    });

    it('should apply custom ask rules', async () => {
      manager = new PermissionManager({ mode: 'permissive' });
      manager.addAskRule({
        tool: 'Bash',
        commandPattern: 'git\\s+push',
        reason: 'Git push requires confirmation',
      });

      const result = await manager.check({
        tool: 'Bash',
        params: { command: 'git push origin main' },
        sessionId: 'test',
      });

      expect(result.decision).toBe('ask');
      expect(result.reason).toBe('Git push requires confirmation');
    });

    it('should respect rule priority: deny > allow > ask', async () => {
      manager = new PermissionManager({ mode: 'permissive' });

      // Add conflicting rules
      manager.addAllowRule({
        tool: 'Bash',
        commandPattern: 'rm',
        reason: 'Allow rm',
      });
      manager.addDenyRule({
        tool: 'Bash',
        commandPattern: 'rm\\s+-rf',
        reason: 'Deny rm -rf',
      });

      // rm -rf should still be denied
      const result = await manager.check({
        tool: 'Bash',
        params: { command: 'rm -rf /tmp/test' },
        sessionId: 'test',
      });

      expect(result.decision).toBe('deny');
    });
  });

  // ==========================================================================
  // Approval Callback
  // ==========================================================================

  describe('Approval Callback', () => {
    it('should call approval callback when decision is ask', async () => {
      const callback = vi.fn().mockResolvedValue(true);
      manager.setApprovalCallback(callback);

      await manager.check({
        tool: 'Write',
        params: { file_path: '/app/test.ts', content: 'test' },
        sessionId: 'test',
      });

      expect(callback).toHaveBeenCalledWith(
        'Write',
        { file_path: '/app/test.ts', content: 'test' },
        expect.any(String)
      );
    });

    it('should allow when user approves', async () => {
      manager.setApprovalCallback(async () => true);

      const result = await manager.check({
        tool: 'Write',
        params: { file_path: '/app/test.ts', content: 'test' },
        sessionId: 'test',
      });

      expect(result.decision).toBe('allow');
      expect(result.userApproved).toBe(true);
    });

    it('should deny when user declines', async () => {
      manager.setApprovalCallback(async () => false);

      const result = await manager.check({
        tool: 'Write',
        params: { file_path: '/app/test.ts', content: 'test' },
        sessionId: 'test',
      });

      expect(result.decision).toBe('deny');
      expect(result.userApproved).toBe(false);
    });

    it('should return ask decision when no callback is set', async () => {
      const result = await manager.check({
        tool: 'Write',
        params: { file_path: '/app/test.ts', content: 'test' },
        sessionId: 'test',
      });

      expect(result.decision).toBe('ask');
      expect(result.userApproved).toBeUndefined();
    });
  });

  // ==========================================================================
  // Approval Caching
  // ==========================================================================

  describe('Approval Caching', () => {
    it('should cache approved decisions', async () => {
      const callback = vi.fn().mockResolvedValue(true);
      manager.setApprovalCallback(callback);

      // First call
      await manager.check({
        tool: 'Write',
        params: { file_path: '/app/test.ts', content: 'test' },
        sessionId: 'test',
      });

      // Second call with same params
      await manager.check({
        tool: 'Write',
        params: { file_path: '/app/test.ts', content: 'test' },
        sessionId: 'test',
      });

      // Callback should only be called once
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should cache denied decisions', async () => {
      const callback = vi.fn().mockResolvedValue(false);
      manager.setApprovalCallback(callback);

      // First call
      await manager.check({
        tool: 'Bash',
        params: { command: 'npm install' },
        sessionId: 'test',
      });

      // Second call
      const result = await manager.check({
        tool: 'Bash',
        params: { command: 'npm install' },
        sessionId: 'test',
      });

      expect(callback).toHaveBeenCalledTimes(1);
      expect(result.decision).toBe('deny');
      expect(result.reason).toBe('Previously denied');
    });

    it('should clear cache when requested', async () => {
      const callback = vi.fn().mockResolvedValue(true);
      manager.setApprovalCallback(callback);

      // First call
      await manager.check({
        tool: 'Write',
        params: { file_path: '/app/test.ts', content: 'test' },
        sessionId: 'test',
      });

      // Clear cache
      manager.clearCache();

      // Second call should trigger callback again
      await manager.check({
        tool: 'Write',
        params: { file_path: '/app/test.ts', content: 'test' },
        sessionId: 'test',
      });

      expect(callback).toHaveBeenCalledTimes(2);
    });

    it('should not cache when disabled', async () => {
      manager = new PermissionManager({ mode: 'default', cacheApprovals: false });
      const callback = vi.fn().mockResolvedValue(true);
      manager.setApprovalCallback(callback);

      // Two calls
      await manager.check({
        tool: 'Write',
        params: { file_path: '/app/test.ts', content: 'test' },
        sessionId: 'test',
      });
      await manager.check({
        tool: 'Write',
        params: { file_path: '/app/test.ts', content: 'test' },
        sessionId: 'test',
      });

      expect(callback).toHaveBeenCalledTimes(2);
    });
  });

  // ==========================================================================
  // Rule Matching
  // ==========================================================================

  describe('Rule Matching', () => {
    it('should match tool name exactly', () => {
      const rule: PermissionRule = { type: 'deny', tool: 'Write' };
      const context = { tool: 'Write', params: {}, sessionId: 'test' };

      expect(manager.matchesRule(rule, context)).toBe(true);
    });

    it('should not match different tool names', () => {
      const rule: PermissionRule = { type: 'deny', tool: 'Write' };
      const context = { tool: 'Edit', params: {}, sessionId: 'test' };

      expect(manager.matchesRule(rule, context)).toBe(false);
    });

    it('should match tool pattern (regex)', () => {
      const rule: PermissionRule = { type: 'deny', toolPattern: '^(Write|Edit)$' };

      expect(manager.matchesRule(rule, { tool: 'Write', params: {}, sessionId: 'test' })).toBe(true);
      expect(manager.matchesRule(rule, { tool: 'Edit', params: {}, sessionId: 'test' })).toBe(true);
      expect(manager.matchesRule(rule, { tool: 'Read', params: {}, sessionId: 'test' })).toBe(false);
    });

    it('should match path pattern', () => {
      const rule: PermissionRule = { type: 'deny', tool: 'Write', pathPattern: '\\.ts$' };

      expect(manager.matchesRule(rule, {
        tool: 'Write',
        params: { file_path: '/app/test.ts' },
        sessionId: 'test',
      })).toBe(true);

      expect(manager.matchesRule(rule, {
        tool: 'Write',
        params: { file_path: '/app/test.js' },
        sessionId: 'test',
      })).toBe(false);
    });

    it('should match command pattern', () => {
      const rule: PermissionRule = { type: 'deny', tool: 'Bash', commandPattern: 'npm\\s+install' };

      expect(manager.matchesRule(rule, {
        tool: 'Bash',
        params: { command: 'npm install express' },
        sessionId: 'test',
      })).toBe(true);

      expect(manager.matchesRule(rule, {
        tool: 'Bash',
        params: { command: 'yarn add express' },
        sessionId: 'test',
      })).toBe(false);
    });

    it('should handle invalid regex gracefully', () => {
      const rule: PermissionRule = { type: 'deny', tool: 'Bash', commandPattern: '[invalid(' };

      // Should not throw, just return false
      expect(manager.matchesRule(rule, {
        tool: 'Bash',
        params: { command: 'test' },
        sessionId: 'test',
      })).toBe(false);
    });

    it('should not match empty rules', () => {
      const rule: PermissionRule = { type: 'deny' };

      expect(manager.matchesRule(rule, {
        tool: 'Write',
        params: {},
        sessionId: 'test',
      })).toBe(false);
    });
  });

  // ==========================================================================
  // Default Allow Tools Configuration
  // ==========================================================================

  describe('Default Allow Tools', () => {
    it('should allow configuring default allow tools', () => {
      manager = new PermissionManager({
        mode: 'default',
        defaultAllowTools: ['Read', 'CustomTool'],
      });

      // CustomTool should be allowed
      const result1 = manager.check({
        tool: 'CustomTool',
        params: {},
        sessionId: 'test',
      });

      // Glob should now require approval (not in custom list)
      const result2 = manager.check({
        tool: 'Glob',
        params: {},
        sessionId: 'test',
      });

      expect(result1).resolves.toMatchObject({ decision: 'allow' });
      expect(result2).resolves.toMatchObject({ decision: 'ask' });
    });

    it('should allow adding tools to default allow list', async () => {
      manager.addDefaultAllowTool('CustomTool');

      const result = await manager.check({
        tool: 'CustomTool',
        params: {},
        sessionId: 'test',
      });

      expect(result.decision).toBe('allow');
    });

    it('should allow removing tools from default allow list', async () => {
      manager.removeDefaultAllowTool('Read');

      const result = await manager.check({
        tool: 'Read',
        params: { file_path: '/app/README.md' },
        sessionId: 'test',
      });

      expect(result.decision).toBe('ask');
    });
  });

  // ==========================================================================
  // Mode Management
  // ==========================================================================

  describe('Mode Management', () => {
    it('should get current mode', () => {
      expect(manager.getMode()).toBe('default');
    });

    it('should allow setting mode', async () => {
      manager.setMode('strict');
      expect(manager.getMode()).toBe('strict');

      const result = await manager.check({
        tool: 'Read',
        params: { file_path: '/app/README.md' },
        sessionId: 'test',
      });

      expect(result.decision).toBe('ask');
    });
  });
});
