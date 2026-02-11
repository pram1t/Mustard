/**
 * Skills Foundation Types
 *
 * Type definitions for the Skills system.
 * Implementation deferred to after Desktop-V1.
 *
 * Skills are reusable instruction sets that can be invoked by users or the model.
 * They are stored as markdown files with YAML frontmatter in .openagent/skills/
 */

import { z } from 'zod';

/**
 * Skill context determines where the skill runs
 * - 'main': Runs in the main conversation context
 * - 'fork': Runs in a separate forked context (isolated)
 */
export type SkillContext = 'main' | 'fork';

/**
 * YAML frontmatter schema for skill files
 */
export const SkillFrontmatterSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  'allowed-tools': z.array(z.string()).optional(),
  context: z.enum(['main', 'fork']).default('main'),
  'user-invocable': z.boolean().default(true),
  'disable-model-invocation': z.boolean().default(false),
  version: z.string().optional(),
  author: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

export type SkillFrontmatter = z.infer<typeof SkillFrontmatterSchema>;

/**
 * Full skill definition including parsed content
 */
export interface Skill {
  /** Unique identifier (filename without extension) */
  id: string;

  /** Human-readable name */
  name: string;

  /** Description of what the skill does */
  description: string;

  /** Tools this skill is allowed to use (undefined = all tools) */
  allowedTools?: string[];

  /** Execution context */
  context: SkillContext;

  /** Can users invoke this skill with /skillname */
  userInvocable: boolean;

  /** Prevent the model from automatically invoking this skill */
  disableModelInvocation: boolean;

  /** The skill instructions (markdown content after frontmatter) */
  content: string;

  /** Optional version string */
  version?: string;

  /** Optional author */
  author?: string;

  /** Optional tags for categorization */
  tags?: string[];

  /** Path to the skill file */
  filePath: string;

  /** Whether this is a project-local or global skill */
  scope: 'project' | 'global';
}

/**
 * Skill invocation result
 */
export interface SkillResult {
  /** The skill that was invoked */
  skillId: string;

  /** Whether the skill completed successfully */
  success: boolean;

  /** Output from the skill execution */
  output?: string;

  /** Error message if failed */
  error?: string;

  /** Tool calls made during execution */
  toolCalls?: Array<{
    tool: string;
    args: unknown;
    result?: unknown;
  }>;

  /** Execution duration in milliseconds */
  durationMs: number;
}

/**
 * Skill registry entry for quick lookup
 */
export interface SkillRegistryEntry {
  id: string;
  name: string;
  description: string;
  scope: 'project' | 'global';
  userInvocable: boolean;
  filePath: string;
}

/**
 * Options for loading skills
 */
export interface LoadSkillsOptions {
  /** Include project-local skills */
  includeProject?: boolean;

  /** Include global user skills */
  includeGlobal?: boolean;

  /** Only include user-invocable skills */
  userInvocableOnly?: boolean;

  /** Filter by tags */
  tags?: string[];
}

/**
 * Example skill file structure:
 *
 * ```markdown
 * ---
 * name: Code Review
 * description: Review code changes and provide feedback
 * allowed-tools:
 *   - Read
 *   - Glob
 *   - Grep
 * context: main
 * user-invocable: true
 * tags:
 *   - review
 *   - quality
 * ---
 *
 * # Code Review Skill
 *
 * When reviewing code, follow these guidelines:
 *
 * 1. Check for bugs and logic errors
 * 2. Review code style and consistency
 * 3. Look for security vulnerabilities
 * 4. Suggest improvements
 *
 * Use the Read tool to examine files and provide detailed feedback.
 * ```
 */

// Export everything for use by future skill loader implementation
export {
  SkillFrontmatterSchema as frontmatterSchema,
};
