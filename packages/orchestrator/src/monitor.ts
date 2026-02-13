/**
 * OpenAgent V2 - Progress Monitor
 *
 * Tracks execution progress across an orchestrated plan.
 */

import type { IMessageBus } from '@openagent/message-bus';
import type { TaskQueue } from '@openagent/queue';
import type { ExecutionPlan, StepResult } from './types.js';

/**
 * Progress snapshot at a point in time.
 */
export interface ProgressSnapshot {
  planId: string;
  totalSteps: number;
  completedSteps: number;
  failedSteps: number;
  pendingSteps: number;
  runningSteps: number;
  progressPercent: number;
  stepDetails: StepProgress[];
}

/**
 * Per-step progress info.
 */
export interface StepProgress {
  stepId: string;
  title: string;
  status: string;
  assignTo: string;
}

/**
 * Tracks execution progress of a plan.
 */
export class ProgressMonitor {
  private plan?: ExecutionPlan;
  private readonly queue: TaskQueue;
  private readonly bus?: IMessageBus;
  private unsubscribes: (() => void)[] = [];

  constructor(queue: TaskQueue, bus?: IMessageBus) {
    this.queue = queue;
    this.bus = bus;
  }

  /**
   * Start monitoring a plan.
   */
  startMonitoring(plan: ExecutionPlan): void {
    this.plan = plan;

    if (this.bus) {
      // Subscribe to task events for real-time progress
      this.unsubscribes.push(
        this.bus.subscribe('task.*', (msg) => {
          // Events are tracked via queue state; bus is for notifications
        })
      );
    }
  }

  /**
   * Stop monitoring.
   */
  stopMonitoring(): void {
    for (const unsub of this.unsubscribes) {
      unsub();
    }
    this.unsubscribes = [];
    this.plan = undefined;
  }

  /**
   * Get current progress snapshot.
   */
  getProgress(): ProgressSnapshot | null {
    if (!this.plan) return null;

    const stats = this.queue.getStats();
    const totalSteps = this.plan.steps.length;

    const stepDetails: StepProgress[] = this.plan.steps.map((step) => {
      const task = this.queue.get(step.id);
      return {
        stepId: step.id,
        title: step.title,
        status: task?.status ?? 'unknown',
        assignTo: step.assignTo,
      };
    });

    return {
      planId: this.plan.id,
      totalSteps,
      completedSteps: stats.completed,
      failedSteps: stats.failed,
      pendingSteps: stats.pending,
      runningSteps: stats.running,
      progressPercent: totalSteps > 0 ? Math.round((stats.completed / totalSteps) * 100) : 0,
      stepDetails,
    };
  }

  /**
   * Check if all steps are complete (or failed).
   */
  isComplete(): boolean {
    if (!this.plan) return false;
    const stats = this.queue.getStats();
    return stats.pending === 0 && stats.ready === 0 && stats.running === 0;
  }

  /**
   * Check if execution has any failures.
   */
  hasFailures(): boolean {
    const stats = this.queue.getStats();
    return stats.failed > 0;
  }
}
