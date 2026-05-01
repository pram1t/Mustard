/**
 * Plans Command
 *
 * Manage OpenAgent plans from CLI.
 */

import {
  listPlans,
  getPlan,
  deletePlan,
  getPlansByStatus,
  findProjectRoot,
} from '@pram1t/mustard-config';
import type { Plan } from '@pram1t/mustard-config';

export type PlansAction = 'list' | 'show' | 'delete';

export interface PlansOptions {
  status?: Plan['status'];
}

/**
 * Execute the plans command
 */
export async function plansCommand(
  cwd: string,
  action: PlansAction = 'list',
  id?: string,
  options: PlansOptions = {}
): Promise<void> {
  switch (action) {
    case 'list':
      await listPlansCommand(cwd, options.status);
      break;
    case 'show':
      if (!id) {
        console.error('Error: Plan ID is required for "plans show"');
        process.exit(1);
      }
      await showPlanCommand(cwd, id);
      break;
    case 'delete':
      if (!id) {
        console.error('Error: Plan ID is required for "plans delete"');
        process.exit(1);
      }
      await deletePlanCommand(cwd, id);
      break;
    default:
      console.error(`Unknown plans action: ${action}`);
      process.exit(1);
  }
}

/**
 * Format a date for display
 */
function formatDate(date: Date): string {
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Format plan status with color hints
 */
function formatStatus(status: Plan['status']): string {
  switch (status) {
    case 'draft':
      return 'draft';
    case 'approved':
      return 'approved';
    case 'completed':
      return 'completed';
    case 'abandoned':
      return 'abandoned';
    default:
      return status;
  }
}

/**
 * List all plans
 */
async function listPlansCommand(cwd: string, status?: Plan['status']): Promise<void> {
  const plans = status
    ? await getPlansByStatus(cwd, status)
    : await listPlans(cwd);

  if (plans.length === 0) {
    if (status) {
      console.log(`No plans with status "${status}" found.`);
    } else {
      console.log('No plans found.');
    }
    console.log('');
    console.log('Plans are created automatically in Plan Mode.');
    return;
  }

  console.log('Plans:\n');

  for (const plan of plans) {
    console.log(`  ${plan.id}`);
    console.log(`    Title: ${plan.title}`);
    console.log(`    Status: ${formatStatus(plan.status)}`);
    console.log(`    Updated: ${formatDate(plan.updatedAt)}`);
    console.log('');
  }

  console.log(`Total: ${plans.length} plan(s)`);
}

/**
 * Show a specific plan
 */
async function showPlanCommand(cwd: string, id: string): Promise<void> {
  const plan = await getPlan(cwd, id);

  if (!plan) {
    console.error(`Plan not found: ${id}`);
    process.exit(1);
  }

  console.log('─'.repeat(60));
  console.log(`Plan: ${plan.id}`);
  console.log('─'.repeat(60));
  console.log(`Title:   ${plan.title}`);
  console.log(`Status:  ${formatStatus(plan.status)}`);
  console.log(`Created: ${formatDate(plan.createdAt)}`);
  console.log(`Updated: ${formatDate(plan.updatedAt)}`);
  console.log('─'.repeat(60));
  console.log('');
  console.log(plan.content);
}

/**
 * Delete a plan
 */
async function deletePlanCommand(cwd: string, id: string): Promise<void> {
  const deleted = await deletePlan(cwd, id);

  if (deleted) {
    console.log(`Deleted plan: ${id}`);
  } else {
    console.error(`Plan not found: ${id}`);
    process.exit(1);
  }
}
