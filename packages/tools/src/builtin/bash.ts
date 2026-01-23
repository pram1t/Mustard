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
import { getLogger } from '@openagent/logger';

// Maximum timeout: 10 minutes (hard limit)
const MAX_TIMEOUT = 600000;

// Background processes map
const backgroundProcesses = new Map<string, ChildProcess>();

/**
 * Default safe environment variables that are always allowed.
 * These are necessary for basic shell operation but don't contain secrets.
 */
const DEFAULT_SAFE_ENV_VARS = [
  // System paths and shell
  'PATH', 'HOME', 'USER', 'SHELL', 'TERM', 'PWD',
  // Locale settings
  'LANG', 'LC_ALL', 'LC_CTYPE', 'LC_MESSAGES', 'LANGUAGE',
  // Timezone
  'TZ',
  // Node.js environment (for npm/node commands)
  'NODE_ENV', 'NODE_PATH', 'NODE_OPTIONS',
  // npm configuration (safe subset)
  'npm_config_prefix', 'npm_config_registry',
  // Common development tools
  'EDITOR', 'VISUAL', 'PAGER',
  // Git (safe subset - no credentials)
  'GIT_AUTHOR_NAME', 'GIT_AUTHOR_EMAIL', 'GIT_COMMITTER_NAME', 'GIT_COMMITTER_EMAIL',
  // Windows-specific
  'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'TEMP', 'TMP', 'SYSTEMROOT', 'WINDIR',
  'HOMEDRIVE', 'HOMEPATH', 'COMPUTERNAME', 'USERNAME',
  // Unix-specific
  'TMPDIR', 'XDG_RUNTIME_DIR', 'XDG_CONFIG_HOME', 'XDG_DATA_HOME', 'XDG_CACHE_HOME',
];

/**
 * Environment variables that should NEVER be passed through.
 * These typically contain secrets or sensitive credentials.
 */
const BLOCKED_ENV_VARS = [
  // API keys and tokens
  'OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'GOOGLE_API_KEY', 'AZURE_API_KEY',
  'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_SESSION_TOKEN',
  'GITHUB_TOKEN', 'GITLAB_TOKEN', 'NPM_TOKEN', 'PYPI_TOKEN',
  // Database credentials
  'DATABASE_URL', 'DATABASE_PASSWORD', 'DB_PASSWORD', 'POSTGRES_PASSWORD',
  'MYSQL_PASSWORD', 'REDIS_PASSWORD', 'MONGODB_PASSWORD',
  // OAuth/Auth secrets
  'CLIENT_SECRET', 'JWT_SECRET', 'SESSION_SECRET', 'AUTH_SECRET',
  'COOKIE_SECRET', 'ENCRYPTION_KEY',
  // Cloud provider credentials
  'GOOGLE_APPLICATION_CREDENTIALS', 'AZURE_CLIENT_SECRET',
  // Private keys
  'PRIVATE_KEY', 'SSH_PRIVATE_KEY', 'SSL_KEY',
  // Generic patterns
  'API_KEY', 'SECRET', 'TOKEN', 'PASSWORD', 'CREDENTIAL',
];

/**
 * Filter environment variables to only include safe ones.
 * Never passes API keys, passwords, or other secrets to child processes.
 */
function filterEnvVars(allowedVars?: string[]): Record<string, string> {
  const config = getConfig();
  const configAllowedVars = config.tools.bash.allowedEnvVars || [];
  const logger = getLogger();

  // Combine default safe vars with config-specified vars
  const safeVars = new Set([
    ...DEFAULT_SAFE_ENV_VARS,
    ...configAllowedVars,
    ...(allowedVars || []),
  ]);

  const filteredEnv: Record<string, string> = {};

  for (const [key, value] of Object.entries(process.env)) {
    if (value === undefined) continue;

    // Check if explicitly blocked
    const isBlocked = BLOCKED_ENV_VARS.some((blocked) => {
      // Exact match or contains pattern
      return key === blocked || key.includes(blocked);
    });

    if (isBlocked) {
      logger.debug(`Blocked env var from bash: ${key}`, { envVar: key });
      continue;
    }

    // Check if in safe list
    if (safeVars.has(key)) {
      filteredEnv[key] = value;
    }
  }

  return filteredEnv;
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
    const taskId = generateTaskId();

    // Use filtered environment variables to prevent secret leakage
    const safeEnv = filterEnvVars();

    const child = spawn(shell, args, {
      cwd,
      env: safeEnv,
      stdio: ['pipe', 'pipe', 'pipe'],
      detached: true,
    });

    backgroundProcesses.set(taskId, child);

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
    return backgroundProcesses.get(taskId);
  }

  /**
   * Kill a background process by task ID
   */
  static killBackgroundProcess(taskId: string): boolean {
    const process = backgroundProcesses.get(taskId);
    if (process) {
      process.kill('SIGKILL');
      backgroundProcesses.delete(taskId);
      return true;
    }
    return false;
  }
}
