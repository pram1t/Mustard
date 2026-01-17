/**
 * Tool System Test File
 *
 * Tests all built-in tools and the tool registry.
 * Run with: npx tsx src/test.ts
 */

import * as path from 'path';
import * as fs from 'fs/promises';
import { ToolRegistry, createDefaultRegistry, createTestContext } from './registry';
import { ReadTool } from './builtin/read';
import { WriteTool } from './builtin/write';
import { EditTool } from './builtin/edit';
import { GlobTool } from './builtin/glob';
import { GrepTool } from './builtin/grep';
import { BashTool } from './builtin/bash';

// ============================================================================
// Test Utilities
// ============================================================================

const TEST_DIR = path.join(process.cwd(), '.test-tools');

async function setupTestDir(): Promise<void> {
  await fs.mkdir(TEST_DIR, { recursive: true });
}

async function cleanupTestDir(): Promise<void> {
  try {
    await fs.rm(TEST_DIR, { recursive: true, force: true });
  } catch {
    // Ignore errors
  }
}

// ============================================================================
// Tests
// ============================================================================

async function testReadTool(): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('TEST: Read Tool');
  console.log('='.repeat(60));

  const tool = new ReadTool();
  const context = createTestContext({ cwd: TEST_DIR });

  // Create a test file
  const testFile = path.join(TEST_DIR, 'test-read.txt');
  const content = 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5';
  await fs.writeFile(testFile, content);

  // Test basic read
  console.log('\n1a. Basic read:');
  const result1 = await tool.execute({ file_path: testFile }, context);
  console.log(`   Success: ${result1.success}`);
  console.log(`   Output preview: ${String(result1.output).substring(0, 100)}...`);

  // Test with offset and limit
  console.log('\n1b. Read with offset and limit:');
  const result2 = await tool.execute(
    { file_path: testFile, offset: 2, limit: 2 },
    context
  );
  console.log(`   Success: ${result2.success}`);
  console.log(`   Output:\n${result2.output}`);

  // Test non-existent file
  console.log('\n1c. Non-existent file:');
  const result3 = await tool.execute(
    { file_path: path.join(TEST_DIR, 'nonexistent.txt') },
    context
  );
  console.log(`   Success: ${result3.success}`);
  console.log(`   Error: ${result3.error}`);

  console.log('\n✓ Read tool tests completed');
}

async function testWriteTool(): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('TEST: Write Tool');
  console.log('='.repeat(60));

  const tool = new WriteTool();
  const context = createTestContext({ cwd: TEST_DIR });

  // Test basic write
  console.log('\n2a. Basic write:');
  const testFile = path.join(TEST_DIR, 'test-write.txt');
  const result1 = await tool.execute(
    { file_path: testFile, content: 'Hello, World!' },
    context
  );
  console.log(`   Success: ${result1.success}`);
  console.log(`   Output: ${result1.output}`);

  // Verify file was created
  const written = await fs.readFile(testFile, 'utf-8');
  console.log(`   Content: ${written}`);

  // Test write with directory creation
  console.log('\n2b. Write with directory creation:');
  const nestedFile = path.join(TEST_DIR, 'subdir', 'nested', 'test.txt');
  const result2 = await tool.execute(
    { file_path: nestedFile, content: 'Nested file content' },
    context
  );
  console.log(`   Success: ${result2.success}`);
  console.log(`   Output: ${result2.output}`);

  console.log('\n✓ Write tool tests completed');
}

async function testEditTool(): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('TEST: Edit Tool');
  console.log('='.repeat(60));

  const tool = new EditTool();
  const context = createTestContext({ cwd: TEST_DIR });

  // Create a test file
  const testFile = path.join(TEST_DIR, 'test-edit.txt');
  await fs.writeFile(testFile, 'Hello, World!\nThis is a test.\nGoodbye!');

  // Test basic replacement
  console.log('\n3a. Basic replacement:');
  const result1 = await tool.execute(
    { file_path: testFile, old_string: 'World', new_string: 'Universe' },
    context
  );
  console.log(`   Success: ${result1.success}`);
  console.log(`   Output: ${result1.output}`);

  // Verify change
  const content1 = await fs.readFile(testFile, 'utf-8');
  console.log(`   Content: ${content1.replace(/\n/g, '\\n')}`);

  // Test non-unique string error
  console.log('\n3b. Non-unique string (should fail):');
  await fs.writeFile(testFile, 'foo bar foo baz foo');
  const result2 = await tool.execute(
    { file_path: testFile, old_string: 'foo', new_string: 'qux' },
    context
  );
  console.log(`   Success: ${result2.success}`);
  console.log(`   Error: ${result2.error}`);

  // Test replace_all
  console.log('\n3c. Replace all occurrences:');
  const result3 = await tool.execute(
    { file_path: testFile, old_string: 'foo', new_string: 'qux', replace_all: true },
    context
  );
  console.log(`   Success: ${result3.success}`);
  console.log(`   Output: ${result3.output}`);

  // Verify change
  const content3 = await fs.readFile(testFile, 'utf-8');
  console.log(`   Content: ${content3}`);

  console.log('\n✓ Edit tool tests completed');
}

async function testGlobTool(): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('TEST: Glob Tool');
  console.log('='.repeat(60));

  const tool = new GlobTool();
  const context = createTestContext({ cwd: TEST_DIR });

  // Create test files
  await fs.writeFile(path.join(TEST_DIR, 'file1.ts'), 'content');
  await fs.writeFile(path.join(TEST_DIR, 'file2.ts'), 'content');
  await fs.writeFile(path.join(TEST_DIR, 'file3.js'), 'content');
  await fs.mkdir(path.join(TEST_DIR, 'src'), { recursive: true });
  await fs.writeFile(path.join(TEST_DIR, 'src', 'index.ts'), 'content');

  // Test glob pattern
  console.log('\n4a. Glob **/*.ts:');
  const result1 = await tool.execute(
    { pattern: '**/*.ts', path: TEST_DIR },
    context
  );
  console.log(`   Success: ${result1.success}`);
  console.log(`   Output:\n${result1.output}`);

  // Test specific pattern
  console.log('\n4b. Glob *.js:');
  const result2 = await tool.execute(
    { pattern: '*.js', path: TEST_DIR },
    context
  );
  console.log(`   Success: ${result2.success}`);
  console.log(`   Output:\n${result2.output}`);

  console.log('\n✓ Glob tool tests completed');
}

async function testGrepTool(): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('TEST: Grep Tool');
  console.log('='.repeat(60));

  const tool = new GrepTool();
  const context = createTestContext({ cwd: TEST_DIR });

  // Create test files
  await fs.writeFile(
    path.join(TEST_DIR, 'search1.txt'),
    'This is a test file.\nIt contains the word HELLO.\nAnd more text.'
  );
  await fs.writeFile(
    path.join(TEST_DIR, 'search2.txt'),
    'Another file here.\nNo special words.\nJust regular content.'
  );
  await fs.writeFile(
    path.join(TEST_DIR, 'search3.txt'),
    'Hello World!\nHello Universe!\nHello Everyone!'
  );

  // Test basic search
  console.log('\n5a. Basic search:');
  const result1 = await tool.execute(
    { pattern: 'HELLO', path: TEST_DIR },
    context
  );
  console.log(`   Success: ${result1.success}`);
  console.log(`   Output:\n${result1.output}`);

  // Test case insensitive search
  console.log('\n5b. Case insensitive search:');
  const result2 = await tool.execute(
    { pattern: 'hello', path: TEST_DIR, '-i': true },
    context
  );
  console.log(`   Success: ${result2.success}`);
  console.log(`   Output:\n${result2.output}`);

  // Test content mode
  console.log('\n5c. Content mode:');
  const result3 = await tool.execute(
    { pattern: 'Hello', path: TEST_DIR, output_mode: 'content' },
    context
  );
  console.log(`   Success: ${result3.success}`);
  console.log(`   Output:\n${result3.output}`);

  console.log('\n✓ Grep tool tests completed');
}

async function testBashTool(): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('TEST: Bash Tool');
  console.log('='.repeat(60));

  const tool = new BashTool();
  const context = createTestContext({ cwd: TEST_DIR });

  // Test simple command
  console.log('\n6a. Simple command (echo):');
  const result1 = await tool.execute(
    { command: 'echo "Hello from bash!"' },
    context
  );
  console.log(`   Success: ${result1.success}`);
  console.log(`   Output: ${result1.output}`);

  // Test command with exit code
  console.log('\n6b. Command listing directory:');
  const result2 = await tool.execute(
    { command: process.platform === 'win32' ? 'dir' : 'ls -la' },
    context
  );
  console.log(`   Success: ${result2.success}`);
  console.log(`   Output preview: ${String(result2.output).substring(0, 200)}...`);

  // Test failing command
  console.log('\n6c. Failing command:');
  const result3 = await tool.execute(
    { command: 'exit 1' },
    context
  );
  console.log(`   Success: ${result3.success}`);
  console.log(`   Exit code: ${result3.metadata?.exitCode}`);

  console.log('\n✓ Bash tool tests completed');
}

async function testRegistry(): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('TEST: Tool Registry');
  console.log('='.repeat(60));

  // Test default registry
  console.log('\n7a. Default registry:');
  const registry = createDefaultRegistry();
  console.log(`   Registered tools: ${registry.getNames().join(', ')}`);
  console.log(`   Tool count: ${registry.count}`);

  // Test execute via registry
  console.log('\n7b. Execute via registry:');
  const context = createTestContext({ cwd: TEST_DIR });
  const testFile = path.join(TEST_DIR, 'registry-test.txt');
  await fs.writeFile(testFile, 'Registry test content');

  const result = await registry.execute(
    'Read',
    { file_path: testFile },
    context
  );
  console.log(`   Success: ${result.success}`);
  console.log(`   Output preview: ${String(result.output).substring(0, 50)}...`);

  // Test unknown tool
  console.log('\n7c. Unknown tool:');
  const unknownResult = await registry.execute('UnknownTool', {}, context);
  console.log(`   Success: ${unknownResult.success}`);
  console.log(`   Error: ${unknownResult.error}`);

  console.log('\n✓ Registry tests completed');
}

// ============================================================================
// Run All Tests
// ============================================================================

async function runAllTests(): Promise<void> {
  console.log('OpenAgent Tool System Tests');
  console.log('===========================\n');

  try {
    await setupTestDir();

    await testReadTool();
    await testWriteTool();
    await testEditTool();
    await testGlobTool();
    await testGrepTool();
    await testBashTool();
    await testRegistry();

    console.log('\n' + '='.repeat(60));
    console.log('All tests completed successfully!');
    console.log('='.repeat(60) + '\n');
  } catch (error) {
    console.error('\n\nTest failed with error:', error);
    process.exit(1);
  } finally {
    await cleanupTestDir();
  }
}

// Run tests
runAllTests();
