/**
 * Plan Manager
 *
 * Manages plan documents stored in .openagent/plans/
 * Generates readable plan IDs like Claude Code (adjective-adjective-noun pattern)
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { getPlansDir } from './project.js';
import type { Plan } from './types.js';

// Word lists for generating readable plan IDs
const ADJECTIVES = [
  'able', 'ancient', 'bold', 'brave', 'bright', 'calm', 'clean', 'clever', 'cool',
  'dancing', 'daring', 'dark', 'deep', 'eager', 'elegant', 'eloquent', 'fair',
  'fast', 'fierce', 'flying', 'gentle', 'glowing', 'golden', 'grand', 'happy',
  'hidden', 'hopping', 'humble', 'icy', 'jolly', 'jumping', 'keen', 'kind',
  'lazy', 'lively', 'lone', 'long', 'lucky', 'magic', 'merry', 'mighty', 'misty',
  'noble', 'odd', 'old', 'plain', 'prancing', 'proud', 'pure', 'quick', 'quiet',
  'rapid', 'rare', 'recursive', 'red', 'rich', 'rising', 'rosy', 'royal', 'running',
  'sage', 'secret', 'sharp', 'shiny', 'silent', 'silver', 'simple', 'sleek', 'small',
  'smart', 'sniffing', 'soft', 'solar', 'solid', 'sparse', 'spring', 'stark', 'steady',
  'still', 'strong', 'sunny', 'super', 'sweet', 'swift', 'tall', 'tender', 'tidy',
  'tiny', 'tough', 'twilight', 'vivid', 'wandering', 'warm', 'wild', 'wise', 'young',
];

const NOUNS = [
  'ant', 'bear', 'bee', 'bird', 'brook', 'cloud', 'coral', 'crab', 'crane', 'cray',
  'crow', 'dawn', 'deer', 'dove', 'dream', 'dusk', 'eagle', 'elk', 'fawn', 'finch',
  'fish', 'flame', 'flower', 'fog', 'forest', 'fox', 'frog', 'gale', 'garden', 'glow',
  'goat', 'goose', 'grass', 'grove', 'hare', 'hawk', 'hill', 'horse', 'hound', 'jay',
  'lake', 'lark', 'leaf', 'lion', 'lynx', 'maple', 'meadow', 'moon', 'moss', 'moth',
  'mouse', 'night', 'oak', 'ocean', 'owl', 'panda', 'path', 'peak', 'pine', 'plain',
  'pond', 'rain', 'raven', 'reef', 'ridge', 'river', 'robin', 'rose', 'sage', 'seal',
  'shade', 'sheep', 'shore', 'sky', 'snake', 'snow', 'spark', 'spring', 'star', 'stone',
  'storm', 'stream', 'sun', 'swan', 'swift', 'tiger', 'tree', 'valley', 'wave', 'whale',
  'wind', 'wolf', 'wood', 'wren',
];

/**
 * Generate a random readable ID in adjective-adjective-noun format
 */
function generatePlanId(): string {
  const adj1 = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const adj2 = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];

  // Ensure adjectives are different
  let finalAdj2 = adj2;
  while (finalAdj2 === adj1) {
    finalAdj2 = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  }

  return `${adj1}-${finalAdj2}-${noun}`;
}

/**
 * Extract title from plan content (first # heading or first line)
 */
function extractTitle(content: string): string {
  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('# ')) {
      return trimmed.slice(2).trim();
    }
    if (trimmed.length > 0) {
      // Use first non-empty line as title, truncated
      return trimmed.length > 50 ? trimmed.slice(0, 50) + '...' : trimmed;
    }
  }

  return 'Untitled Plan';
}

/**
 * Ensure plans directory exists
 */
async function ensurePlansDir(cwd: string): Promise<string> {
  const plansDir = await getPlansDir(cwd);
  await fs.mkdir(plansDir, { recursive: true });
  return plansDir;
}

/**
 * Create a new plan
 */
export async function createPlan(
  cwd: string,
  content: string,
  options: { title?: string; status?: Plan['status'] } = {}
): Promise<Plan> {
  const plansDir = await ensurePlansDir(cwd);

  // Generate unique ID
  let id = generatePlanId();
  let attempts = 0;
  while (attempts < 10) {
    const planPath = path.join(plansDir, `${id}.md`);
    try {
      await fs.access(planPath);
      // File exists, generate new ID
      id = generatePlanId();
      attempts++;
    } catch {
      // File doesn't exist, we can use this ID
      break;
    }
  }

  const now = new Date();
  const plan: Plan = {
    id,
    title: options.title || extractTitle(content),
    content,
    createdAt: now,
    updatedAt: now,
    status: options.status || 'draft',
  };

  // Write plan file with metadata in frontmatter
  const fileContent = formatPlanFile(plan);
  const planPath = path.join(plansDir, `${id}.md`);
  await fs.writeFile(planPath, fileContent, 'utf-8');

  return plan;
}

/**
 * Format plan as markdown file with YAML frontmatter
 */
function formatPlanFile(plan: Plan): string {
  const frontmatter = [
    '---',
    `id: ${plan.id}`,
    `title: "${plan.title.replace(/"/g, '\\"')}"`,
    `status: ${plan.status}`,
    `createdAt: ${plan.createdAt.toISOString()}`,
    `updatedAt: ${plan.updatedAt.toISOString()}`,
    '---',
    '',
  ].join('\n');

  return frontmatter + plan.content;
}

/**
 * Parse plan from markdown file content
 */
function parsePlanFile(id: string, content: string): Plan {
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);

  if (frontmatterMatch) {
    const [, frontmatter, body] = frontmatterMatch;
    const metadata: Record<string, string> = {};

    // Parse YAML-like frontmatter
    for (const line of frontmatter.split('\n')) {
      const colonIndex = line.indexOf(':');
      if (colonIndex > 0) {
        const key = line.slice(0, colonIndex).trim();
        let value = line.slice(colonIndex + 1).trim();
        // Remove quotes
        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        metadata[key] = value;
      }
    }

    return {
      id: metadata.id || id,
      title: metadata.title || extractTitle(body),
      content: body.trim(),
      createdAt: metadata.createdAt ? new Date(metadata.createdAt) : new Date(),
      updatedAt: metadata.updatedAt ? new Date(metadata.updatedAt) : new Date(),
      status: (metadata.status as Plan['status']) || 'draft',
    };
  }

  // No frontmatter, treat entire content as plan
  return {
    id,
    title: extractTitle(content),
    content: content.trim(),
    createdAt: new Date(),
    updatedAt: new Date(),
    status: 'draft',
  };
}

/**
 * Get a plan by ID
 */
export async function getPlan(cwd: string, id: string): Promise<Plan | null> {
  const plansDir = await getPlansDir(cwd);
  const planPath = path.join(plansDir, `${id}.md`);

  try {
    const content = await fs.readFile(planPath, 'utf-8');
    return parsePlanFile(id, content);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

/**
 * Update an existing plan
 */
export async function updatePlan(
  cwd: string,
  id: string,
  updates: Partial<Omit<Plan, 'id' | 'createdAt'>>
): Promise<Plan> {
  const existing = await getPlan(cwd, id);

  if (!existing) {
    throw new Error(`Plan not found: ${id}`);
  }

  const updated: Plan = {
    ...existing,
    ...updates,
    updatedAt: new Date(),
  };

  const plansDir = await getPlansDir(cwd);
  const planPath = path.join(plansDir, `${id}.md`);
  const fileContent = formatPlanFile(updated);
  await fs.writeFile(planPath, fileContent, 'utf-8');

  return updated;
}

/**
 * List all plans
 */
export async function listPlans(cwd: string): Promise<Plan[]> {
  const plansDir = await getPlansDir(cwd);

  try {
    const files = await fs.readdir(plansDir);
    const plans: Plan[] = [];

    for (const file of files) {
      if (file.endsWith('.md')) {
        const id = file.slice(0, -3);
        const plan = await getPlan(cwd, id);
        if (plan) {
          plans.push(plan);
        }
      }
    }

    // Sort by updatedAt descending (newest first)
    return plans.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

/**
 * Delete a plan
 */
export async function deletePlan(cwd: string, id: string): Promise<boolean> {
  const plansDir = await getPlansDir(cwd);
  const planPath = path.join(plansDir, `${id}.md`);

  try {
    await fs.unlink(planPath);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return false;
    }
    throw error;
  }
}

/**
 * Get plans by status
 */
export async function getPlansByStatus(
  cwd: string,
  status: Plan['status']
): Promise<Plan[]> {
  const plans = await listPlans(cwd);
  return plans.filter((plan) => plan.status === status);
}

/**
 * Get the most recent plan
 */
export async function getLatestPlan(cwd: string): Promise<Plan | null> {
  const plans = await listPlans(cwd);
  return plans[0] || null;
}
