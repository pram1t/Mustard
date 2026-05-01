/**
 * @mustard/orchestrator
 *
 * Multi-worker orchestrator for OpenAgent V2.
 * Coordinates planning, dispatching, monitoring, and result collection.
 */

export { Orchestrator } from './orchestrator.js';
export { Planner } from './planner.js';
export { RequestParser } from './parser.js';
export { Dispatcher } from './dispatcher.js';
export { ProgressMonitor } from './monitor.js';
export type { ProgressSnapshot, StepProgress } from './monitor.js';

// Approval (Phase 12)
export { ApprovalManager, formatPlanForApproval } from './approval.js';
export type {
  ApprovalDecision,
  ApprovalResult,
  PlanApprovalCallback,
  StepApprovalCallback,
  StepApprovalContext,
} from './approval.js';

export type {
  ParsedRequest,
  RequestIntent,
  RequestScope,
  RequestComplexity,
} from './parser.js';

export type {
  PlanStep,
  ExecutionPlan,
  StepResult,
  OrchestratorResult,
  OrchestratorConfig,
  OrchestratorDeps,
} from './types.js';
