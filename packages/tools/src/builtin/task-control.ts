/**
 * Task Control Tools
 *
 * TaskOutput - Get output from background tasks
 * TaskStop - Stop running background tasks
 */

import { BaseTool } from '../base.js';
import type { ToolResult, ExecutionContext, ToolParameters } from '../types.js';

/**
 * In-memory store for background task outputs
 * In a real implementation, this would be shared with the Task tool
 */
const taskOutputs = new Map<string, {
  output: string;
  status: 'running' | 'completed' | 'failed' | 'stopped';
  startTime: number;
  endTime?: number;
}>();

/**
 * In-memory store for background task abort controllers
 */
const taskControllers = new Map<string, AbortController>();

/**
 * Register a task's abort controller (called by Task tool)
 */
export function registerTaskController(taskId: string, controller: AbortController): void {
  taskControllers.set(taskId, controller);
  taskOutputs.set(taskId, {
    output: '',
    status: 'running',
    startTime: Date.now(),
  });
}

/**
 * Update task output (called by Task tool)
 */
export function updateTaskOutput(
  taskId: string,
  output: string,
  status: 'running' | 'completed' | 'failed' | 'stopped'
): void {
  const existing = taskOutputs.get(taskId);
  taskOutputs.set(taskId, {
    output,
    status,
    startTime: existing?.startTime || Date.now(),
    endTime: status !== 'running' ? Date.now() : undefined,
  });

  // Clean up controller when done
  if (status !== 'running') {
    taskControllers.delete(taskId);
  }
}

/**
 * TaskOutputTool - Get output from background tasks
 */
export class TaskOutputTool extends BaseTool {
  readonly name = 'TaskOutput';
  readonly description = `Get output from a running or completed background task.

Use this to:
- Check on progress of background tasks
- Retrieve results when tasks complete
- Monitor long-running operations

Modes:
- block=true (default): Wait for task to complete
- block=false: Return current status immediately`;

  readonly parameters: ToolParameters = {
    type: 'object',
    properties: {
      task_id: {
        type: 'string',
        description: 'The task ID to get output from',
      },
      block: {
        type: 'boolean',
        description: 'Whether to wait for completion (default: true)',
        default: true,
      },
      timeout: {
        type: 'number',
        description: 'Max wait time in milliseconds (default: 30000)',
        default: 30000,
        minimum: 0,
        maximum: 600000,
      },
    },
    required: ['task_id'],
  };

  async execute(
    params: Record<string, unknown>,
    context: ExecutionContext
  ): Promise<ToolResult> {
    return this.safeExecute(params, context, async () => {
      const taskId = params.task_id as string;
      const block = params.block !== false; // Default true
      const timeout = (params.timeout as number) || 30000;

      // Check if task exists
      const taskData = taskOutputs.get(taskId);

      if (!taskData) {
        return this.failure(
          `Task "${taskId}" not found. It may have expired or never existed.`
        );
      }

      // If not blocking or already completed, return immediately
      if (!block || taskData.status !== 'running') {
        return this.formatTaskResult(taskId, taskData);
      }

      // Wait for completion with timeout
      const startWait = Date.now();
      const checkInterval = 500; // Check every 500ms

      while (Date.now() - startWait < timeout) {
        // Check abort signal
        if (context.signal?.aborted) {
          return this.failure('Operation was cancelled');
        }

        const currentData = taskOutputs.get(taskId);
        if (!currentData) {
          return this.failure(`Task "${taskId}" was removed while waiting`);
        }

        if (currentData.status !== 'running') {
          return this.formatTaskResult(taskId, currentData);
        }

        // Wait before next check
        await new Promise(resolve => setTimeout(resolve, checkInterval));
      }

      // Timeout reached
      const finalData = taskOutputs.get(taskId);
      if (finalData) {
        return this.success(
          `Task "${taskId}" is still running after ${timeout}ms timeout.\n\n` +
          `Current output:\n${finalData.output || '(no output yet)'}`,
          {
            taskId,
            status: 'running',
            timedOut: true,
          }
        );
      }

      return this.failure(`Task "${taskId}" disappeared during wait`);
    });
  }

  private formatTaskResult(
    taskId: string,
    data: { output: string; status: string; startTime: number; endTime?: number }
  ): ToolResult {
    const duration = data.endTime
      ? `${((data.endTime - data.startTime) / 1000).toFixed(1)}s`
      : `${((Date.now() - data.startTime) / 1000).toFixed(1)}s (running)`;

    const statusIcon = {
      running: '🔄',
      completed: '✅',
      failed: '❌',
      stopped: '⏹️',
    }[data.status] || '❓';

    return this.success(
      `Task: ${taskId}\n` +
      `Status: ${statusIcon} ${data.status}\n` +
      `Duration: ${duration}\n\n` +
      `Output:\n${data.output || '(no output)'}`,
      {
        taskId,
        status: data.status,
        duration: data.endTime ? data.endTime - data.startTime : undefined,
      }
    );
  }
}

/**
 * TaskStopTool - Stop running background tasks
 */
export class TaskStopTool extends BaseTool {
  readonly name = 'TaskStop';
  readonly description = `Stop a running background task.

Use this to:
- Cancel long-running operations
- Stop tasks that are no longer needed
- Clean up resources`;

  readonly parameters: ToolParameters = {
    type: 'object',
    properties: {
      task_id: {
        type: 'string',
        description: 'The ID of the background task to stop',
      },
    },
    required: ['task_id'],
  };

  async execute(
    params: Record<string, unknown>,
    context: ExecutionContext
  ): Promise<ToolResult> {
    return this.safeExecute(params, context, async () => {
      const taskId = params.task_id as string;

      // Check if task exists
      const taskData = taskOutputs.get(taskId);

      if (!taskData) {
        return this.failure(
          `Task "${taskId}" not found. It may have already completed or never existed.`
        );
      }

      // Check if already stopped
      if (taskData.status !== 'running') {
        return this.success(
          `Task "${taskId}" is already ${taskData.status} (not running).`,
          { taskId, status: taskData.status, alreadyStopped: true }
        );
      }

      // Get the abort controller
      const controller = taskControllers.get(taskId);

      if (controller) {
        // Abort the task
        controller.abort();
        taskControllers.delete(taskId);

        // Update status
        updateTaskOutput(taskId, taskData.output + '\n[Task stopped by user]', 'stopped');

        return this.success(
          `Task "${taskId}" has been stopped.`,
          { taskId, status: 'stopped' }
        );
      }

      // No controller found, but task exists - mark as stopped
      updateTaskOutput(taskId, taskData.output + '\n[Task stopped]', 'stopped');

      return this.success(
        `Task "${taskId}" marked as stopped (no active controller found).`,
        { taskId, status: 'stopped' }
      );
    });
  }
}
