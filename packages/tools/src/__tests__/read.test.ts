/**
 * Read Tool Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { ReadTool } from '../builtin/read';
import { createTestContext } from '../registry';

describe('ReadTool', () => {
  let testDir: string;
  let tool: ReadTool;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'read-test-'));
    tool = new ReadTool();
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('should read a file with line numbers', async () => {
    const filePath = path.join(testDir, 'test.txt');
    await fs.writeFile(filePath, 'Line 1\nLine 2\nLine 3');

    const context = createTestContext({ cwd: testDir });
    const result = await tool.execute({ file_path: filePath }, context);

    expect(result.success).toBe(true);
    expect(String(result.output)).toContain('Line 1');
    expect(String(result.output)).toContain('1\t');
  });

  it('should handle offset and limit', async () => {
    const filePath = path.join(testDir, 'test.txt');
    await fs.writeFile(filePath, 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5');

    const context = createTestContext({ cwd: testDir });
    const result = await tool.execute(
      { file_path: filePath, offset: 2, limit: 2 },
      context
    );

    expect(result.success).toBe(true);
    const output = String(result.output);
    expect(output).toContain('Line 2');
    expect(output).toContain('Line 3');
    expect(output).not.toContain('Line 1');
    expect(output).not.toContain('Line 4');
  });

  it('should return error for non-existent file', async () => {
    const context = createTestContext({ cwd: testDir });
    const result = await tool.execute(
      { file_path: path.join(testDir, 'nonexistent.txt') },
      context
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('should handle empty files', async () => {
    const filePath = path.join(testDir, 'empty.txt');
    await fs.writeFile(filePath, '');

    const context = createTestContext({ cwd: testDir });
    const result = await tool.execute({ file_path: filePath }, context);

    expect(result.success).toBe(true);
    expect(String(result.output)).toContain('Empty file');
  });

  it('should detect binary files by extension', async () => {
    const filePath = path.join(testDir, 'test.png');
    await fs.writeFile(filePath, Buffer.from([0x89, 0x50, 0x4e, 0x47]));

    const context = createTestContext({ cwd: testDir });
    const result = await tool.execute({ file_path: filePath }, context);

    expect(result.success).toBe(true);
    expect(String(result.output)).toContain('Image file');
  });

  it('should return error for directories', async () => {
    const context = createTestContext({ cwd: testDir });
    const result = await tool.execute({ file_path: testDir }, context);

    expect(result.success).toBe(false);
    expect(result.error).toContain('directory');
  });
});
