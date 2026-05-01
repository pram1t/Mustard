/**
 * @pram1t/mustard-test-utils
 *
 * Testing utilities for OpenAgent packages.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

// ============================================================================
// Test Directory Utilities
// ============================================================================

/**
 * Create a temporary test directory
 */
export async function createTestDir(prefix = 'openagent-test'): Promise<string> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), `${prefix}-`));
  return tempDir;
}

/**
 * Clean up a test directory
 */
export async function cleanupTestDir(dir: string): Promise<void> {
  try {
    await fs.rm(dir, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }
}

/**
 * Create a test file with content
 */
export async function createTestFile(
  dir: string,
  filename: string,
  content: string
): Promise<string> {
  const filePath = path.join(dir, filename);
  const fileDir = path.dirname(filePath);
  await fs.mkdir(fileDir, { recursive: true });
  await fs.writeFile(filePath, content, 'utf-8');
  return filePath;
}

/**
 * Read a test file
 */
export async function readTestFile(filePath: string): Promise<string> {
  return fs.readFile(filePath, 'utf-8');
}

// ============================================================================
// Mock Utilities
// ============================================================================

/**
 * Mock LLM response for testing
 */
export interface MockLLMResponse {
  content: string;
  toolCalls?: Array<{
    id: string;
    name: string;
    arguments: Record<string, unknown>;
  }>;
  finishReason?: 'stop' | 'tool_calls' | 'length' | 'error';
}

/**
 * Create a mock streaming response generator
 */
export async function* createMockStreamResponse(
  response: MockLLMResponse
): AsyncGenerator<{
  type: 'content' | 'tool_call' | 'done';
  content?: string;
  toolCall?: { id: string; name: string; arguments: string };
  finishReason?: string;
}> {
  // Stream content word by word
  if (response.content) {
    const words = response.content.split(' ');
    for (const word of words) {
      yield { type: 'content', content: word + ' ' };
      await delay(10); // Small delay to simulate streaming
    }
  }

  // Yield tool calls
  if (response.toolCalls) {
    for (const toolCall of response.toolCalls) {
      yield {
        type: 'tool_call',
        toolCall: {
          id: toolCall.id,
          name: toolCall.name,
          arguments: JSON.stringify(toolCall.arguments),
        },
      };
    }
  }

  // Done
  yield {
    type: 'done',
    finishReason: response.finishReason || 'stop',
  };
}

// ============================================================================
// Assertion Utilities
// ============================================================================

/**
 * Assert that a function throws an error
 */
export async function assertThrows(
  fn: () => Promise<unknown>,
  errorType?: new (...args: unknown[]) => Error
): Promise<Error> {
  try {
    await fn();
    throw new Error('Expected function to throw');
  } catch (error) {
    if (errorType && !(error instanceof errorType)) {
      throw new Error(`Expected error of type ${errorType.name}`);
    }
    return error as Error;
  }
}

/**
 * Assert that a value is defined
 */
export function assertDefined<T>(value: T | undefined | null): asserts value is T {
  if (value === undefined || value === null) {
    throw new Error('Expected value to be defined');
  }
}

// ============================================================================
// Timing Utilities
// ============================================================================

/**
 * Delay execution
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Measure execution time
 */
export async function measureTime<T>(fn: () => Promise<T>): Promise<{ result: T; duration: number }> {
  const start = performance.now();
  const result = await fn();
  const duration = performance.now() - start;
  return { result, duration };
}

// ============================================================================
// Environment Utilities
// ============================================================================

/**
 * Temporarily set environment variables for a test
 */
export async function withEnv<T>(
  env: Record<string, string | undefined>,
  fn: () => Promise<T>
): Promise<T> {
  const originalEnv: Record<string, string | undefined> = {};

  // Save original values and set new ones
  for (const [key, value] of Object.entries(env)) {
    originalEnv[key] = process.env[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  try {
    return await fn();
  } finally {
    // Restore original values
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

// ============================================================================
// Tool Testing Utilities
// ============================================================================

/**
 * Create a test execution context
 */
export function createTestContext(overrides?: {
  cwd?: string;
  sessionId?: string;
  homeDir?: string;
  config?: Record<string, unknown>;
}): {
  cwd: string;
  sessionId: string;
  homeDir: string;
  config: Record<string, unknown>;
} {
  return {
    cwd: overrides?.cwd || process.cwd(),
    sessionId: overrides?.sessionId || `test-${Date.now()}`,
    homeDir: overrides?.homeDir || os.homedir(),
    config: overrides?.config || {},
  };
}
