/**
 * Shell Control Tools
 *
 * KillShell - Kill background shell processes
 */

import { BaseTool } from '../base.js';
import type { ToolResult, ExecutionContext, ToolParameters } from '../types.js';
import type { ChildProcess } from 'child_process';

/**
 * Store for background shell processes
 * This would be shared with the Bash tool in a real implementation
 */
const shellProcesses = new Map<string, {
  process: ChildProcess;
  command: string;
  startTime: number;
}>();

/**
 * Register a shell process (called by Bash tool)
 */
export function registerShellProcess(
  shellId: string,
  process: ChildProcess,
  command: string
): void {
  shellProcesses.set(shellId, {
    process,
    command,
    startTime: Date.now(),
  });
}

/**
 * Unregister a shell process (called when process exits)
 */
export function unregisterShellProcess(shellId: string): void {
  shellProcesses.delete(shellId);
}

/**
 * Get all active shell processes
 */
export function getActiveShells(): Array<{
  id: string;
  command: string;
  pid?: number;
  runtime: number;
}> {
  const result: Array<{
    id: string;
    command: string;
    pid?: number;
    runtime: number;
  }> = [];

  for (const [id, data] of shellProcesses.entries()) {
    result.push({
      id,
      command: data.command,
      pid: data.process.pid,
      runtime: Date.now() - data.startTime,
    });
  }

  return result;
}

/**
 * KillShellTool - Kill background shell processes
 */
export class KillShellTool extends BaseTool {
  readonly name = 'KillShell';
  readonly description = `Kill a background shell process.

Use this to:
- Terminate long-running commands
- Stop processes that are no longer needed
- Clean up stuck operations

The shell_id is provided when starting a background bash command.`;

  readonly parameters: ToolParameters = {
    type: 'object',
    properties: {
      shell_id: {
        type: 'string',
        description: 'The ID of the shell process to kill',
      },
    },
    required: ['shell_id'],
  };

  async execute(
    params: Record<string, unknown>,
    context: ExecutionContext
  ): Promise<ToolResult> {
    return this.safeExecute(params, context, async () => {
      const shellId = params.shell_id as string;

      // Check if shell exists
      const shellData = shellProcesses.get(shellId);

      if (!shellData) {
        // List active shells for debugging
        const activeShells = getActiveShells();

        if (activeShells.length === 0) {
          return this.failure(
            `Shell "${shellId}" not found. No background shells are currently running.`
          );
        }

        return this.failure(
          `Shell "${shellId}" not found.\n\n` +
          `Active shells:\n` +
          activeShells.map(s =>
            `  - ${s.id}: "${s.command.substring(0, 50)}${s.command.length > 50 ? '...' : ''}" (PID: ${s.pid || 'unknown'})`
          ).join('\n')
        );
      }

      const { process, command, startTime } = shellData;
      const runtime = Date.now() - startTime;
      const pid = process.pid;

      try {
        // Try to kill the process
        if (pid) {
          // Kill the process and its children
          process.kill('SIGTERM');

          // Give it a moment to terminate gracefully
          await new Promise(resolve => setTimeout(resolve, 100));

          // Force kill if still running
          if (!process.killed) {
            process.kill('SIGKILL');
          }
        }

        // Remove from registry
        shellProcesses.delete(shellId);

        const commandPreview = command.length > 60
          ? command.substring(0, 60) + '...'
          : command;

        return this.success(
          `Shell "${shellId}" terminated.\n` +
          `Command: ${commandPreview}\n` +
          `PID: ${pid || 'unknown'}\n` +
          `Runtime: ${(runtime / 1000).toFixed(1)}s`,
          {
            shellId,
            pid,
            command: commandPreview,
            runtime,
          }
        );
      } catch (error) {
        // Still try to remove from registry
        shellProcesses.delete(shellId);

        return this.failure(
          `Failed to kill shell "${shellId}": ${error}\n` +
          `The shell has been removed from the registry.`
        );
      }
    });
  }
}

/**
 * ListShellsTool - List active background shells
 * Utility tool for debugging
 */
export class ListShellsTool extends BaseTool {
  readonly name = 'ListShells';
  readonly description = 'List all active background shell processes.';

  readonly parameters: ToolParameters = {
    type: 'object',
    properties: {},
    required: [],
  };

  async execute(
    params: Record<string, unknown>,
    context: ExecutionContext
  ): Promise<ToolResult> {
    return this.safeExecute(params, context, async () => {
      const shells = getActiveShells();

      if (shells.length === 0) {
        return this.success('No background shells are currently running.', {
          count: 0,
        });
      }

      let output = `Active background shells (${shells.length}):\n\n`;

      for (const shell of shells) {
        const commandPreview = shell.command.length > 50
          ? shell.command.substring(0, 50) + '...'
          : shell.command;

        output += `- **${shell.id}**\n`;
        output += `  Command: ${commandPreview}\n`;
        output += `  PID: ${shell.pid || 'unknown'}\n`;
        output += `  Runtime: ${(shell.runtime / 1000).toFixed(1)}s\n\n`;
      }

      return this.success(output, {
        count: shells.length,
        shells: shells.map(s => ({
          id: s.id,
          pid: s.pid,
          runtime: s.runtime,
        })),
      });
    });
  }
}
