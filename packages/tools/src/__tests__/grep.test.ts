/**
 * Grep Tool Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { GrepTool } from '../builtin/grep';
import { createTestContext } from '../registry';

describe('GrepTool', () => {
  let testDir: string;
  let tool: GrepTool;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'grep-test-'));
    tool = new GrepTool();

    // Create test files
    await fs.writeFile(
      path.join(testDir, 'app.ts'),
      'const app = "hello world";\nfunction test() {\n  return "hello";\n}\n'
    );
    await fs.writeFile(
      path.join(testDir, 'utils.ts'),
      'export function hello() {\n  console.log("hello");\n}\n'
    );
    await fs.writeFile(
      path.join(testDir, 'config.json'),
      '{"name": "test", "version": "1.0.0"}\n'
    );
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('should find matching lines with files_with_matches mode', async () => {
    const context = createTestContext({ cwd: testDir });
    const result = await tool.execute({
      pattern: 'hello',
      output_mode: 'files_with_matches',
    }, context);

    expect(result.success).toBe(true);
    const output = String(result.output);
    expect(output).toContain('app.ts');
    expect(output).toContain('utils.ts');
    expect(output).not.toContain('config.json');
  });

  it('should show content with content mode', async () => {
    const context = createTestContext({ cwd: testDir });
    const result = await tool.execute({
      pattern: 'hello',
      output_mode: 'content',
    }, context);

    expect(result.success).toBe(true);
    const output = String(result.output);
    expect(output).toContain('hello world');
    expect(output).toContain('console.log');
  });

  it('should count matches with count mode', async () => {
    const context = createTestContext({ cwd: testDir });
    const result = await tool.execute({
      pattern: 'hello',
      output_mode: 'count',
    }, context);

    expect(result.success).toBe(true);
    const output = String(result.output);
    // app.ts has 2 matches, utils.ts has 2 matches
    expect(output).toContain(':');
  });

  it('should support case insensitive search', async () => {
    await fs.writeFile(path.join(testDir, 'mixed.ts'), 'HELLO Hello hello');

    const context = createTestContext({ cwd: testDir });
    const result = await tool.execute({
      pattern: 'HELLO',
      '-i': true,
      output_mode: 'content',
    }, context);

    expect(result.success).toBe(true);
    expect(String(result.output)).toContain('mixed.ts');
  });

  it('should support glob filtering', async () => {
    const context = createTestContext({ cwd: testDir });
    const result = await tool.execute({
      pattern: 'hello',
      glob: '*.ts',
      output_mode: 'files_with_matches',
    }, context);

    expect(result.success).toBe(true);
    const output = String(result.output);
    expect(output).toContain('.ts');
    expect(output).not.toContain('.json');
  });

  it('should search in specific file', async () => {
    const context = createTestContext({ cwd: testDir });
    const result = await tool.execute({
      pattern: 'hello',
      path: path.join(testDir, 'app.ts'),
      output_mode: 'content',
    }, context);

    expect(result.success).toBe(true);
    const output = String(result.output);
    expect(output).toContain('hello world');
    expect(output).not.toContain('console.log');
  });

  it('should return error for invalid regex', async () => {
    const context = createTestContext({ cwd: testDir });
    const result = await tool.execute({
      pattern: '[invalid',
    }, context);

    expect(result.success).toBe(false);
    expect(result.error).toContain('regex');
  });

  it('should return no matches message when pattern not found', async () => {
    const context = createTestContext({ cwd: testDir });
    const result = await tool.execute({
      pattern: 'xyz_not_found_pattern',
    }, context);

    expect(result.success).toBe(true);
    expect(String(result.output)).toContain('No matches');
  });

  it('should support context lines', async () => {
    await fs.writeFile(
      path.join(testDir, 'context.ts'),
      'line1\nline2\nMATCH\nline4\nline5\n'
    );

    const context = createTestContext({ cwd: testDir });
    const result = await tool.execute({
      pattern: 'MATCH',
      path: path.join(testDir, 'context.ts'),
      output_mode: 'content',
      '-B': 1,
      '-A': 1,
    }, context);

    expect(result.success).toBe(true);
    const output = String(result.output);
    expect(output).toContain('line2');
    expect(output).toContain('MATCH');
    expect(output).toContain('line4');
  });

  describe('Security - ReDoS Protection', () => {
    it('should reject patterns that may cause catastrophic backtracking', async () => {
      const context = createTestContext({ cwd: testDir });

      // This pattern can cause ReDoS: (a+)+b
      const result = await tool.execute({
        pattern: '(a+)+b',
      }, context);

      expect(result.success).toBe(false);
      expect(result.error?.toLowerCase()).toContain('unsafe');
    });

    it('should reject excessively long patterns', async () => {
      const context = createTestContext({ cwd: testDir });
      const longPattern = 'a'.repeat(1500);

      const result = await tool.execute({
        pattern: longPattern,
      }, context);

      expect(result.success).toBe(false);
      expect(result.error?.toLowerCase()).toContain('length');
    });
  });
});
