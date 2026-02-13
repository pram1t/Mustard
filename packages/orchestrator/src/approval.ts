/**
 * OpenAgent V2 - Plan Approval Manager
 *
 * Handles interactive plan approval before execution.
 * Supports plan-level approval (approve/reject/modify) and
 * step-by-step approval during execution.
 */

import type { ExecutionPlan, PlanStep, StepResult } from './types.js';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Decision for plan approval.
 */
export type ApprovalDecision = 'approve' | 'reject' | 'modify';

/**
 * Result of a plan approval request.
 */
export interface ApprovalResult {
  decision: ApprovalDecision;
  plan: ExecutionPlan;
  reason?: string;
}

/**
 * Callback for plan-level approval.
 * Receives the formatted plan, returns approval decision with possibly modified plan.
 */
export type PlanApprovalCallback = (
  plan: ExecutionPlan,
  formatted: string,
) => Promise<ApprovalResult>;

/**
 * Context provided for step-by-step approval.
 */
export interface StepApprovalContext {
  step: PlanStep;
  stepIndex: number;
  totalSteps: number;
  previousResults: StepResult[];
}

/**
 * Callback for step-by-step approval.
 * Returns true to proceed, false to skip.
 */
export type StepApprovalCallback = (
  context: StepApprovalContext,
) => Promise<boolean>;

// =============================================================================
// APPROVAL MANAGER
// =============================================================================

/**
 * Manages plan and step approval workflows.
 */
export class ApprovalManager {
  private planCallback?: PlanApprovalCallback;
  private stepCallback?: StepApprovalCallback;

  /**
   * Set the plan approval callback.
   */
  setPlanApprovalCallback(cb: PlanApprovalCallback): void {
    this.planCallback = cb;
  }

  /**
   * Set the step-by-step approval callback.
   */
  setStepApprovalCallback(cb: StepApprovalCallback): void {
    this.stepCallback = cb;
  }

  /**
   * Check if a plan approval callback is registered.
   */
  hasPlanCallback(): boolean {
    return this.planCallback !== undefined;
  }

  /**
   * Check if a step approval callback is registered.
   */
  hasStepCallback(): boolean {
    return this.stepCallback !== undefined;
  }

  /**
   * Request plan-level approval.
   * Formats the plan and calls the registered callback.
   *
   * If no callback is set, auto-approves.
   */
  async requestPlanApproval(plan: ExecutionPlan): Promise<ApprovalResult> {
    if (!this.planCallback) {
      return { decision: 'approve', plan };
    }

    const formatted = formatPlanForApproval(plan);
    return this.planCallback(plan, formatted);
  }

  /**
   * Request step-level approval.
   * Calls the registered step callback with context.
   *
   * If no callback is set, auto-approves.
   */
  async requestStepApproval(context: StepApprovalContext): Promise<boolean> {
    if (!this.stepCallback) {
      return true;
    }

    return this.stepCallback(context);
  }
}

// =============================================================================
// PLAN FORMATTER
// =============================================================================

/**
 * Format an execution plan for human review.
 */
export function formatPlanForApproval(plan: ExecutionPlan): string {
  const lines: string[] = [];

  lines.push('╔══════════════════════════════════════════════════════════════╗');
  lines.push('║                      EXECUTION PLAN                        ║');
  lines.push('╚══════════════════════════════════════════════════════════════╝');
  lines.push('');
  lines.push(`Request: ${plan.request}`);
  lines.push(`Steps:   ${plan.steps.length}`);
  lines.push('');

  for (let i = 0; i < plan.steps.length; i++) {
    const step = plan.steps[i];
    const deps = step.dependencies.length > 0 ? ` (depends on: ${step.dependencies.join(', ')})` : '';
    const priority = step.priority !== 'normal' ? ` [${step.priority}]` : '';

    lines.push(`  ${i + 1}. [${step.assignTo}] ${step.title}${priority}${deps}`);
    lines.push(`     ${step.description}`);
  }

  lines.push('');
  lines.push('─'.repeat(60));

  return lines.join('\n');
}
