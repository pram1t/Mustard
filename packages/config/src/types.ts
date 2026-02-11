/**
 * Configuration Types
 *
 * Extended type definitions for the config system.
 * Includes resolved config tracking and source attribution.
 */

import type { Config, ProjectConfig, LLMProvider } from './schema.js';

/**
 * Source of a configuration value
 */
export type ConfigValueSource = 'cli' | 'env' | 'project' | 'global' | 'default';

/**
 * Tracks where each configuration value came from
 */
export interface ConfigSource {
  model?: ConfigValueSource;
  provider?: ConfigValueSource;
  systemPrompt?: ConfigValueSource;
  historyEnabled?: ConfigValueSource;
  todoPersistence?: ConfigValueSource;
  permissions?: ConfigValueSource;
  mcpServers?: ConfigValueSource;
  hooks?: ConfigValueSource;
}

/**
 * Resolved configuration with source tracking
 * Contains the merged config from all sources plus metadata
 */
export interface ResolvedConfig {
  /** Merged runtime configuration (env vars, Zod defaults) */
  config: Config;

  /** Project-specific configuration (from .openagent/config.json) */
  projectConfig: ProjectConfig | null;

  /** Global user configuration (from ~/.openagent/config.json) */
  globalConfig: ProjectConfig | null;

  /** Path to the project root (where .openagent/ was found) */
  projectRoot: string | null;

  /** Tracks the source of each setting */
  source: ConfigSource;

  /** Effective model after merging all sources */
  effectiveModel: string | undefined;

  /** Effective provider after merging all sources */
  effectiveProvider: LLMProvider | undefined;

  /** Effective system prompt (combines base + project) */
  effectiveSystemPrompt: string | undefined;
}

/**
 * CLI flags that can override configuration
 */
export interface CLIConfigFlags {
  model?: string;
  provider?: LLMProvider;
  verbose?: boolean;
}

/**
 * Options for loading resolved configuration
 */
export interface LoadConfigOptions {
  /** Current working directory to search from */
  cwd: string;

  /** CLI flags that override other sources */
  cliFlags?: CLIConfigFlags;

  /** Skip loading project config */
  skipProjectConfig?: boolean;

  /** Skip loading global config */
  skipGlobalConfig?: boolean;
}

/**
 * Plan document stored in .openagent/plans/
 */
export interface Plan {
  /** Unique readable ID (e.g., "recursive-prancing-cray") */
  id: string;

  /** Plan title extracted from content or generated */
  title: string;

  /** Full markdown content */
  content: string;

  /** Creation timestamp */
  createdAt: Date;

  /** Last update timestamp */
  updatedAt: Date;

  /** Plan status */
  status: 'draft' | 'approved' | 'completed' | 'abandoned';
}

/**
 * History entry stored in .openagent/history/
 */
export interface HistoryEntry {
  /** ISO timestamp */
  timestamp: string;

  /** Message role */
  role: 'user' | 'assistant' | 'system';

  /** Message content */
  content: string;

  /** Tool calls made (for assistant messages) */
  toolCalls?: Array<{
    name: string;
    args: unknown;
    result?: unknown;
  }>;

  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Skill definition (foundation types - implementation deferred)
 */
export interface Skill {
  /** Skill name (used for /skill-name invocation) */
  name: string;

  /** Human-readable description */
  description: string;

  /** Tools this skill is allowed to use */
  allowedTools?: string[];

  /** Execution context: main conversation or forked subagent */
  context?: 'main' | 'fork';

  /** Can user invoke via /skill-name */
  userInvocable?: boolean;

  /** Prevent AI from auto-invoking this skill */
  disableModelInvocation?: boolean;

  /** Markdown instructions for the AI */
  content: string;
}

/**
 * SKILL.md frontmatter format (kebab-case keys)
 */
export interface SkillFrontmatter {
  name: string;
  description: string;
  'allowed-tools'?: string[];
  context?: 'main' | 'fork';
  'user-invocable'?: boolean;
  'disable-model-invocation'?: boolean;
}
