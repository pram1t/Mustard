/**
 * OpenAgent V2 - Dispatcher
 *
 * Assigns tasks to workers, starts execution, handles completion.
 * Supports both sequential (dispatchNext) and parallel (runAll) execution.
 */

import type { IMessageBus } from '@openagent/message-bus';
import type { IMemoryStore } from '@openagent/memory';
import type { IArtifactStore, IHandoffManager } from '@openagent/artifact';
import type { WorkerFactory, IWorker } from '@openagent/worker';
import type { TaskQueue, QueueTask } from '@openagent/queue';
import type { ExecutionPlan, StepResult } from './types.js';

/**
 * Optional dependencies for dispatcher → worker config pass-through.
 */
export interface DispatcherDeps {
  bus?: IMessageBus;
  memoryStore?: IMemoryStore;
  artifactStore?: IArtifactStore;
  handoffManager?: IHandoffManager;
  projectId?: string;
}

/**
 * Dispatches tasks from the queue to workers and collects results.
 */
export class Dispatcher {
  private readonly queue: TaskQueue;
  private readonly factory: WorkerFactory;
  private readonly bus?: IMessageBus;
  private readonly maxConcurrency: number;
  private readonly deps: DispatcherDeps;
  private readonly stepResults = new Map<string, StepResult>();
  private readonly activeWorkers = new Map<string, IWorker>();

  constructor(queue: TaskQueue, factory: WorkerFactory, bus?: IMessageBus, maxConcurrency: number = 3, deps?: DispatcherDeps) {
    this.queue = queue;
    this.factory = factory;
    this.bus = bus;
    this.maxConcurrency = maxConcurrency;
    this.deps = deps ?? {};
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
   * Run all tasks with parallel execution up to maxConcurrency.
   * Returns all step results when execution is complete.
   */
  async runAll(): Promise<StepResult[]> {
    const running = new Map<string, Promise<{ taskId: string; result: StepResult }>>();

    while (this.hasPendingWork() || running.size > 0) {
      // Fill slots up to maxConcurrency
      while (running.size < this.maxConcurrency) {
        const task = this.queue.getNext();
        if (!task) break;

        this.queue.start(task.id);

        this.bus?.publish('task.started', {
          taskId: task.id,
          title: task.title,
          role: task.assignTo,
        });

        const promise = this.executeTask(task).then((result) => ({
          taskId: task.id,
          result,
        }));
        running.set(task.id, promise);
      }

      if (running.size === 0) {
        // Check if there are pending tasks that might become ready
        const stats = this.queue.getStats();
        if (stats.pending > 0 && stats.running === 0) {
          // Tasks stuck waiting for deps that will never resolve (failed deps)
          break;
        }
        break;
      }

      // Wait for any one task to complete
      const completed = await Promise.race([...running.values()]);
      running.delete(completed.taskId);
      this.stepResults.set(completed.taskId, completed.result);
    }

    return this.getResults();
  }

  /**
   * Execute a single task.
   */
  private async executeTask(task: QueueTask): Promise<StepResult> {
    const startTime = Date.now();
    let prompt = (task.metadata?.prompt as string) ?? task.description;
    const role = (task.assignTo as any) ?? 'backend';

    // Inject artifact context from completed dependencies
    const artifactContext = this.buildArtifactContext(task);
    if (artifactContext) {
      prompt = `${artifactContext}\n\n${prompt}`;
    }

    try {
      const worker = this.factory.create({
        role,
        cwd: process.cwd(),
        bus: this.deps.bus,
        memoryStore: this.deps.memoryStore,
        projectId: this.deps.projectId,
      });
      this.activeWorkers.set(task.id, worker);

      let output = '';
      for await (const event of worker.run(prompt, task.id)) {
        if (event.type === 'text') {
          output += (event as any).content ?? '';
        }
      }

      this.queue.complete(task.id, { output });
      this.activeWorkers.delete(task.id);

      // Store output as artifact and create handoffs for downstream tasks
      this.storeArtifactAndHandoff(task, output);

      const result: StepResult = {
        stepId: task.id,
        status: 'completed',
        output,
        duration: Date.now() - startTime,
      };

      this.bus?.publish('task.completed', {
        taskId: task.id,
        title: task.title,
        duration: result.duration,
      });

      return result;
    } catch (err) {
      const error = (err as Error).message;
      this.queue.fail(task.id, error);
      this.activeWorkers.delete(task.id);

      const result: StepResult = {
        stepId: task.id,
        status: 'failed',
        error,
        duration: Date.now() - startTime,
      };

      this.bus?.publish('task.failed', {
        taskId: task.id,
        title: task.title,
        error,
      });

      return result;
    }
  }

  /**
   * Build artifact context from completed dependency steps.
   */
  private buildArtifactContext(task: QueueTask): string | null {
    const store = this.deps.artifactStore;
    if (!store || !this.deps.projectId) return null;

    const sections: string[] = [];
    for (const depId of task.dependencies) {
      const depResult = this.stepResults.get(depId);
      if (!depResult?.output) continue;

      const depTask = this.queue.get(depId);
      if (!depTask) continue;

      sections.push(`--- Output from "${depTask.title}" (${depTask.assignTo}) ---\n${depResult.output}`);
    }

    if (sections.length === 0) return null;
    return `## Context from Previous Steps\n\n${sections.join('\n\n')}`;
  }

  /**
   * Store task output as artifact and create handoffs for downstream tasks.
   */
  private storeArtifactAndHandoff(task: QueueTask, output: string): void {
    const store = this.deps.artifactStore;
    const handoffMgr = this.deps.handoffManager;
    if (!store || !this.deps.projectId || !output) return;

    const artifact = store.create({
      name: `step-${task.id}`,
      type: 'documentation',
      createdBy: task.assignTo ?? 'unknown',
      projectId: this.deps.projectId,
      content: output,
      summary: task.title,
    });

    if (!handoffMgr) return;

    // Find downstream tasks that depend on this one
    for (const t of this.queue.getAll()) {
      if (t.dependencies.includes(task.id) && t.assignTo) {
        handoffMgr.create(artifact.id, task.assignTo ?? 'unknown', t.assignTo, task.title);
      }
    }
  }

  /**
   * Dispatch the next available task sequentially.
   * @deprecated Use runAll() for parallel execution.
   */
  async dispatchNext(): Promise<StepResult | null> {
    const task = this.queue.getNext();
    if (!task) return null;

    this.queue.start(task.id);

    this.bus?.publish('task.started', {
      taskId: task.id,
      title: task.title,
      role: task.assignTo,
    });

    const result = await this.executeTask(task);
    this.stepResults.set(task.id, result);
    return result;
  }

  /**
   * Check if there are more tasks to process.
   */
  hasMore(): boolean {
    const stats = this.queue.getStats();
    return stats.ready > 0 || stats.pending > 0 || stats.running > 0;
  }

  /**
   * Check if there is pending work (tasks not yet completed or failed).
   */
  private hasPendingWork(): boolean {
    const stats = this.queue.getStats();
    return stats.ready > 0 || stats.pending > 0;
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
