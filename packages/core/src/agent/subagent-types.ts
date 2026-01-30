/**
 * Subagent Types
 *
 * Type definitions for the subagent system that allows spawning isolated agent instances.
 */

/**
 * Available subagent types
 */
export type SubagentType = 'Explore' | 'Plan' | 'Bash' | 'general-purpose';

/**
 * Configuration for spawning a subagent
 */
export interface SubagentConfig {
  /**
   * Short description of what the subagent will do (3-5 words)
   */
  description: string;

  /**
   * The task prompt for the subagent
   */
  prompt: string;

  /**
   * Type of subagent to spawn
   */
  subagent_type: SubagentType;

  /**
   * Run the subagent in the background
   */
  run_in_background?: boolean;

  /**
   * Maximum turns (API round-trips) before stopping
   */
  max_turns?: number;

  /**
   * Optional model override
   */
  model?: string;

  /**
   * Agent ID to resume from a previous execution
   */
  resume?: string;
}

/**
 * Result from a subagent execution
 */
export interface SubagentResult {
  /**
   * Unique ID for this subagent instance
   */
  agentId: string;

  /**
   * The output from the subagent
   */
  output: string;

  /**
   * Whether the subagent completed successfully
   */
  success: boolean;

  /**
   * Error message if the subagent failed
   */
  error?: string;

  /**
   * Token usage statistics
   */
  usage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
}

/**
 * Definition for a built-in subagent type
 */
export interface SubagentTypeDefinition {
  /**
   * Description of when to use this subagent type
   */
  description: string;

  /**
   * Tools available to this subagent type
   * Use '*' for all tools (except Task to prevent recursion)
   */
  tools: string[] | '*';

  /**
   * Custom system prompt additions for this subagent type
   */
  systemPromptAddition?: string;

  /**
   * Maximum turns for this subagent type
   */
  maxTurns: number;
}

/**
 * Built-in subagent type definitions
 */
export const SUBAGENT_TYPES: Record<SubagentType, SubagentTypeDefinition> = {
  /**
   * Explore - Fast codebase exploration
   * Limited tools for quick searches
   */
  Explore: {
    description: 'Fast agent specialized for exploring codebases. Use for finding files, searching code, and answering questions about the codebase.',
    tools: ['Read', 'Glob', 'Grep'],
    systemPromptAddition: 'You are a codebase exploration specialist. Focus on quickly finding relevant files and code. Be concise in your findings.',
    maxTurns: 20,
  },

  /**
   * Plan - Implementation planning
   * Full tool access for thorough analysis
   */
  Plan: {
    description: 'Software architect agent for designing implementation plans. Use for planning strategy, identifying critical files, and considering trade-offs.',
    tools: '*',
    systemPromptAddition: 'You are a software architect. Analyze the codebase thoroughly and create detailed implementation plans. Consider edge cases and architectural implications.',
    maxTurns: 50,
  },

  /**
   * Bash - Command execution
   * Only Bash tool for running commands
   */
  Bash: {
    description: 'Command execution specialist for running bash commands. Use for git operations, builds, and terminal tasks.',
    tools: ['Bash'],
    systemPromptAddition: 'You are a command execution specialist. Execute commands efficiently and report results clearly.',
    maxTurns: 10,
  },

  /**
   * general-purpose - Any task
   * Full tool access for flexible use
   */
  'general-purpose': {
    description: 'General-purpose agent for any task. Has access to all tools and can handle complex multi-step operations.',
    tools: '*',
    systemPromptAddition: 'You are a general-purpose assistant. Complete the assigned task thoroughly and efficiently.',
    maxTurns: 30,
  },
};

/**
 * Validate that a subagent type is valid
 */
export function isValidSubagentType(type: string): type is SubagentType {
  return type in SUBAGENT_TYPES;
}

/**
 * Get the definition for a subagent type
 */
export function getSubagentTypeDefinition(type: SubagentType): SubagentTypeDefinition {
  return SUBAGENT_TYPES[type];
}
