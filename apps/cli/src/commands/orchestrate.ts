/**
 * OpenAgent CLI - Orchestrate Command
 *
 * Multi-worker orchestrated execution: plan → queue → dispatch → result.
 */

import type { LLMRouter } from '@openagent/llm';
import type { IToolRegistry } from '@openagent/tools';
import { EventBus, type MessageEnvelope } from '@openagent/message-bus';
import { Orchestrator, type OrchestratorConfig, type OrchestratorDeps } from '@openagent/orchestrator';
import {
  formatPlanCreated,
  formatTaskStarted,
  formatTaskCompleted,
  formatTaskFailed,
  formatPlanSummary,
  formatProgressBar,
} from '../formatters/progress.js';

/**
 * Options for the orchestrate command.
 */
export interface OrchestrateOptions {
  router: LLMRouter;
  tools: IToolRegistry;
  verbose: boolean;
  maxParallelWorkers?: number;
  requireApproval?: boolean;
  stepByStep?: boolean;
  cwd: string;
}

/**
 * Run a multi-worker orchestrated execution.
 */
export async function orchestrateCommand(
  prompt: string,
  options: OrchestrateOptions,
): Promise<void> {
  // Create the event bus for inter-component communication
  const bus = new EventBus();

  // Track progress for display
  let totalSteps = 0;
  let completedSteps = 0;

  // Subscribe to bus events for real-time progress output
  bus.subscribe('plan.created', (msg: MessageEnvelope<any>) => {
    const { planId, steps } = msg.payload;
    totalSteps = steps;
    console.log(formatPlanCreated(planId, steps));
    console.log('');
  });

  bus.subscribe('task.started', (msg: MessageEnvelope<any>) => {
    const { taskId, title, role } = msg.payload;
    console.log(formatTaskStarted(taskId, title ?? taskId, role ?? 'worker'));
  });

  bus.subscribe('task.completed', (msg: MessageEnvelope<any>) => {
    const { taskId, title, duration } = msg.payload;
    completedSteps++;
    console.log(formatTaskCompleted(taskId, title ?? taskId, duration ?? 0));
    if (options.verbose && totalSteps > 0) {
      console.log(`  ${formatProgressBar(completedSteps, totalSteps)}`);
    }
  });

  bus.subscribe('task.failed', (msg: MessageEnvelope<any>) => {
    const { taskId, title, error } = msg.payload;
    console.log(formatTaskFailed(taskId, title ?? taskId, error ?? 'Unknown error'));
  });

  // Build orchestrator configuration
  const config: OrchestratorConfig = {
    maxParallelWorkers: options.maxParallelWorkers ?? 3,
    requireApproval: options.requireApproval ?? false,
  };

  // Build orchestrator dependencies
  const deps: OrchestratorDeps = {
    router: options.router,
    tools: options.tools,
    bus,
  };

  // Create and run the orchestrator
  const orchestrator = new Orchestrator(config, deps);

  if (options.verbose) {
    console.log(`[Orchestrator] Max parallel workers: ${config.maxParallelWorkers}`);
    console.log(`[Orchestrator] Approval required: ${config.requireApproval}`);
    console.log('');
  }

  try {
    const result = await orchestrator.execute(prompt);
    console.log(formatPlanSummary(result));
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`\nOrchestration failed: ${errorMsg}`);
    process.exit(1);
  }
}
