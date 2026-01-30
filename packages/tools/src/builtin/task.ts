/**
 * Task Tool
 *
 * Spawns subagents to handle complex, multi-step tasks autonomously.
 * Each subagent type has specific capabilities and tools available to it.
 */

import { BaseTool } from '../base.js';
import type { ToolResult, ExecutionContext, ToolParameters } from '../types.js';

/**
 * Extended execution context with subagent manager
 */
interface TaskExecutionContext extends ExecutionContext {
  subagentManager?: {
    spawn(config: {
      description: string;
      prompt: string;
      subagent_type: string;
      run_in_background?: boolean;
      max_turns?: number;
      model?: string;
      resume?: string;
    }): Promise<{
      agentId: string;
      output: string;
      success: boolean;
      error?: string;
    }>;
    getResult(agentId: string): {
      agentId: string;
      output: string;
      success: boolean;
      error?: string;
    } | null;
  };
}

/**
 * Task Tool - Spawns subagents for specialized tasks
 */
export class TaskTool extends BaseTool {
  readonly name = 'Task';
  readonly description = `Launch a new agent to handle complex, multi-step tasks autonomously.

Available agent types:
- Explore: Fast codebase exploration. Use for finding files, searching code, answering questions about the codebase. (Tools: Read, Glob, Grep)
- Plan: Software architect for designing implementation plans. Returns step-by-step plans, identifies critical files. (Tools: All)
- Bash: Command execution specialist for running bash commands, git operations, builds. (Tools: Bash)
- general-purpose: General-purpose agent for any task. Has access to all tools for complex multi-step operations. (Tools: All)

Usage notes:
- Always include a short description (3-5 words) summarizing what the agent will do
- Provide clear, detailed prompts so the agent can work autonomously
- Use run_in_background for tasks that can run independently`;

  readonly parameters: ToolParameters = {
    type: 'object',
    properties: {
      description: {
        type: 'string',
        description: 'A short (3-5 word) description of the task',
      },
      prompt: {
        type: 'string',
        description: 'The detailed task prompt for the agent to perform',
      },
      subagent_type: {
        type: 'string',
        description: 'The type of agent to use: Explore, Plan, Bash, or general-purpose',
        enum: ['Explore', 'Plan', 'Bash', 'general-purpose'],
      },
      run_in_background: {
        type: 'boolean',
        description: 'Run this agent in the background. Use TaskOutput to check results later.',
        default: false,
      },
      max_turns: {
        type: 'integer',
        description: 'Maximum number of agentic turns (API round-trips) before stopping',
        minimum: 1,
        maximum: 100,
      },
      model: {
        type: 'string',
        description: 'Optional model override for this agent',
      },
      resume: {
        type: 'string',
        description: 'Agent ID to resume from. Continues from previous execution.',
      },
    },
    required: ['description', 'prompt', 'subagent_type'],
  };

  async execute(
    params: Record<string, unknown>,
    context: ExecutionContext
  ): Promise<ToolResult> {
    return this.safeExecute(params, context, async () => {
      const taskContext = context as TaskExecutionContext;

      // Check if subagent manager is available
      if (!taskContext.subagentManager) {
        return this.failure(
          'Subagent system is not available. The Task tool requires a SubagentManager to be configured.'
        );
      }

      const description = params.description as string;
      const prompt = params.prompt as string;
      const subagentType = params.subagent_type as string;
      const runInBackground = (params.run_in_background as boolean) || false;
      const maxTurns = params.max_turns as number | undefined;
      const model = params.model as string | undefined;
      const resume = params.resume as string | undefined;

      // Validate subagent type
      const validTypes = ['Explore', 'Plan', 'Bash', 'general-purpose'];
      if (!validTypes.includes(subagentType)) {
        return this.failure(
          `Invalid subagent_type: ${subagentType}. Valid types: ${validTypes.join(', ')}`
        );
      }

      // Spawn the subagent
      const result = await taskContext.subagentManager.spawn({
        description,
        prompt,
        subagent_type: subagentType,
        run_in_background: runInBackground,
        max_turns: maxTurns,
        model,
        resume,
      });

      if (!result.success) {
        return this.failure(result.error || 'Subagent execution failed', result.output);
      }

      // Format output based on whether it ran in background
      if (runInBackground) {
        return this.success(
          `Task started in background.\n\nAgent ID: ${result.agentId}\n\n${result.output}`,
          { agentId: result.agentId, background: true }
        );
      }

      return this.success(result.output, { agentId: result.agentId });
    });
  }
}
