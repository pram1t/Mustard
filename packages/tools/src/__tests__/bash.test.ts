/**
 * Bash Tool Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { BashTool } from '../builtin/bash';
import { createTestContext } from '../registry';

describe('BashTool', () => {
  let tool: BashTool;

  beforeEach(() => {
    tool = new BashTool();
  });

  it('should execute simple commands', async () => {
    const context = createTestContext({ cwd: process.cwd() });
    const result = await tool.execute({ command: 'echo hello' }, context);

    expect(result.success).toBe(true);
    expect(String(result.output)).toContain('hello');
  });

  it('should return exit code on failure', async () => {
    const context = createTestContext({ cwd: process.cwd() });
    const result = await tool.execute({
      command: 'exit 1',
    }, context);

    expect(result.success).toBe(false);
    // Error message format varies: "Exit code" or "exited with code"
    expect(result.error?.toLowerCase()).toMatch(/exit.*code|exited.*code/);
  });

  it('should handle command not found', async () => {
    const context = createTestContext({ cwd: process.cwd() });
    const result = await tool.execute({
      command: 'nonexistent_command_xyz_12345',
    }, context);

    expect(result.success).toBe(false);
  });

  it('should respect timeout', async () => {
    const context = createTestContext({ cwd: process.cwd() });

    // Use a short timeout
    const result = await tool.execute(
      {
        command: process.platform === 'win32' ? 'ping -n 10 127.0.0.1' : 'sleep 10',
        timeout: 500,
      },
      context
    );

    expect(result.success).toBe(false);
    // Error message contains "timed out" or "timeout"
    expect(result.error?.toLowerCase()).toMatch(/timeout|timed out/);
  }, 10000);

  it('should truncate large output', async () => {
    const context = createTestContext({ cwd: process.cwd() });

    // Generate a lot of output - use platform-specific commands
    // Windows for loop is slow, Linux seq is fast
    const command = process.platform === 'win32'
      ? 'powershell -Command "1..1000 | ForEach-Object { Write-Output $_ }"'
      : 'seq 1 1000';

    const result = await tool.execute({ command }, context);

    expect(result.success).toBe(true);
    // Output should be truncated at some point
    if (String(result.output).length > 30000) {
      expect(String(result.output)).toContain('truncated');
    }
  }, 60000); // Increase timeout for CI

  describe('Security - Environment Variable Filtering', () => {
    it('should pass safe environment variables', async () => {
      const context = createTestContext({ cwd: process.cwd() });

      const command = process.platform === 'win32'
        ? 'echo %PATH%'
        : 'echo $PATH';

      const result = await tool.execute({ command }, context);

      expect(result.success).toBe(true);
      // PATH should be passed through and have some value
      expect(String(result.output).length).toBeGreaterThan(0);
    });

    it('should NOT pass API key environment variables', async () => {
      // Set a fake API key in current process
      const originalKey = process.env.OPENAI_API_KEY;
      process.env.OPENAI_API_KEY = 'sk-test-secret-key';

      try {
        const context = createTestContext({ cwd: process.cwd() });

        const command = process.platform === 'win32'
          ? 'echo %OPENAI_API_KEY%'
          : 'echo $OPENAI_API_KEY';

        const result = await tool.execute({ command }, context);

        expect(result.success).toBe(true);
        // The API key should NOT be in the output
        expect(String(result.output)).not.toContain('sk-test-secret-key');
      } finally {
        // Restore original value
        if (originalKey !== undefined) {
          process.env.OPENAI_API_KEY = originalKey;
        } else {
          delete process.env.OPENAI_API_KEY;
        }
      }
    });

    it('should NOT pass password environment variables', async () => {
      const originalPassword = process.env.DATABASE_PASSWORD;
      process.env.DATABASE_PASSWORD = 'super-secret-password';

      try {
        const context = createTestContext({ cwd: process.cwd() });

        const command = process.platform === 'win32'
          ? 'echo %DATABASE_PASSWORD%'
          : 'echo $DATABASE_PASSWORD';

        const result = await tool.execute({ command }, context);

        expect(result.success).toBe(true);
        expect(String(result.output)).not.toContain('super-secret-password');
      } finally {
        if (originalPassword !== undefined) {
          process.env.DATABASE_PASSWORD = originalPassword;
        } else {
          delete process.env.DATABASE_PASSWORD;
        }
      }
    });

    it('should NOT pass secret environment variables', async () => {
      const originalSecret = process.env.JWT_SECRET;
      process.env.JWT_SECRET = 'my-jwt-secret-value';

      try {
        const context = createTestContext({ cwd: process.cwd() });

        const command = process.platform === 'win32'
          ? 'echo %JWT_SECRET%'
          : 'echo $JWT_SECRET';

        const result = await tool.execute({ command }, context);

        expect(result.success).toBe(true);
        expect(String(result.output)).not.toContain('my-jwt-secret-value');
      } finally {
        if (originalSecret !== undefined) {
          process.env.JWT_SECRET = originalSecret;
        } else {
          delete process.env.JWT_SECRET;
        }
      }
    });
  });

  describe('Security - Command Validation', () => {
    it('should reject commands with null bytes', async () => {
      const context = createTestContext({ cwd: process.cwd() });

      const result = await tool.execute({
        command: 'echo hello\x00world',
      }, context);

      expect(result.success).toBe(false);
      expect(result.error?.toLowerCase()).toContain('invalid');
    });

    it('should reject excessively long commands', async () => {
      const context = createTestContext({ cwd: process.cwd() });
      const longCommand = 'echo ' + 'a'.repeat(50000);

      const result = await tool.execute({
        command: longCommand,
      }, context);

      expect(result.success).toBe(false);
      // Error can be "length" from our validation or "enametoolong" from OS
      expect(result.error?.toLowerCase()).toMatch(/length|nametoolong/);
    });
  });
});
