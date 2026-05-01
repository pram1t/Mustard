/**
 * OpenAgent V2 - Orchestrator
 *
 * Main orchestrator that ties everything together:
 * Request → Plan → Queue → Dispatch → Monitor → Result
 */

import type { IMessageBus } from '@pram1t/mustard-message-bus';
import { EventBus } from '@pram1t/mustard-message-bus';
import { TaskQueue } from '@pram1t/mustard-queue';
import { WorkerRegistry, WorkerFactory } from '@pram1t/mustard-worker';
import { Planner } from './planner.js';
import { Dispatcher } from './dispatcher.js';
import { ProgressMonitor } from './monitor.js';
import { ApprovalManager, type PlanApprovalCallback, type StepApprovalCallback } from './approval.js';
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
  stepByStepApproval: false,
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
  private readonly approval: ApprovalManager;

  constructor(config: OrchestratorConfig, deps: OrchestratorDeps) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.bus = deps.bus ?? new EventBus();
    this.planner = new Planner(deps.router);
    this.queue = new TaskQueue(this.bus);
    this.registry = new WorkerRegistry();
    this.factory = new WorkerFactory(this.registry, deps.router, deps.tools);
    this.dispatcher = new Dispatcher(this.queue, this.factory, this.bus, this.config.maxParallelWorkers, {
      bus: this.bus,
      memoryStore: deps.memoryStore,
      artifactStore: deps.artifactStore,
      projectId: undefined, // Set per-request if needed
    });
    this.monitor = new ProgressMonitor(this.queue, this.bus);
    this.approval = new ApprovalManager();
  }

  /**
   * Set callback for plan approval (Phase 12).
   */
  setPlanApprovalCallback(cb: PlanApprovalCallback): void {
    this.approval.setPlanApprovalCallback(cb);
  }

  /**
   * Set callback for step-by-step approval (Phase 12).
   */
  setStepApprovalCallback(cb: StepApprovalCallback): void {
    this.approval.setStepApprovalCallback(cb);
  }

  /**
   * Execute a full orchestration cycle:
   * plan → queue → dispatch → monitor → result
   */
  async execute(request: string, context?: string): Promise<OrchestratorResult> {
    const startTime = Date.now();

    // 1. Create plan
    let plan = await this.planner.createPlan(request, context);

    this.bus.publish('plan.created', { planId: plan.id, steps: plan.steps.length });

    // 2. If approval required and callback set, get approval (Phase 12)
    if (this.config.requireApproval && this.approval.hasPlanCallback()) {
      const approvalResult = await this.approval.requestPlanApproval(plan);

      if (approvalResult.decision === 'reject') {
        return {
          planId: plan.id,
          success: false,
          stepResults: [],
          totalDuration: Date.now() - startTime,
          summary: 'Plan rejected by user.',
        };
      }

      // Use possibly-modified plan
      plan = approvalResult.plan;
    }

    // 3. Load plan into queue
    this.dispatcher.loadPlan(plan);

    // 4. Start monitoring
    this.monitor.startMonitoring(plan);

    // 5. Parallel dispatch — run all tasks up to maxConcurrency
    await this.dispatcher.runAll();

    // 6. Stop monitoring
    this.monitor.stopMonitoring();

    // 7. Collect results
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

    await this.dispatcher.runAll();

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
