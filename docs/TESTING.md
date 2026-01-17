# Testing Guide

This document describes the testing setup and conventions for the OpenAgent project.

## Overview

OpenAgent uses [Vitest](https://vitest.dev/) as the testing framework. Vitest provides a fast, ESM-native test runner with excellent TypeScript support.

## Quick Start

```bash
# Run all tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

## Test Structure

Tests are organized alongside the source code in `__tests__` directories:

```
packages/
├── llm/
│   └── src/
│       ├── __tests__/
│       │   ├── mocks.ts        # Mock utilities
│       │   └── router.test.ts  # Router tests
│       └── ...
├── logger/
│   └── src/
│       ├── __tests__/
│       │   └── logger.test.ts  # Logger tests
│       └── ...
├── tools/
│   └── src/
│       ├── __tests__/
│       │   ├── read.test.ts    # ReadTool tests
│       │   ├── write.test.ts   # WriteTool tests
│       │   ├── edit.test.ts    # EditTool tests
│       │   └── registry.test.ts # Registry tests
│       └── ...
└── test-utils/
    └── src/
        └── index.ts            # Shared test utilities
```

## Configuration

The Vitest configuration is in `vitest.config.ts`:

```typescript
export default defineConfig({
  test: {
    globals: true,              // Enable global test functions
    environment: 'node',        // Node.js environment
    include: ['packages/**/src/**/*.test.ts', 'packages/**/src/__tests__/**/*.test.ts'],
    exclude: ['**/node_modules/**', 'dist', 'build', '**/mocks.ts'],
    coverage: {
      provider: 'v8',
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 70,
        statements: 80,
      },
    },
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
```

## Writing Tests

### Test File Naming

- Test files should be named `*.test.ts`
- Place tests in `__tests__` directories next to the source files

### Basic Test Structure

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('MyFeature', () => {
  beforeEach(() => {
    // Setup before each test
  });

  afterEach(() => {
    // Cleanup after each test
  });

  it('should do something', () => {
    expect(true).toBe(true);
  });
});
```

### Using Mocks

The `@openagent/llm` package provides mock utilities:

```typescript
import { MockLLMProvider } from '../__tests__/mocks';

const mockProvider = new MockLLMProvider();

// Queue a response
mockProvider.queueResponse({
  content: 'Hello, world!',
});

// Queue an error
mockProvider.queueError(new Error('Test error'));

// Get call history
const history = mockProvider.getCallHistory();
```

### Testing Tools

Use `createTestContext` to create execution contexts:

```typescript
import { createTestContext } from '../registry';

const context = createTestContext({
  cwd: '/custom/path',  // Optional override
});
```

### Async Testing

```typescript
it('should handle async operations', async () => {
  const result = await someAsyncFunction();
  expect(result).toBe(expected);
});

// Testing async generators
it('should stream responses', async () => {
  const chunks: string[] = [];
  for await (const chunk of router.chat(params)) {
    if (chunk.type === 'text') {
      chunks.push(chunk.content);
    }
  }
  expect(chunks.join('')).toBe('Expected output');
});
```

### File System Tests

For tests that need file system access, create temporary directories:

```typescript
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

let testDir: string;

beforeEach(async () => {
  testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'test-'));
});

afterEach(async () => {
  await fs.rm(testDir, { recursive: true, force: true });
});
```

## Test Utilities Package

The `@openagent/test-utils` package provides common utilities:

```typescript
import {
  createTestDir,
  cleanupTestDir,
  createTestFile,
  readTestFile,
  delay,
  measureTime,
  withEnv,
  createTestContext,
} from '@openagent/test-utils';
```

### Available Utilities

| Function | Description |
|----------|-------------|
| `createTestDir(prefix?)` | Create a temporary test directory |
| `cleanupTestDir(dir)` | Remove a test directory |
| `createTestFile(dir, name, content)` | Create a test file |
| `readTestFile(path)` | Read a test file |
| `delay(ms)` | Wait for specified milliseconds |
| `measureTime(fn)` | Measure execution time |
| `withEnv(env, fn)` | Run function with temporary env vars |
| `createTestContext(overrides?)` | Create tool execution context |

## Current Test Coverage

### Logger Package (11 tests)

| Test Suite | Tests | Description |
|------------|-------|-------------|
| Logger | 11 | Logger creation, levels, child loggers |

### LLM Package (17 tests)

| Test Suite | Tests | Description |
|------------|-------|-------------|
| LLMRouter | 17 | Router functionality, fallback, retry |

### Tools Package (30 tests)

| Test Suite | Tests | Description |
|------------|-------|-------------|
| ReadTool | 6 | File reading, offsets, binary detection |
| WriteTool | 4 | File creation, overwrite, directories |
| EditTool | 6 | String replacement, uniqueness, delete |
| ToolRegistry | 14 | Registration, execution, defaults |

**Total: 58 tests**

## Running Specific Tests

```bash
# Run tests in a specific file
npx vitest run packages/llm/src/__tests__/router.test.ts

# Run tests matching a pattern
npx vitest run -t "should stream"

# Run tests in a specific package
npx vitest run packages/tools
```

## Coverage Reports

After running `npm run test:coverage`, coverage reports are generated in:

- `coverage/` - HTML report (open `index.html` in browser)
- Console output - Summary table

### Coverage Thresholds

The project enforces minimum coverage thresholds:

- **Lines**: 80%
- **Functions**: 80%
- **Branches**: 70%
- **Statements**: 80%

## Best Practices

1. **Isolate Tests**: Each test should be independent and not rely on other tests
2. **Clean Up**: Always clean up resources (files, connections) in `afterEach`
3. **Descriptive Names**: Use clear, descriptive test names
4. **Test Edge Cases**: Include tests for error conditions and edge cases
5. **Mock External Dependencies**: Use mocks for network calls and external services
6. **Keep Tests Fast**: Avoid unnecessary delays or large data sets
7. **Test Public API**: Focus on testing public interfaces, not implementation details

## Adding New Tests

1. Create a test file in the appropriate `__tests__` directory
2. Name it `{feature}.test.ts`
3. Import from `vitest` and the module being tested
4. Write tests following the patterns above
5. Run `npm run test` to verify
6. Check coverage with `npm run test:coverage`
