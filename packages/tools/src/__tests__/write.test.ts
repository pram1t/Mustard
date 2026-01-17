/**
 * Write Tool Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { WriteTool } from '../builtin/write';
import { createTestContext } from '../registry';

describe('WriteTool', () => {
  let testDir: string;
  let tool: WriteTool;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'write-test-'));
    tool = new WriteTool();
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('should create a new file', async () => {
    const filePath = path.join(testDir, 'new.txt');
    const context = createTestContext({ cwd: testDir });

    const result = await tool.execute(
      { file_path: filePath, content: 'Hello, World!' },
      context
    );

    expect(result.success).toBe(true);
    const content = await fs.readFile(filePath, 'utf-8');
    expect(content).toBe('Hello, World!');
  });

  it('should overwrite an existing file', async () => {
    const filePath = path.join(testDir, 'existing.txt');
    await fs.writeFile(filePath, 'Original content');

    const context = createTestContext({ cwd: testDir });
    const result = await tool.execute(
      { file_path: filePath, content: 'New content' },
      context
    );

    expect(result.success).toBe(true);
    const content = await fs.readFile(filePath, 'utf-8');
    expect(content).toBe('New content');
    expect(String(result.output)).toContain('Updated');
  });

  it('should create parent directories', async () => {
    const filePath = path.join(testDir, 'subdir', 'nested', 'file.txt');
    const context = createTestContext({ cwd: testDir });

    const result = await tool.execute(
      { file_path: filePath, content: 'Nested content' },
      context
    );

    expect(result.success).toBe(true);
    const content = await fs.readFile(filePath, 'utf-8');
    expect(content).toBe('Nested content');
  });

  it('should handle empty content', async () => {
    const filePath = path.join(testDir, 'empty.txt');
    const context = createTestContext({ cwd: testDir });

    const result = await tool.execute(
      { file_path: filePath, content: '' },
      context
    );

    expect(result.success).toBe(true);
    const content = await fs.readFile(filePath, 'utf-8');
    expect(content).toBe('');
  });
});
