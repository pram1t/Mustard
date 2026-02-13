/**
 * OpenAgent V2 - Task Queue
 *
 * In-memory priority queue with dependency tracking and lifecycle management.
 */

import { randomUUID } from 'node:crypto';
import type { IMessageBus } from '@openagent/message-bus';
import type {
  ITaskQueue,
  QueueStats,
  QueueTask,
  TaskInput,
  TaskPriority,
  TaskStatus,
  PRIORITY_VALUES as PV,
} from './types.js';
import { PRIORITY_VALUES } from './types.js';

/**
 * In-memory priority task queue.
 * Tasks are dequeued by priority (critical > high > normal > low),
 * with FIFO ordering within the same priority level.
 * Tasks with unsatisfied dependencies are skipped.
 */
export class TaskQueue implements ITaskQueue {
  private tasks = new Map<string, QueueTask>();
  private bus?: IMessageBus;

  constructor(bus?: IMessageBus) {
    this.bus = bus;
  }

  /**
   * Add a task to the queue.
   */
  add(input: TaskInput): QueueTask {
    const id = input.id ?? randomUUID();
    const now = new Date();

    const task: QueueTask = {
      id,
      title: input.title,
      description: input.description,
      priority: input.priority ?? 'normal',
      status: 'pending',
      dependencies: input.dependencies ?? [],
      assignTo: input.assignTo,
      createdAt: now,
      retryCount: 0,
      maxRetries: input.maxRetries ?? 3,
      metadata: input.metadata,
    };

    // If no dependencies, mark as ready immediately
    if (task.dependencies.length === 0) {
      task.status = 'ready';
    }

    this.tasks.set(id, task);

    this.bus?.publish('task.created', { taskId: id, title: task.title, priority: task.priority });

    return task;
  }

  /**
   * Get the next ready task (highest priority, FIFO within same priority).
   */
  getNext(): QueueTask | null {
    // First, update pending tasks whose deps are now satisfied
    this.updateReadyTasks();

    let best: QueueTask | null = null;
    let bestPriority = Infinity;
    let bestTime = Infinity;

    for (const task of this.tasks.values()) {
      if (task.status !== 'ready') continue;

      const pv = PRIORITY_VALUES[task.priority];
      const ct = task.createdAt.getTime();

      // Lower priority value = higher priority
      // For same priority, earlier created = first
      if (pv < bestPriority || (pv === bestPriority && ct < bestTime)) {
        best = task;
        bestPriority = pv;
        bestTime = ct;
      }
    }

    return best;
  }

  /**
   * Get a task by ID.
   */
  get(id: string): QueueTask | undefined {
    return this.tasks.get(id);
  }

  /**
   * Mark a task as running.
   */
  start(id: string): QueueTask {
    const task = this.getOrThrow(id);
    this.assertStatus(task, 'ready');
    task.status = 'running';
    task.startedAt = new Date();

    this.bus?.publish('task.started', { taskId: id });
    return task;
  }

  /**
   * Mark a task as completed.
   */
  complete(id: string, result?: unknown): QueueTask {
    const task = this.getOrThrow(id);
    this.assertStatus(task, 'running');
    task.status = 'completed';
    task.completedAt = new Date();
    task.result = result;

    this.bus?.publish('task.completed', { taskId: id, result });

    // Update pending tasks that depended on this one
    this.updateReadyTasks();

    return task;
  }

  /**
   * Mark a task as failed.
   */
  fail(id: string, error: string): QueueTask {
    const task = this.getOrThrow(id);
    this.assertStatus(task, 'running');
    task.status = 'failed';
    task.completedAt = new Date();
    task.error = error;

    this.bus?.publish('task.failed', { taskId: id, error });
    return task;
  }

  /**
   * Cancel a task.
   */
  cancel(id: string): QueueTask {
    const task = this.getOrThrow(id);
    if (task.status === 'completed' || task.status === 'cancelled') {
      throw new Error(`Cannot cancel task in status: ${task.status}`);
    }
    task.status = 'cancelled';
    task.completedAt = new Date();

    this.bus?.publish('task.cancelled', { taskId: id });
    return task;
  }

  /**
   * Get all tasks.
   */
  getAll(): QueueTask[] {
    return [...this.tasks.values()];
  }

  /**
   * Get tasks by status.
   */
  getByStatus(status: TaskStatus): QueueTask[] {
    return [...this.tasks.values()].filter((t) => t.status === status);
  }

  /**
   * Get queue statistics.
   */
  getStats(): QueueStats {
    const stats: QueueStats = {
      total: 0,
      pending: 0,
      ready: 0,
      running: 0,
      completed: 0,
      failed: 0,
      cancelled: 0,
    };

    for (const task of this.tasks.values()) {
      stats.total++;
      stats[task.status]++;
    }

    return stats;
  }

  /**
   * Clear all tasks.
   */
  clear(): void {
    this.tasks.clear();
  }

  // ===========================================================================
  // PRIVATE
  // ===========================================================================

  /**
   * Update pending tasks whose dependencies are now all completed.
   */
  private updateReadyTasks(): void {
    for (const task of this.tasks.values()) {
      if (task.status !== 'pending') continue;

      const allDepsSatisfied = task.dependencies.every((depId) => {
        const dep = this.tasks.get(depId);
        return dep && dep.status === 'completed';
      });

      if (allDepsSatisfied) {
        task.status = 'ready';
      }
    }
  }

  private getOrThrow(id: string): QueueTask {
    const task = this.tasks.get(id);
    if (!task) throw new Error(`Task not found: ${id}`);
    return task;
  }

  private assertStatus(task: QueueTask, expected: TaskStatus): void {
    if (task.status !== expected) {
      throw new Error(`Task ${task.id} is "${task.status}", expected "${expected}"`);
    }
  }
}
