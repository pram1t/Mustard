/**
 * OpenAgent V2 - Orchestrator
 *
 * Main orchestrator that ties everything together:
 * Request → Plan → Queue → Dispatch → Monitor → Result
 */

import type { IMessageBus } from '@openagent/message-bus';
import { EventBus } from '@openagent/message-bus';
import { TaskQueue } from '@openagent/queue';
import { WorkerRegistry, WorkerFactory } from '@openagent/worker';
import { Planner } from './planner.js';
import { Dispatcher } from './dispatcher.js';
import { ProgressMonitor } from './monitor.js';
import type {
  ExecutionPlan,
  OrchestratorConfig,
  OrchestratorDeps,
  OrchestratorResult,
} from './types.js';

/**
 * Default orchestrator configuration.
 */
const DEFAULT_CONFIG: Required<OrchestratorConfig> = {
  maxParallelWorkers: 3,
  taskTimeoutMs: 5 * 60 * 1000,
  requireApproval: false,
  maxRetries: 2,
};

/**
 * The Orchestrator coordinates multi-worker execution:
 *
 * 1. Takes a user request
 * 2. Uses the Planner to generate a task plan (via LLM)
 * 3. Loads the plan into a TaskQueue
 * 4. Dispatches tasks to workers via WorkerFactory
 * 5. Monitors progress
 * 6. Returns aggregated results
 */
export class Orchestrator {
  private readonly config: Required<OrchestratorConfig>;
  private readonly planner: Planner;
  private readonly bus: IMessageBus;
  private readonly queue: TaskQueue;
  private readonly registry: WorkerRegistry;
  private readonly factory: WorkerFactory;
  private readonly dispatcher: Dispatcher;
  private readonly monitor: ProgressMonitor;

  constructor(config: OrchestratorConfig, deps: OrchestratorDeps) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.bus = deps.bus ?? new EventBus();
    this.planner = new Planner(deps.router);
    this.queue = new TaskQueue(this.bus);
    this.registry = new WorkerRegistry();
    this.factory = new WorkerFactory(this.registry, deps.router, deps.tools);
    this.dispatcher = new Dispatcher(this.queue, this.factory, this.bus);
    this.monitor = new ProgressMonitor(this.queue, this.bus);
  }

  /**
   * Execute a full orchestration cycle:
   * plan → queue → dispatch → monitor → result
   */
  async execute(request: string, context?: string): Promise<OrchestratorResult> {
    const startTime = Date.now();

    // 1. Create plan
    const plan = await this.planner.createPlan(request, context);

    this.bus.publish('plan.created', { planId: plan.id, steps: plan.steps.length });

    // 2. Load plan into queue
    this.dispatcher.loadPlan(plan);

    // 3. Start monitoring
    this.monitor.startMonitoring(plan);

    // 4. Dispatch loop — run tasks until done
    while (this.dispatcher.hasMore()) {
      await this.dispatcher.dispatchNext();
    }

    // 5. Stop monitoring
    this.monitor.stopMonitoring();

    // 6. Collect results
    const results = this.dispatcher.getResults();
    const success = results.every((r) => r.status === 'completed');

    this.bus.publish(success ? 'plan.completed' : 'plan.failed', {
      planId: plan.id,
      duration: Date.now() - startTime,
    });

    return {
      planId: plan.id,
      success,
      stepResults: results,
      totalDuration: Date.now() - startTime,
      summary: this.buildSummary(plan, results),
    };
  }

  /**
   * Create a plan without executing it (for approval flow).
   */
  async plan(request: string, context?: string): Promise<ExecutionPlan> {
    return this.planner.createPlan(request, context);
  }

  /**
   * Execute a pre-created plan.
   */
  async executePlan(plan: ExecutionPlan): Promise<OrchestratorResult> {
    const startTime = Date.now();

    this.dispatcher.loadPlan(plan);
    this.monitor.startMonitoring(plan);

    while (this.dispatcher.hasMore()) {
      await this.dispatcher.dispatchNext();
    }

    this.monitor.stopMonitoring();

    const results = this.dispatcher.getResults();
    const success = results.every((r) => r.status === 'completed');

    return {
      planId: plan.id,
      success,
      stepResults: results,
      totalDuration: Date.now() - startTime,
      summary: this.buildSummary(plan, results),
    };
  }

  /**
   * Get the current progress.
   */
  getProgress() {
    return this.monitor.getProgress();
  }

  /**
   * Get the message bus for subscribing to events.
   */
  getBus(): IMessageBus {
    return this.bus;
  }

  // ===========================================================================
  // PRIVATE
  // ===========================================================================

  private buildSummary(plan: ExecutionPlan, results: import('./types.js').StepResult[]): string {
    const completed = results.filter((r) => r.status === 'completed').length;
    const failed = results.filter((r) => r.status === 'failed').length;
    const total = plan.steps.length;

    if (failed === 0) {
      return `Successfully completed all ${total} steps.`;
    }
    return `Completed ${completed}/${total} steps. ${failed} step(s) failed.`;
  }
}
