/**
 * TestRunnerTool
 *
 * Run tests with structured output and auto-framework detection.
 * Beyond Claude Code - provides parsed test results.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { BaseTool } from '../base.js';
import type { ToolResult, ExecutionContext, ToolParameters } from '../types.js';
import { validateCommand } from '../security.js';

const execAsync = promisify(exec);

/**
 * Test framework configuration
 */
interface FrameworkConfig {
  readonly name: string;
  readonly detectFiles: readonly string[];
  readonly command: string;
  readonly jsonFlag?: string;
}

export interface TestError {
  test: string;
  message: string;
  file?: string;
  line?: number;
}

export interface TestResults {
  passed: number;
  failed: number;
  skipped: number;
  errors: TestError[];
}

const FRAMEWORKS: Record<string, FrameworkConfig> = {
  vitest: {
    name: 'Vitest',
    detectFiles: ['vitest.config.ts', 'vitest.config.js', 'vitest.config.mts'],
    command: 'npx vitest run',
    jsonFlag: '--reporter=json',
  },
  jest: {
    name: 'Jest',
    detectFiles: ['jest.config.js', 'jest.config.ts', 'jest.config.json'],
    command: 'npx jest',
    jsonFlag: '--json',
  },
  mocha: {
    name: 'Mocha',
    detectFiles: ['.mocharc.js', '.mocharc.json', '.mocharc.yml'],
    command: 'npx mocha',
    jsonFlag: '--reporter json',
  },
  pytest: {
    name: 'Pytest',
    detectFiles: ['pytest.ini', 'pyproject.toml', 'setup.cfg'],
    command: 'pytest',
    jsonFlag: '--json-report',
  },
};

/**
 * Detect test framework in project
 */
async function detectFramework(cwd: string): Promise<string | null> {
  // Check package.json for test script hints
  try {
    const pkgPath = path.join(cwd, 'package.json');
    const pkgContent = await fs.readFile(pkgPath, 'utf-8');
    const pkg = JSON.parse(pkgContent);

    // Check dependencies
    if (pkg.devDependencies?.vitest || pkg.dependencies?.vitest) {
      return 'vitest';
    }
    if (pkg.devDependencies?.jest || pkg.dependencies?.jest) {
      return 'jest';
    }
    if (pkg.devDependencies?.mocha || pkg.dependencies?.mocha) {
      return 'mocha';
    }

    // Check test script
    const testScript = (pkg.scripts?.test as string) || '';
    if (testScript.includes('vitest')) return 'vitest';
    if (testScript.includes('jest')) return 'jest';
    if (testScript.includes('mocha')) return 'mocha';
  } catch {
    // No package.json
  }

  // Check for config files
  for (const [framework, config] of Object.entries(FRAMEWORKS)) {
    for (const file of config.detectFiles) {
      try {
        await fs.access(path.join(cwd, file));
        return framework;
      } catch {
        // File doesn't exist
      }
    }
  }

  // Check for Python pytest
  try {
    await fs.access(path.join(cwd, 'pytest.ini'));
    return 'pytest';
  } catch {
    // Check pyproject.toml for pytest
    try {
      const pyproject = await fs.readFile(path.join(cwd, 'pyproject.toml'), 'utf-8');
      if (pyproject.includes('[tool.pytest]')) {
        return 'pytest';
      }
    } catch {
      // No pyproject.toml
    }
  }

  return null;
}

/**
 * Escape a string for use as a shell argument.
 */
function shellEscape(str: string): string {
  // Simple shell escape for POSIX-style shells
  // Wraps in single quotes and handles internal single quotes
  return "'" + str.replace(/'/g, "'\\''") + "'";
}

/**
 * Parse test output to extract results
 */
export function parseTestOutput(output: string, _framework: string): TestResults {
  const result: TestResults = {
    passed: 0,
    failed: 0,
    skipped: 0,
    errors: [],
  };

  // Generic patterns for pass/fail/skip counts.
  // We prefer more specific summary patterns over line-by-line counts.
  const summaryPatterns = {
    passed: [
      /Tests:\s*(\d+)\s*passed/i,
      /(\d+)\s+passed/i,
    ],
    failed: [
      /Tests:\s*(\d+)\s*failed/i,
      /(\d+)\s+failed/i,
    ],
    skipped: [
      /Tests:\s*(\d+)\s*skipped/i,
      /(\d+)\s+skipped/i,
    ],
  };

  for (const [key, regexes] of Object.entries(summaryPatterns)) {
    for (const regex of regexes) {
      // Find the LAST occurrence which is usually the summary
      const matches = [...output.matchAll(new RegExp(regex, 'gi'))];
      if (matches.length > 0) {
        const lastMatch = matches[matches.length - 1];
        result[key as keyof Omit<TestResults, 'errors'>] = parseInt(lastMatch[1], 10);
        break;
      }
    }
  }

  // Extract error messages from failure blocks
  const failureBlocks = output.match(/(?:FAIL|✗|FAILED|________________)[\s\S]*?(?=(?:PASS|✓|PASSED|Test Suites:|________________|$))/gi) || [];

  for (const block of failureBlocks) {
    // 1. Try to find test name
    // Jest/Vitest style: ● Name
    // Pytest style: ________________ Name ________________
    // Generic: FAIL Name
    let testName = '';
    const nameMatch = block.match(/●\s+(.+)/i) ||
                      block.match(/_{2,}\s+(.+?)\s+_{2,}/i) ||
                      block.match(/(?:FAIL|✗|FAILED)\s+(.+)/i);

    if (nameMatch) {
      testName = nameMatch[1].trim();
    }

    if (!testName || testName.match(/\.(js|ts|jsx|tsx|py)$/)) {
      // If testName is a filename, try to look deeper into the block for the actual test name
      const subNameMatch = block.match(/●\s+(.+)/i);
      if (subNameMatch) {
        testName = subNameMatch[1].trim();
      }
    }

    // 2. Try to find error message
    const messageMatch = block.match(/(?:Error|AssertionError|Expected|Message|E {7}):?[\s\S]*?(?:\n\s*\n|\n\s*at\s+|$)/i);

    // 3. Try to find file and line
    const fileMatch = block.match(/at\s+.+?\s+\((.+?):(\d+)/) ||
                      block.match(/at\s+(.+?):(\d+)/) ||
                      block.match(/^(.+?):(\d+): AssertionError/m);

    if (testName && testName !== '________________') {
      result.errors.push({
        test: testName,
        message: messageMatch ? messageMatch[0].trim() : 'Test failed',
        file: fileMatch ? fileMatch[1] : undefined,
        line: fileMatch ? parseInt(fileMatch[2], 10) : undefined,
      });
    }
  }

  // Fallback for Pytest summary style failures
  if (result.failed > 0 && result.errors.length === 0) {
    const pytestSummaryFailures = output.match(/FAILED\s+(.+?)\s+-\s+(.+)/g);
    if (pytestSummaryFailures) {
      for (const line of pytestSummaryFailures) {
        const m = line.match(/FAILED\s+(.+?)\s+-\s+(.+)/);
        if (m) {
          result.errors.push({
            test: m[1].trim(),
            message: m[2].trim(),
          });
        }
      }
    }
  }

  // Ultimate fallback
  if (result.failed > 0 && result.errors.length === 0) {
    result.errors.push({
      test: 'Unknown Test',
      message: 'One or more tests failed, but details could not be parsed. See full output below.',
    });
  }

  return result;
}

/**
 * TestRunnerTool - Run tests with structured output
 */
export class TestRunnerTool extends BaseTool {
  readonly name = 'TestRunner';
  readonly description = `Run tests with auto-framework detection and structured results.

Supported frameworks:
- **Vitest**: Auto-detected by vitest.config.ts
- **Jest**: Auto-detected by jest.config.js
- **Mocha**: Auto-detected by .mocharc.js
- **Pytest**: Auto-detected by pytest.ini

Features:
- Auto-detects test framework
- Parses output for pass/fail counts
- Extracts error messages with file:line references
- Supports running specific test patterns`;

  readonly parameters: ToolParameters = {
    type: 'object',
    properties: {
      framework: {
        type: 'string',
        description: 'Test framework. Use "auto" (default) to auto-detect.',
        enum: ['auto', 'vitest', 'jest', 'mocha', 'pytest'],
        default: 'auto',
      },
      pattern: {
        type: 'string',
        description: 'Test file pattern or specific test to run (e.g., "*.spec.ts" or "should handle errors")',
      },
      watch: {
        type: 'boolean',
        description: 'Run in watch mode (default: false)',
        default: false,
      },
    },
    required: [],
  };

  async execute(
    params: Record<string, unknown>,
    context: ExecutionContext
  ): Promise<ToolResult> {
    return this.safeExecute(params, context, async (): Promise<ToolResult> => {
      let framework = (params.framework as string) || 'auto';
      const pattern = params.pattern as string | undefined;
      const watch = params.watch as boolean;

      // Auto-detect framework
      if (framework === 'auto') {
        const detected = await detectFramework(context.cwd);
        if (!detected) {
          return this.failure(
            'Could not auto-detect test framework.\n' +
            'Supported: vitest, jest, mocha, pytest.\n' +
            'Specify explicitly with framework parameter.'
          );
        }
        framework = detected;
      }

      const config = FRAMEWORKS[framework];
      if (!config) {
        return this.failure(`Unknown framework: ${framework}`);
      }

      // Build command
      let command = config.command;

      if (pattern) {
        // Add pattern to command with shell escaping
        const escapedPattern = shellEscape(pattern);
        if (framework === 'vitest' || framework === 'jest') {
          command += ` ${escapedPattern}`;
        } else if (framework === 'mocha') {
          command += ` --grep ${escapedPattern}`;
        } else if (framework === 'pytest') {
          command += ` -k ${escapedPattern}`;
        }
      }

      if (watch) {
        if (framework === 'vitest') {
          command = command.replace('vitest run', 'vitest');
        } else if (framework === 'jest') {
          command += ' --watch';
        } else if (framework === 'mocha') {
          command += ' --watch';
        } else if (framework === 'pytest') {
          return this.failure('Pytest does not support watch mode natively.');
        }

        return this.success(
          `Watch mode command: ${command}\n\n` +
          `Run this in your terminal for interactive test watching.`,
          { framework, command, watch: true }
        );
      }

      // Security validation of the final command
      try {
        validateCommand(command);
      } catch (error) {
        return this.failure((error as Error).message);
      }

      // Run tests
      try {
        const { stdout, stderr } = await execAsync(command, {
          cwd: context.cwd,
          maxBuffer: 20 * 1024 * 1024, // 20MB
          timeout: 5 * 60 * 1000, // 5 minutes
        });

        const output = stdout + stderr;
        const results = parseTestOutput(output, framework);

        return this.formatResults(results, config.name, output, framework);
      } catch (error: unknown) {
        // Tests may "fail" with non-zero exit but still produce useful output
        const execError = error as { stdout?: string; stderr?: string; message?: string };
        const output = (execError.stdout || '') + (execError.stderr || '');

        if (output) {
          const results = parseTestOutput(output, framework);
          return this.formatResults(results, config.name, output, framework, 1);
        }

        return this.failure(`Test execution failed: ${execError.message || error}`);
      }
    });
  }

  private formatResults(
    results: TestResults,
    frameworkName: string,
    output: string,
    framework: string,
    exitCode = 0
  ): ToolResult {
    let summary = `${frameworkName} Test Results:\n\n`;
    summary += `✅ Passed: ${results.passed}\n`;
    summary += `❌ Failed: ${results.failed}\n`;
    summary += `⏭️ Skipped: ${results.skipped}\n`;

    if (results.errors.length > 0) {
      summary += `\nErrors:\n`;
      for (const error of results.errors) {
        summary += `\n- **${error.test}**\n`;
        if (error.file && error.line) {
          summary += `  at ${error.file}:${error.line}\n`;
        }
        summary += `  ${error.message.substring(0, 200)}${error.message.length > 200 ? '...' : ''}\n`;
      }
    }

    summary += `\n---\nFull output:\n\`\`\`\n${output.substring(0, 5000)}${output.length > 5000 ? '\n...(truncated)' : ''}\n\`\`\``;

    return this.success(summary, {
      framework,
      exitCode,
      ...results,
    });
  }
}
