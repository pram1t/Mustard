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

const execAsync = promisify(exec);

/**
 * Test framework configuration
 */
interface FrameworkConfig {
  name: string;
  detectFiles: string[];
  command: string;
  jsonFlag?: string;
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
    const testScript = pkg.scripts?.test || '';
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
 * Parse test output to extract results
 */
function parseTestOutput(output: string, framework: string): {
  passed: number;
  failed: number;
  skipped: number;
  errors: Array<{ test: string; message: string; file?: string; line?: number }>;
} {
  const result = {
    passed: 0,
    failed: 0,
    skipped: 0,
    errors: [] as Array<{ test: string; message: string; file?: string; line?: number }>,
  };

  // Generic patterns
  const passedMatch = output.match(/(\d+)\s+(?:pass(?:ed|ing)?|✓)/i);
  const failedMatch = output.match(/(\d+)\s+(?:fail(?:ed|ing)?|✗)/i);
  const skippedMatch = output.match(/(\d+)\s+(?:skip(?:ped)?|pending)/i);

  if (passedMatch) result.passed = parseInt(passedMatch[1], 10);
  if (failedMatch) result.failed = parseInt(failedMatch[1], 10);
  if (skippedMatch) result.skipped = parseInt(skippedMatch[1], 10);

  // Extract error messages
  const errorPatterns = [
    // Jest/Vitest
    /FAIL\s+(.+?)\n[\s\S]*?●\s+(.+?)\n\n([\s\S]*?)(?=\n\n|$)/g,
    // Generic assertion errors
    /(?:AssertionError|Error):\s*(.+?)(?:\n|$)/g,
    // File:line references
    /at\s+.+?\s+\((.+?):(\d+):\d+\)/g,
  ];

  // Try to extract specific errors
  const failureBlocks = output.match(/(?:FAIL|✗|FAILED)[\s\S]*?(?=(?:PASS|✓|PASSED|$))/gi) || [];

  for (const block of failureBlocks) {
    const testMatch = block.match(/(?:FAIL|✗|FAILED)\s+(.+)/i);
    const messageMatch = block.match(/(?:Error|AssertionError|Expected)[\s\S]*?(?:\n\n|$)/i);
    const fileMatch = block.match(/at\s+.+?\s+\((.+?):(\d+)/);

    if (testMatch) {
      result.errors.push({
        test: testMatch[1].trim(),
        message: messageMatch ? messageMatch[0].trim() : 'Test failed',
        file: fileMatch ? fileMatch[1] : undefined,
        line: fileMatch ? parseInt(fileMatch[2], 10) : undefined,
      });
    }
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
    return this.safeExecute(params, context, async () => {
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
        // Add pattern to command
        if (framework === 'vitest' || framework === 'jest') {
          command += ` "${pattern}"`;
        } else if (framework === 'mocha') {
          command += ` --grep "${pattern}"`;
        } else if (framework === 'pytest') {
          command += ` -k "${pattern}"`;
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

      // Run tests
      try {
        const { stdout, stderr } = await execAsync(command, {
          cwd: context.cwd,
          maxBuffer: 20 * 1024 * 1024, // 20MB
          timeout: 5 * 60 * 1000, // 5 minutes
        });

        const output = stdout + stderr;
        const results = parseTestOutput(output, framework);

        let summary = `${config.name} Test Results:\n\n`;
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
          ...results,
        });
      } catch (error: unknown) {
        // Tests may "fail" with non-zero exit but still produce useful output
        const execError = error as { stdout?: string; stderr?: string; message?: string };
        const output = (execError.stdout || '') + (execError.stderr || '');

        if (output) {
          const results = parseTestOutput(output, framework);

          let summary = `${config.name} Tests Failed:\n\n`;
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
            }
          }

          summary += `\n---\nFull output:\n\`\`\`\n${output.substring(0, 5000)}${output.length > 5000 ? '\n...(truncated)' : ''}\n\`\`\``;

          return this.success(summary, {
            framework,
            exitCode: 1,
            ...results,
          });
        }

        return this.failure(`Test execution failed: ${execError.message || error}`);
      }
    });
  }
}
