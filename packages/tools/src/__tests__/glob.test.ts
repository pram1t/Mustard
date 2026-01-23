/**
 * Glob Tool Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { GlobTool } from '../builtin/glob';
import { createTestContext } from '../registry';

describe('GlobTool', () => {
  let testDir: string;
  let tool: GlobTool;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'glob-test-'));
    tool = new GlobTool();

    // Create test directory structure
    await fs.mkdir(path.join(testDir, 'src'), { recursive: true });
    await fs.mkdir(path.join(testDir, 'src', 'components'), { recursive: true });
    await fs.mkdir(path.join(testDir, 'tests'), { recursive: true });

    // Create test files
    await fs.writeFile(path.join(testDir, 'index.ts'), 'export {}');
    await fs.writeFile(path.join(testDir, 'src', 'app.ts'), 'const app = 1;');
    await fs.writeFile(path.join(testDir, 'src', 'utils.js'), 'const utils = 1;');
    await fs.writeFile(path.join(testDir, 'src', 'components', 'Button.tsx'), 'export const Button = () => null;');
    await fs.writeFile(path.join(testDir, 'tests', 'app.test.ts'), 'describe("app", () => {});');
    await fs.writeFile(path.join(testDir, 'README.md'), '# Test');
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('should find files matching simple pattern', async () => {
    const context = createTestContext({ cwd: testDir });
    const result = await tool.execute({ pattern: '*.ts' }, context);

    expect(result.success).toBe(true);
    expect(String(result.output)).toContain('index.ts');
  });

  it('should find files with ** pattern', async () => {
    const context = createTestContext({ cwd: testDir });
    const result = await tool.execute({ pattern: '**/*.ts' }, context);

    expect(result.success).toBe(true);
    const output = String(result.output);
    expect(output).toContain('index.ts');
    expect(output).toContain('app.ts');
    expect(output).toContain('app.test.ts');
  });

  it('should find tsx files with nested pattern', async () => {
    const context = createTestContext({ cwd: testDir });
    const result = await tool.execute({ pattern: 'src/**/*.tsx' }, context);

    expect(result.success).toBe(true);
    const output = String(result.output);
    expect(output).toContain('Button.tsx');
    expect(output).not.toContain('app.ts');
  });

  it('should return empty for non-matching pattern', async () => {
    const context = createTestContext({ cwd: testDir });
    const result = await tool.execute({ pattern: '**/*.py' }, context);

    expect(result.success).toBe(true);
    expect(String(result.output)).toContain('No files found');
  });

  it('should error for non-existent directory', async () => {
    const context = createTestContext({ cwd: testDir });
    const result = await tool.execute({
      pattern: '*.ts',
      path: '/nonexistent/directory',
    }, context);

    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('should search in specified subdirectory', async () => {
    const context = createTestContext({ cwd: testDir });
    const result = await tool.execute({
      pattern: '*.ts',
      path: 'src',
    }, context);

    expect(result.success).toBe(true);
    const output = String(result.output);
    expect(output).toContain('app.ts');
    expect(output).not.toContain('index.ts');
    expect(output).not.toContain('app.test.ts');
  });

  it('should ignore node_modules directory', async () => {
    // Create node_modules with a file
    await fs.mkdir(path.join(testDir, 'node_modules', 'pkg'), { recursive: true });
    await fs.writeFile(path.join(testDir, 'node_modules', 'pkg', 'index.ts'), 'export {}');

    const context = createTestContext({ cwd: testDir });
    const result = await tool.execute({ pattern: '**/*.ts' }, context);

    expect(result.success).toBe(true);
    expect(String(result.output)).not.toContain('node_modules');
  });

  it('should sort results by modification time', async () => {
    // Touch a file to make it newer
    await new Promise(resolve => setTimeout(resolve, 10));
    await fs.writeFile(path.join(testDir, 'src', 'app.ts'), 'updated');

    const context = createTestContext({ cwd: testDir });
    const result = await tool.execute({ pattern: '**/*.ts' }, context);

    expect(result.success).toBe(true);
    const output = String(result.output);
    const lines = output.split('\n').filter(line => line.trim());
    // Most recently modified should be first
    expect(lines[0]).toContain('app.ts');
  });
});
