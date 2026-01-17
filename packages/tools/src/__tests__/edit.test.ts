/**
 * Edit Tool Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { EditTool } from '../builtin/edit';
import { createTestContext } from '../registry';

describe('EditTool', () => {
  let testDir: string;
  let tool: EditTool;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'edit-test-'));
    tool = new EditTool();
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('should replace a unique string', async () => {
    const filePath = path.join(testDir, 'test.txt');
    await fs.writeFile(filePath, 'Hello, World!');

    const context = createTestContext({ cwd: testDir });
    const result = await tool.execute(
      { file_path: filePath, old_string: 'World', new_string: 'Universe' },
      context
    );

    expect(result.success).toBe(true);
    const content = await fs.readFile(filePath, 'utf-8');
    expect(content).toBe('Hello, Universe!');
  });

  it('should fail if string is not unique', async () => {
    const filePath = path.join(testDir, 'test.txt');
    await fs.writeFile(filePath, 'foo bar foo baz foo');

    const context = createTestContext({ cwd: testDir });
    const result = await tool.execute(
      { file_path: filePath, old_string: 'foo', new_string: 'qux' },
      context
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('3 times');
  });

  it('should replace all occurrences with replace_all', async () => {
    const filePath = path.join(testDir, 'test.txt');
    await fs.writeFile(filePath, 'foo bar foo baz foo');

    const context = createTestContext({ cwd: testDir });
    const result = await tool.execute(
      { file_path: filePath, old_string: 'foo', new_string: 'qux', replace_all: true },
      context
    );

    expect(result.success).toBe(true);
    const content = await fs.readFile(filePath, 'utf-8');
    expect(content).toBe('qux bar qux baz qux');
    expect(String(result.output)).toContain('3 occurrences');
  });

  it('should fail if string not found', async () => {
    const filePath = path.join(testDir, 'test.txt');
    await fs.writeFile(filePath, 'Hello, World!');

    const context = createTestContext({ cwd: testDir });
    const result = await tool.execute(
      { file_path: filePath, old_string: 'NotFound', new_string: 'Replace' },
      context
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('should handle deletion (empty new_string)', async () => {
    const filePath = path.join(testDir, 'test.txt');
    await fs.writeFile(filePath, 'Hello, World!');

    const context = createTestContext({ cwd: testDir });
    const result = await tool.execute(
      { file_path: filePath, old_string: ', World', new_string: '' },
      context
    );

    expect(result.success).toBe(true);
    const content = await fs.readFile(filePath, 'utf-8');
    expect(content).toBe('Hello!');
  });

  it('should fail for non-existent file', async () => {
    const context = createTestContext({ cwd: testDir });
    const result = await tool.execute(
      { file_path: path.join(testDir, 'nonexistent.txt'), old_string: 'foo', new_string: 'bar' },
      context
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });
});
