/**
 * Hook Executor Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { HookExecutor, createHookExecutor } from '../executor.js';
import type { HooksConfig, HookConfig, HookContext, HookResult } from '../types.js';

// Mock the logger
vi.mock('@openagent/logger', () => ({
  getLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

describe('HookExecutor', () => {
  const defaultContext: HookContext = {
    sessionId: 'test-session-123',
    cwd: process.cwd(),
  };

  // Create temp directory for test scripts
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hook-test-'));
  });

  afterEach(() => {
    // Clean up temp files
    try {
      const files = fs.readdirSync(tempDir);
      for (const file of files) {
        fs.unlinkSync(path.join(tempDir, file));
      }
      fs.rmdirSync(tempDir);
    } catch {
      // Ignore cleanup errors
    }
  });

  // Helper to create a test script
  function createTestScript(name: string, content: string): string {
    const scriptPath = path.join(tempDir, name);
    fs.writeFileSync(scriptPath, content);
    return scriptPath;
  }

  describe('constructor and basic methods', () => {
    it('should create executor with empty config', () => {
      const executor = new HookExecutor({}, defaultContext);
      expect(executor.hasHooks('session_start')).toBe(false);
      expect(executor.getHookCount('session_start')).toBe(0);
    });

    it('should create executor with hooks config', () => {
      const config: HooksConfig = {
        session_start: [{ command: 'echo test' }],
        pre_tool_use: [{ command: 'echo pre' }, { command: 'echo pre2' }],
      };
      const executor = new HookExecutor(config, defaultContext);

      expect(executor.hasHooks('session_start')).toBe(true);
      expect(executor.hasHooks('pre_tool_use')).toBe(true);
      expect(executor.hasHooks('stop')).toBe(false);

      expect(executor.getHookCount('session_start')).toBe(1);
      expect(executor.getHookCount('pre_tool_use')).toBe(2);
      expect(executor.getHookCount('stop')).toBe(0);
    });

    it('should register hooks dynamically', () => {
      const executor = new HookExecutor({}, defaultContext);
      expect(executor.hasHooks('session_start')).toBe(false);

      executor.register('session_start', { command: 'echo test' });
      expect(executor.hasHooks('session_start')).toBe(true);
      expect(executor.getHookCount('session_start')).toBe(1);
    });

    it('should return registered events', () => {
      const config: HooksConfig = {
        session_start: [{ command: 'echo test' }],
        stop: [{ command: 'echo stop' }],
      };
      const executor = new HookExecutor(config, defaultContext);

      const events = executor.getRegisteredEvents();
      expect(events).toContain('session_start');
      expect(events).toContain('stop');
      expect(events).not.toContain('pre_tool_use');
    });
  });

  describe('hook matching', () => {
    it('should run hooks without matcher for all contexts', async () => {
      const scriptPath = createTestScript('no-matcher.js',
        'console.log(JSON.stringify({ blocked: false }));'
      );

      const config: HooksConfig = {
        pre_tool_use: [{ command: `node "${scriptPath}"` }],
      };
      const executor = new HookExecutor(config, defaultContext);

      // Should match any tool
      const result1 = await executor.trigger('pre_tool_use', { tool: 'Read' });
      expect(result1.blocked).toBe(false);

      const result2 = await executor.trigger('pre_tool_use', { tool: 'Bash' });
      expect(result2.blocked).toBe(false);
    });

    it('should match hooks by exact tool name', async () => {
      const scriptPath = createTestScript('exact-match.js',
        'console.log(JSON.stringify({ blocked: false, output: "matched" }));'
      );

      const config: HooksConfig = {
        pre_tool_use: [
          {
            command: `node "${scriptPath}"`,
            matcher: { tool: 'Bash' },
          },
        ],
      };
      const executor = new HookExecutor(config, defaultContext);

      // Should match Bash
      const result1 = await executor.trigger('pre_tool_use', { tool: 'Bash' });
      expect(result1.blocked).toBe(false);
      expect(result1.output).toBe('matched');

      // Should not match Read (no hooks run, returns default)
      const result2 = await executor.trigger('pre_tool_use', { tool: 'Read' });
      expect(result2.blocked).toBe(false);
      expect(result2.output).toBeUndefined();
    });

    it('should match hooks by tool pattern', async () => {
      const scriptPath = createTestScript('pattern-match.js',
        'console.log(JSON.stringify({ blocked: false, output: "file-tool" }));'
      );

      const config: HooksConfig = {
        pre_tool_use: [
          {
            command: `node "${scriptPath}"`,
            matcher: { toolPattern: '^(Read|Write|Edit)$' },
          },
        ],
      };
      const executor = new HookExecutor(config, defaultContext);

      // Should match file tools
      const result1 = await executor.trigger('pre_tool_use', { tool: 'Read' });
      expect(result1.output).toBe('file-tool');

      const result2 = await executor.trigger('pre_tool_use', { tool: 'Write' });
      expect(result2.output).toBe('file-tool');

      // Should not match Bash
      const result3 = await executor.trigger('pre_tool_use', { tool: 'Bash' });
      expect(result3.output).toBeUndefined();
    });
  });

  describe('hook execution', () => {
    it('should return blocked:false when no hooks registered', async () => {
      const executor = new HookExecutor({}, defaultContext);
      const result = await executor.trigger('session_start', {});
      expect(result.blocked).toBe(false);
    });

    it('should parse JSON output from hook', async () => {
      const scriptPath = createTestScript('json-output.js',
        'console.log(JSON.stringify({ blocked: false, output: "hello" }));'
      );

      const config: HooksConfig = {
        session_start: [{ command: `node "${scriptPath}"` }],
      };
      const executor = new HookExecutor(config, defaultContext);

      const result = await executor.trigger('session_start', {});
      expect(result.blocked).toBe(false);
      expect(result.output).toBe('hello');
    });

    it('should handle blocking hooks', async () => {
      const scriptPath = createTestScript('blocking.js',
        'console.log(JSON.stringify({ blocked: true, output: "blocked by hook" }));'
      );

      const config: HooksConfig = {
        pre_tool_use: [{ command: `node "${scriptPath}"` }],
      };
      const executor = new HookExecutor(config, defaultContext);

      const result = await executor.trigger('pre_tool_use', { tool: 'Bash' });
      expect(result.blocked).toBe(true);
      expect(result.output).toBe('blocked by hook');
    });

    it('should handle modified message from hook', async () => {
      const scriptPath = createTestScript('modified-message.js',
        'console.log(JSON.stringify({ blocked: false, modifiedMessage: "modified prompt" }));'
      );

      const config: HooksConfig = {
        user_prompt_submit: [{ command: `node "${scriptPath}"` }],
      };
      const executor = new HookExecutor(config, defaultContext);

      const result = await executor.trigger('user_prompt_submit', { message: 'original' });
      expect(result.blocked).toBe(false);
      expect(result.modifiedMessage).toBe('modified prompt');
    });

    it('should handle modified params from hook', async () => {
      const scriptPath = createTestScript('modified-params.js',
        'console.log(JSON.stringify({ blocked: false, modifiedParams: { file: "/new/path" } }));'
      );

      const config: HooksConfig = {
        pre_tool_use: [{ command: `node "${scriptPath}"` }],
      };
      const executor = new HookExecutor(config, defaultContext);

      const result = await executor.trigger('pre_tool_use', {
        tool: 'Read',
        params: { file: '/old/path' },
      });
      expect(result.blocked).toBe(false);
      expect(result.modifiedParams).toEqual({ file: '/new/path' });
    });

    it('should treat non-JSON output as plain text output', async () => {
      const scriptPath = createTestScript('plain-text.js',
        'console.log("plain text output");'
      );

      const config: HooksConfig = {
        session_start: [{ command: `node "${scriptPath}"` }],
      };
      const executor = new HookExecutor(config, defaultContext);

      const result = await executor.trigger('session_start', {});
      expect(result.blocked).toBe(false);
      expect(result.output?.trim()).toBe('plain text output');
    });

    it('should fail open on hook error (non-zero exit)', async () => {
      const scriptPath = createTestScript('exit-error.js',
        'process.exit(1);'
      );

      const config: HooksConfig = {
        session_start: [{ command: `node "${scriptPath}"` }],
      };
      const executor = new HookExecutor(config, defaultContext);

      const result = await executor.trigger('session_start', {});
      expect(result.blocked).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('exited with code 1');
    });

    it('should fail open on hook timeout', async () => {
      const scriptPath = createTestScript('timeout.js',
        'setTimeout(() => {}, 5000);'
      );

      const config: HooksConfig = {
        session_start: [
          {
            command: `node "${scriptPath}"`,
            timeout: 100, // Very short timeout
          },
        ],
      };
      const executor = new HookExecutor(config, defaultContext);

      const result = await executor.trigger('session_start', {});
      expect(result.blocked).toBe(false);
      expect(result.error).toContain('timed out');
    }, 10000); // Longer test timeout

    it('should fail open on command not found', async () => {
      const config: HooksConfig = {
        session_start: [{ command: 'nonexistent-command-12345' }],
      };
      const executor = new HookExecutor(config, defaultContext);

      const result = await executor.trigger('session_start', {});
      expect(result.blocked).toBe(false);
      // Error could be from spawn or from shell - just check it didn't block
    });
  });

  describe('multiple hooks', () => {
    it('should run hooks in sequence', async () => {
      const script1 = createTestScript('first.js',
        'console.log(JSON.stringify({ blocked: false, output: "first" }));'
      );
      const script2 = createTestScript('second.js',
        'console.log(JSON.stringify({ blocked: false, output: "second" }));'
      );

      const config: HooksConfig = {
        session_start: [
          { command: `node "${script1}"` },
          { command: `node "${script2}"` },
        ],
      };
      const executor = new HookExecutor(config, defaultContext);

      const result = await executor.trigger('session_start', {});
      expect(result.blocked).toBe(false);
      expect(result.output).toBe('firstsecond');
    });

    it('should stop on first blocking hook', async () => {
      const script1 = createTestScript('blocker.js',
        'console.log(JSON.stringify({ blocked: true, output: "blocked" }));'
      );
      const script2 = createTestScript('not-run.js',
        'console.log(JSON.stringify({ blocked: false, output: "should not run" }));'
      );

      const config: HooksConfig = {
        session_start: [
          { command: `node "${script1}"` },
          { command: `node "${script2}"` },
        ],
      };
      const executor = new HookExecutor(config, defaultContext);

      const result = await executor.trigger('session_start', {});
      expect(result.blocked).toBe(true);
      expect(result.output).toBe('blocked');
    });

    it('should pass modified values to subsequent hooks', async () => {
      const script1 = createTestScript('step1.js',
        'console.log(JSON.stringify({ blocked: false, modifiedMessage: "step1" }));'
      );
      const script2 = createTestScript('step2.js', `let data = '';
process.stdin.on('data', (chunk) => { data += chunk; });
process.stdin.on('end', () => {
  const input = JSON.parse(data);
  console.log(JSON.stringify({ blocked: false, modifiedMessage: input.message + '-step2' }));
});`);

      const config: HooksConfig = {
        user_prompt_submit: [
          { command: `node "${script1}"` },
          { command: `node "${script2}"` },
        ],
      };
      const executor = new HookExecutor(config, defaultContext);

      const result = await executor.trigger('user_prompt_submit', { message: 'original' });
      expect(result.modifiedMessage).toBe('step1-step2');
    });
  });

  describe('createHookExecutor factory', () => {
    it('should create executor using factory function', () => {
      const config: HooksConfig = {
        session_start: [{ command: 'echo test' }],
      };
      const executor = createHookExecutor(config, defaultContext);

      expect(executor).toBeInstanceOf(HookExecutor);
      expect(executor.hasHooks('session_start')).toBe(true);
    });
  });
});
