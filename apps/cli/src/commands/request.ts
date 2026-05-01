/**
 * OpenAgent CLI - Request Command
 *
 * Submit requests for multi-worker orchestrated execution.
 *   request submit "<prompt>"   — Plan and optionally execute
 *   request execute "<prompt>"  — Plan and execute without approval
 */

import * as readline from 'readline';
import type { LLMRouter } from '@pram1t/mustard-llm';
import type { IToolRegistry } from '@pram1t/mustard-tools';
import { EventBus, type MessageEnvelope } from '@pram1t/mustard-message-bus';
import {
  Orchestrator,
  formatPlanForApproval,
  type OrchestratorConfig,
  type OrchestratorDeps,
  type ExecutionPlan,
} from '@pram1t/mustard-orchestrator';
import {
  formatPlanCreated,
  formatTaskStarted,
  formatTaskCompleted,
  formatTaskFailed,
  formatPlanSummary,
  formatProgressBar,
} from '../formatters/progress.js';

export type RequestAction = 'submit' | 'execute';

export interface RequestOptions {
  router: LLMRouter;
  tools: IToolRegistry;
  verbose: boolean;
  maxParallelWorkers?: number;
  cwd: string;
}

const COLORS = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
};

/**
 * Execute the request command.
 */
export async function requestCommand(
  action: RequestAction,
  prompt: string,
  options: RequestOptions,
): Promise<void> {
  if (!prompt) {
    console.error('Error: A prompt is required.');
    console.error('Usage: openagent request submit "<prompt>"');
    process.exit(1);
  }

  switch (action) {
    case 'submit':
      await submitRequest(prompt, options);
      break;
    case 'execute':
      await executeRequest(prompt, options);
      break;
    default:
      console.error(`Unknown request action: ${action}`);
      process.exit(1);
  }
}

/**
 * Submit a request: generate plan, show it, ask for approval, then execute.
 */
async function submitRequest(prompt: string, options: RequestOptions): Promise<void> {
  const bus = new EventBus();
  const orchestrator = createOrchestrator(bus, options, true);

  // Phase 1: Generate the plan
  console.log(`\n${COLORS.bold}${COLORS.cyan}Generating plan...${COLORS.reset}\n`);

  const plan = await orchestrator.plan(prompt);

  // Display the plan
  console.log(formatPlanForApproval(plan));
  console.log('');

  // Ask for approval
  const approved = await askApproval();

  if (!approved) {
    console.log(`\n${COLORS.yellow}Plan rejected. No changes made.${COLORS.reset}\n`);
    return;
  }

  // Phase 2: Execute the approved plan
  console.log(`\n${COLORS.bold}${COLORS.cyan}Executing plan...${COLORS.reset}\n`);

  subscribeToBusEvents(bus, options.verbose);

  try {
    const result = await orchestrator.executePlan(plan);
    console.log(formatPlanSummary(result));
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`\n${COLORS.red}Execution failed: ${errorMsg}${COLORS.reset}`);
    process.exit(1);
  }
}

/**
 * Execute a request directly without interactive approval.
 */
async function executeRequest(prompt: string, options: RequestOptions): Promise<void> {
  const bus = new EventBus();
  const orchestrator = createOrchestrator(bus, options, false);

  subscribeToBusEvents(bus, options.verbose);

  if (options.verbose) {
    console.log(`[Orchestrator] Max parallel workers: ${options.maxParallelWorkers ?? 3}`);
    console.log('');
  }

  try {
    const result = await orchestrator.execute(prompt);
    console.log(formatPlanSummary(result));
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`\n${COLORS.red}Execution failed: ${errorMsg}${COLORS.reset}`);
    process.exit(1);
  }
}

/**
 * Create an Orchestrator instance.
 */
function createOrchestrator(
  bus: EventBus,
  options: RequestOptions,
  requireApproval: boolean,
): Orchestrator {
  const config: OrchestratorConfig = {
    maxParallelWorkers: options.maxParallelWorkers ?? 3,
    requireApproval,
  };

  const deps: OrchestratorDeps = {
    router: options.router,
    tools: options.tools,
    bus,
  };

  return new Orchestrator(config, deps);
}

/**
 * Subscribe to EventBus for real-time progress output.
 */
function subscribeToBusEvents(bus: EventBus, verbose: boolean): void {
  let totalSteps = 0;
  let completedSteps = 0;

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
    if (verbose && totalSteps > 0) {
      console.log(`  ${formatProgressBar(completedSteps, totalSteps)}`);
    }
  });

  bus.subscribe('task.failed', (msg: MessageEnvelope<any>) => {
    const { taskId, title, error } = msg.payload;
    console.log(formatTaskFailed(taskId, title ?? taskId, error ?? 'Unknown error'));
  });
}

/**
 * Interactive approval prompt.
 */
function askApproval(): Promise<boolean> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question(
      `${COLORS.bold}Approve and execute this plan? (y/N): ${COLORS.reset}`,
      (answer) => {
        rl.close();
        const approved = answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes';
        resolve(approved);
      },
    );
  });
}
