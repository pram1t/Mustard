/**
 * OpenAgent V2 - Dispatcher
 *
 * Assigns tasks to workers, starts execution, handles completion.
 */

import type { IMessageBus } from '@openagent/message-bus';
import type { WorkerFactory, IWorker } from '@openagent/worker';
import type { TaskQueue, QueueTask } from '@openagent/queue';
import type { ExecutionPlan, StepResult } from './types.js';

/**
 * Dispatches tasks from the queue to workers and collects results.
 */
export class Dispatcher {
  private readonly queue: TaskQueue;
  private readonly factory: WorkerFactory;
  private readonly bus?: IMessageBus;
  private readonly stepResults = new Map<string, StepResult>();
  private readonly activeWorkers = new Map<string, IWorker>();

  constructor(queue: TaskQueue, factory: WorkerFactory, bus?: IMessageBus) {
    this.queue = queue;
    this.factory = factory;
    this.bus = bus;
  }

  /**
   * Load a plan into the task queue.
   */
  loadPlan(plan: ExecutionPlan): void {
    for (const step of plan.steps) {
      this.queue.add({
        id: step.id,
        title: step.title,
        description: step.description,
        priority: step.priority,
        dependencies: step.dependencies,
        assignTo: step.assignTo,
        metadata: { prompt: step.prompt, planId: plan.id },
      });
    }
  }

  /**
   * Dispatch the next available task to a worker.
   * Returns the step result when execution completes,
   * or null if no tasks are ready.
   */
  async dispatchNext(): Promise<StepResult | null> {
    const task = this.queue.getNext();
    if (!task) return null;

    this.queue.start(task.id);

    const startTime = Date.now();
    const prompt = (task.metadata?.prompt as string) ?? task.description;
    const role = (task.assignTo as any) ?? 'backend';

    try {
      // Create a worker for this task
      const worker = this.factory.create({ role, cwd: process.cwd() });
      this.activeWorkers.set(task.id, worker);

      // Run the worker and collect output
      let output = '';
      for await (const event of worker.run(prompt, task.id)) {
        if (event.type === 'text') {
          output += (event as any).content ?? '';
        }
      }

      // Mark task complete
      this.queue.complete(task.id, { output });

      const result: StepResult = {
        stepId: task.id,
        status: 'completed',
        output,
        duration: Date.now() - startTime,
      };

      this.stepResults.set(task.id, result);
      this.activeWorkers.delete(task.id);

      this.bus?.publish('task.completed', {
        taskId: task.id,
        duration: result.duration,
      });

      return result;
    } catch (err) {
      const error = (err as Error).message;
      this.queue.fail(task.id, error);

      const result: StepResult = {
        stepId: task.id,
        status: 'failed',
        error,
        duration: Date.now() - startTime,
      };

      this.stepResults.set(task.id, result);
      this.activeWorkers.delete(task.id);

      this.bus?.publish('task.failed', { taskId: task.id, error });

      return result;
    }
  }

  /**
   * Check if there are more tasks to process.
   */
  hasMore(): boolean {
    const stats = this.queue.getStats();
    return stats.ready > 0 || stats.pending > 0 || stats.running > 0;
  }

  /**
   * Get all collected step results.
   */
  getResults(): StepResult[] {
    return [...this.stepResults.values()];
  }

  /**
   * Get result for a specific step.
   */
  getResult(stepId: string): StepResult | undefined {
    return this.stepResults.get(stepId);
  }

  /**
   * Get active worker count.
   */
  getActiveWorkerCount(): number {
    return this.activeWorkers.size;
  }
}
