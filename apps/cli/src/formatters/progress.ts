/**
 * OpenAgent CLI - Progress Formatters
 *
 * Terminal output formatting for orchestrated multi-worker execution.
 */

import type { OrchestratorResult } from '@openagent/orchestrator';

const COLORS = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
};

/**
 * Format plan creation event.
 */
export function formatPlanCreated(planId: string, stepCount: number): string {
  return `${COLORS.bold}${COLORS.cyan}[Plan]${COLORS.reset} Created plan ${COLORS.dim}${planId.slice(0, 8)}${COLORS.reset} with ${COLORS.bold}${stepCount}${COLORS.reset} step(s)`;
}

/**
 * Format task started event.
 */
export function formatTaskStarted(taskId: string, title: string, role: string): string {
  return `${COLORS.blue}[${role}]${COLORS.reset} ${title} ${COLORS.dim}(${taskId})${COLORS.reset}`;
}

/**
 * Format task completed event.
 */
export function formatTaskCompleted(taskId: string, title: string, durationMs: number): string {
  const secs = (durationMs / 1000).toFixed(1);
  return `${COLORS.green}  ✓${COLORS.reset} ${title} ${COLORS.dim}(${secs}s)${COLORS.reset}`;
}

/**
 * Format task failed event.
 */
export function formatTaskFailed(taskId: string, title: string, error: string): string {
  return `${COLORS.red}  ✗${COLORS.reset} ${title}: ${COLORS.red}${error}${COLORS.reset}`;
}

/**
 * Format a progress bar.
 */
export function formatProgressBar(completed: number, total: number, width: number = 30): string {
  if (total === 0) return `[${'-'.repeat(width)}] 0/0`;
  const pct = Math.round((completed / total) * 100);
  const filled = Math.round((completed / total) * width);
  const bar = '█'.repeat(filled) + '░'.repeat(width - filled);
  return `[${bar}] ${pct}% (${completed}/${total})`;
}

/**
 * Format the final orchestration summary.
 */
export function formatPlanSummary(result: OrchestratorResult): string {
  const lines: string[] = [];
  const secs = (result.totalDuration / 1000).toFixed(1);

  if (result.success) {
    lines.push(`\n${COLORS.bold}${COLORS.green}✓ Plan completed${COLORS.reset} in ${secs}s`);
  } else {
    lines.push(`\n${COLORS.bold}${COLORS.red}✗ Plan failed${COLORS.reset} in ${secs}s`);
  }

  const completed = result.stepResults.filter((r) => r.status === 'completed').length;
  const failed = result.stepResults.filter((r) => r.status === 'failed').length;

  lines.push(`  Steps: ${completed} completed, ${failed} failed, ${result.stepResults.length} total`);
  lines.push(`  ${result.summary}`);

  return lines.join('\n');
}
