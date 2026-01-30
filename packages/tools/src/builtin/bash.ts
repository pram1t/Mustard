/**
 * Bash Tool
 *
 * Executes shell commands with support for:
 * - Timeout configuration
 * - Working directory
 * - Output truncation
 * - Background execution
 */

import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import { BaseTool } from '../base.js';
import type { ToolResult, ExecutionContext, ToolParameters } from '../types.js';
import { getConfig } from '@openagent/config';
import { filterEnvVars } from '@openagent/logger';
import { validateCommand } from '../security.js';

// Maximum timeout: 10 minutes (hard limit)
const MAX_TIMEOUT = 600000;

// Maximum number of background processes allowed
const MAX_BACKGROUND_PROCESSES = 100;

// Background process timeout: 1 hour
const PROCESS_TIMEOUT_MS = 3600000;

/**
 * Entry in the background processes map with timestamp for cleanup
 */
interface BackgroundProcessEntry {
  process: ChildProcess;
  startedAt: number;
}

// Background processes map with timestamps
const backgroundProcesses = new Map<string, BackgroundProcessEntry>();

/**
 * Clean up stale background processes.
 * Removes entries that are older than timeout or have killed processes.
 */
function cleanupStaleProcesses(): void {
  const now = Date.now();
  for (const [taskId, entry] of backgroundProcesses) {
    if (now - entry.startedAt > PROCESS_TIMEOUT_MS || entry.process.killed) {
      backgroundProcesses.delete(taskId);
    }
  }
}

/**
 * Generate a unique task ID
 */
function generateTaskId(): string {
  return `task_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * BashTool - Executes shell commands
 */
export class BashTool extends BaseTool {
  readonly name = 'Bash';
  readonly description = 'Executes shell commands in a bash shell. Use for system operations, git commands, package management, etc.';
  readonly parameters: ToolParameters = {
    type: 'object',
    properties: {
      command: {
        type: 'string',
        description: 'The command to execute',
      },
      timeout: {
        type: 'number',
        description: 'Optional timeout in milliseconds (max 600000, default 120000)',
      },
      cwd: {
        type: 'string',
        description: 'Optional working directory for the command',
      },
      run_in_background: {
        type: 'boolean',
        description: 'Run the command in the background and return a task ID',
        default: false,
      },
    },
    required: ['command'],
  };

  async execute(
    params: Record<string, unknown>,
    context: ExecutionContext
  ): Promise<ToolResult> {
    return this.safeExecute(params, context, async () => {
      const config = getConfig();
      const bashConfig = config.tools.bash;

      const command = params.command as string;

      // Validate command before execution
      validateCommand(command);

      const defaultTimeout = bashConfig.maxTimeout;
      const timeout = Math.min(
        (params.timeout as number) || defaultTimeout,
        MAX_TIMEOUT
      );
      const runInBackground = (params.run_in_background as boolean) || false;
      const maxOutputSize = bashConfig.maxOutputSize;

      // Resolve working directory
      const cwd = params.cwd
        ? path.isAbsolute(params.cwd as string)
          ? params.cwd as string
          : path.resolve(context.cwd, params.cwd as string)
        : context.cwd;

      // Determine the shell based on platform
      const isWindows = process.platform === 'win32';
      const shell = isWindows ? 'cmd.exe' : '/bin/bash';
      const shellArgs = isWindows ? ['/c', command] : ['-c', command];

      if (runInBackground) {
        return this.executeInBackground(shell, shellArgs, cwd);
      }

      return this.executeSync(shell, shellArgs, cwd, timeout, maxOutputSize, context.signal);
    });
  }

  /**
   * Execute command synchronously with timeout
   */
  private async executeSync(
    shell: string,
    args: string[],
    cwd: string,
    timeout: number,
    maxOutputSize: number,
    signal?: AbortSignal
  ): Promise<ToolResult> {
    return new Promise((resolve) => {
      let stdout = '';
      let stderr = '';
      let killed = false;

      // Use filtered environment variables to prevent secret leakage
      const safeEnv = filterEnvVars();

      const child = spawn(shell, args, {
        cwd,
        env: safeEnv,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      // Set up timeout
      const timeoutId = setTimeout(() => {
        killed = true;
        child.kill('SIGKILL');
      }, timeout);

      // Handle abort signal
      if (signal) {
        signal.addEventListener('abort', () => {
          killed = true;
          child.kill('SIGKILL');
        }, { once: true });
      }

      // Collect stdout
      child.stdout?.on('data', (data: Buffer) => {
        stdout += data.toString();
        // Truncate if too large
        if (stdout.length > maxOutputSize * 2) {
          stdout = stdout.substring(0, maxOutputSize * 2);
        }
      });

      // Collect stderr
      child.stderr?.on('data', (data: Buffer) => {
        stderr += data.toString();
        // Truncate if too large
        if (stderr.length > maxOutputSize * 2) {
          stderr = stderr.substring(0, maxOutputSize * 2);
        }
      });

      // Handle process completion
      child.on('close', (code) => {
        clearTimeout(timeoutId);

        // Combine output
        let output = stdout;
        if (stderr) {
          output += (output ? '\n' : '') + stderr;
        }

        // Truncate final output if needed
        let truncated = false;
        if (output.length > maxOutputSize) {
          output = output.substring(0, maxOutputSize) + '\n...[output truncated]';
          truncated = true;
        }

        if (killed) {
          resolve(this.failure(
            `Command timed out after ${timeout}ms`,
            output
          ));
          return;
        }

        const exitCode = code ?? 0;
        const success = exitCode === 0;

        resolve({
          success,
          output: output || (success ? '(no output)' : ''),
          error: success ? undefined : `Command exited with code ${exitCode}`,
          metadata: {
            exitCode,
            truncated,
            tokensUsed: this.estimateTokens(output),
          },
        });
      });

      // Handle spawn errors
      child.on('error', (error) => {
        clearTimeout(timeoutId);
        resolve(this.failure(`Failed to execute command: ${error.message}`));
      });
    });
  }

  /**
   * Execute command in background
   */
  private executeInBackground(
    shell: string,
    args: string[],
    cwd: string
  ): ToolResult {
    // Check if we've hit the process limit
    if (backgroundProcesses.size >= MAX_BACKGROUND_PROCESSES) {
      cleanupStaleProcesses();
      if (backgroundProcesses.size >= MAX_BACKGROUND_PROCESSES) {
        return this.failure(
          `Too many background processes running (max: ${MAX_BACKGROUND_PROCESSES}). ` +
          'Wait for some to complete or kill existing processes.'
        );
      }
    }

    const taskId = generateTaskId();

    // Use filtered environment variables to prevent secret leakage
    const safeEnv = filterEnvVars();

    const child = spawn(shell, args, {
      cwd,
      env: safeEnv,
      stdio: ['pipe', 'pipe', 'pipe'],
      detached: true,
    });

    backgroundProcesses.set(taskId, {
      process: child,
      startedAt: Date.now(),
    });

    // Clean up when process exits
    child.on('close', () => {
      backgroundProcesses.delete(taskId);
    });

    return this.success(
      `Command started in background with task ID: ${taskId}`,
      {
        taskId,
        pid: child.pid,
      }
    );
  }

  /**
   * Get a background process by task ID (static method for external use)
   */
  static getBackgroundProcess(taskId: string): ChildProcess | undefined {
    const entry = backgroundProcesses.get(taskId);
    return entry?.process;
  }

  /**
   * Kill a background process by task ID
   */
  static killBackgroundProcess(taskId: string): boolean {
    const entry = backgroundProcesses.get(taskId);
    if (entry) {
      entry.process.kill('SIGKILL');
      backgroundProcesses.delete(taskId);
      return true;
    }
    return false;
  }

  /**
   * Get the number of active background processes
   */
  static getBackgroundProcessCount(): number {
    cleanupStaleProcesses();
    return backgroundProcesses.size;
  }
}
