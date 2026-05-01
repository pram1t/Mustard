/**
 * OpenAgent CLI - Worker Command
 *
 * Manage V2 worker definitions and instances.
 *   worker list              — Show all built-in worker roles
 *   worker info <role>       — Show detailed info for a role
 */

import {
  WorkerRegistry,
  builtinDefinitions,
  type WorkerDefinition,
  type WorkerRole,
} from '@pram1t/mustard-worker';

export type WorkerAction = 'list' | 'info';

export interface WorkerOptions {
  role?: string;
  verbose?: boolean;
}

const COLORS = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  red: '\x1b[31m',
};

/**
 * Execute the worker command.
 */
export async function workerCommand(
  action: WorkerAction = 'list',
  options: WorkerOptions = {},
): Promise<void> {
  switch (action) {
    case 'list':
      listWorkers();
      break;
    case 'info':
      if (!options.role) {
        console.error('Error: Worker role is required for "worker info"');
        console.error('Usage: openagent worker info <role>');
        process.exit(1);
      }
      showWorkerInfo(options.role);
      break;
    default:
      console.error(`Unknown worker action: ${action}`);
      process.exit(1);
  }
}

/**
 * List all built-in worker definitions.
 */
function listWorkers(): void {
  const registry = new WorkerRegistry();
  const definitions = registry.getAllDefinitions();

  console.log(`\n${COLORS.bold}${COLORS.cyan}Available Worker Roles${COLORS.reset}\n`);

  for (const def of definitions) {
    const skillCount = def.skills.length;
    const toolInfo = def.tools.allowed.length > 0
      ? `${def.tools.allowed.length} tools`
      : 'all tools';
    const denied = def.tools.denied.length > 0
      ? ` (denied: ${def.tools.denied.length})`
      : '';

    console.log(
      `  ${COLORS.bold}${COLORS.blue}${def.role.padEnd(14)}${COLORS.reset}` +
      `${def.name.padEnd(16)}` +
      `${COLORS.dim}${skillCount} skills, ${toolInfo}${denied}${COLORS.reset}`
    );
    console.log(`  ${' '.repeat(14)}${COLORS.dim}${def.description}${COLORS.reset}`);
    console.log('');
  }

  console.log(`${COLORS.dim}Total: ${definitions.length} role(s)${COLORS.reset}`);
  console.log(`${COLORS.dim}Use "openagent worker info <role>" for details.${COLORS.reset}\n`);
}

/**
 * Show detailed info for a specific worker role.
 */
function showWorkerInfo(role: string): void {
  const registry = new WorkerRegistry();
  const def = registry.getDefinition(role as WorkerRole);

  if (!def) {
    console.error(`Unknown worker role: ${role}`);
    console.error(`Available roles: ${registry.getRegisteredRoles().join(', ')}`);
    process.exit(1);
    return; // Guard for test environments where process.exit is mocked
  }

  console.log('');
  console.log('─'.repeat(60));
  console.log(`${COLORS.bold}${COLORS.cyan}${def.name}${COLORS.reset} (${def.role})`);
  console.log('─'.repeat(60));
  console.log('');

  // Description
  console.log(`${COLORS.bold}Description:${COLORS.reset}`);
  console.log(`  ${def.description}`);
  console.log('');

  // Identity
  console.log(`${COLORS.bold}Identity:${COLORS.reset}`);
  console.log(`  ${def.prompt.identity}`);
  console.log('');

  // Expertise
  console.log(`${COLORS.bold}Expertise:${COLORS.reset}`);
  for (const exp of def.prompt.expertise) {
    console.log(`  - ${exp}`);
  }
  console.log('');

  // Responsibilities
  console.log(`${COLORS.bold}Responsibilities:${COLORS.reset}`);
  for (const resp of def.prompt.responsibilities) {
    console.log(`  - ${resp}`);
  }
  console.log('');

  // Skills
  console.log(`${COLORS.bold}Skills:${COLORS.reset}`);
  for (const skill of def.skills) {
    const badge = skill.proficiency === 'expert'
      ? `${COLORS.green}expert${COLORS.reset}`
      : skill.proficiency === 'intermediate'
        ? `${COLORS.yellow}intermediate${COLORS.reset}`
        : `${COLORS.dim}beginner${COLORS.reset}`;
    console.log(`  - ${skill.name} [${badge}]`);
    console.log(`    ${COLORS.dim}${skill.description}${COLORS.reset}`);
  }
  console.log('');

  // Tool access
  console.log(`${COLORS.bold}Tool Access:${COLORS.reset}`);
  if (def.tools.allowed.length > 0) {
    console.log(`  Allowed: ${def.tools.allowed.join(', ')}`);
  } else {
    console.log(`  Allowed: ${COLORS.dim}(all tools)${COLORS.reset}`);
  }
  if (def.tools.denied.length > 0) {
    console.log(`  Denied:  ${def.tools.denied.join(', ')}`);
  }
  console.log('');

  // Artifacts
  console.log(`${COLORS.bold}Artifacts:${COLORS.reset}`);
  if (def.prompt.artifacts.produces.length > 0) {
    console.log(`  Produces: ${def.prompt.artifacts.produces.join(', ')}`);
  }
  if (def.prompt.artifacts.consumes.length > 0) {
    console.log(`  Consumes: ${def.prompt.artifacts.consumes.join(', ')}`);
  }
  console.log('');

  // Constraints
  console.log(`${COLORS.bold}Constraints:${COLORS.reset}`);
  for (const c of def.prompt.constraints) {
    console.log(`  - ${c}`);
  }
  console.log('');

  // Communication style
  console.log(`${COLORS.bold}Communication Style:${COLORS.reset}`);
  console.log(`  ${def.prompt.communication}`);
  console.log('');
}
