/**
 * Subagent Manager
 *
 * Manages the lifecycle of subagents - isolated agent instances that can be
 * spawned to handle specialized tasks.
 */

import { randomUUID } from 'crypto';
import type { LLMRouter } from '@openagent/llm';
import type { IToolRegistry, Tool } from '@openagent/tools';
import { ToolRegistry } from '@openagent/tools';
import { getLogger } from '@openagent/logger';
import { AgentLoop } from './loop.js';
import {
  type SubagentConfig,
  type SubagentResult,
  type SubagentType,
  isValidSubagentType,
  getSubagentTypeDefinition,
} from './subagent-types.js';
import { createSystemPrompt } from './system-prompt.js';

/**
 * Running subagent entry for tracking background tasks
 */
interface RunningSubagent {
  agentId: string;
  loop: AgentLoop;
  startedAt: number;
  output: string[];
  completed: boolean;
  result?: SubagentResult;
}

/**
 * SubagentManager
 *
 * Creates and manages isolated agent instances for specialized tasks.
 */
export class SubagentManager {
  private router: LLMRouter;
  private parentTools: IToolRegistry;
  private cwd: string;
  private homeDir: string;
  private runningAgents: Map<string, RunningSubagent> = new Map();

  /**
   * Create a new SubagentManager.
   *
   * @param router - LLM router for creating subagent loops
   * @param parentTools - Parent's tool registry to filter from
   * @param cwd - Working directory for subagents
   * @param homeDir - Home directory for tools
   */
  constructor(
    router: LLMRouter,
    parentTools: IToolRegistry,
    cwd: string,
    homeDir: string
  ) {
    this.router = router;
    this.parentTools = parentTools;
    this.cwd = cwd;
    this.homeDir = homeDir;
  }

  /**
   * Spawn a new subagent.
   *
   * @param config - Subagent configuration
   * @returns Promise resolving to subagent result
   */
  async spawn(config: SubagentConfig): Promise<SubagentResult> {
    const logger = getLogger();

    // Validate subagent type
    if (!isValidSubagentType(config.subagent_type)) {
      return {
        agentId: '',
        output: '',
        success: false,
        error: `Invalid subagent type: ${config.subagent_type}. Valid types: Explore, Plan, Bash, general-purpose`,
      };
    }

    // Handle resume
    if (config.resume) {
      const existing = this.runningAgents.get(config.resume);
      if (existing) {
        if (existing.completed && existing.result) {
          return existing.result;
        }
        // Agent still running, wait for completion
        return this.waitForAgent(config.resume);
      }
      return {
        agentId: config.resume,
        output: '',
        success: false,
        error: `Cannot resume agent ${config.resume}: not found or already completed`,
      };
    }

    const agentId = this.generateAgentId();
    const typeDef = getSubagentTypeDefinition(config.subagent_type);

    logger.info('Spawning subagent', {
      agentId,
      type: config.subagent_type,
      description: config.description,
    });

    // Create filtered tool registry for this subagent
    const filteredTools = this.filterTools(typeDef.tools);

    // Determine max iterations
    const maxIterations = config.max_turns || typeDef.maxTurns;

    // Build system prompt for subagent
    const systemPrompt = this.buildSubagentSystemPrompt(config, typeDef.systemPromptAddition);

    // Create subagent loop
    const loop = new AgentLoop(this.router, {
      tools: filteredTools,
      systemPrompt,
      maxIterations,
      cwd: this.cwd,
      homeDir: this.homeDir,
      sessionId: agentId,
      contextConfig: {
        maxTokens: 100000, // Smaller context for subagents
      },
    });

    // Track the running agent
    const runningAgent: RunningSubagent = {
      agentId,
      loop,
      startedAt: Date.now(),
      output: [],
      completed: false,
    };
    this.runningAgents.set(agentId, runningAgent);

    // Run in background if requested
    if (config.run_in_background) {
      this.runInBackground(runningAgent, config.prompt);
      return {
        agentId,
        output: `Subagent ${agentId} started in background. Use TaskOutput to check results.`,
        success: true,
      };
    }

    // Run synchronously
    return this.runSubagent(runningAgent, config.prompt);
  }

  /**
   * Get the result of a background subagent.
   *
   * @param agentId - The agent ID to get results for
   * @returns The subagent result or null if not found
   */
  getResult(agentId: string): SubagentResult | null {
    const agent = this.runningAgents.get(agentId);
    if (!agent) {
      return null;
    }
    if (agent.completed && agent.result) {
      return agent.result;
    }
    return {
      agentId,
      output: agent.output.join('\n'),
      success: false,
      error: 'Agent still running',
    };
  }

  /**
   * Wait for a running agent to complete.
   */
  private async waitForAgent(agentId: string): Promise<SubagentResult> {
    const agent = this.runningAgents.get(agentId);
    if (!agent) {
      return {
        agentId,
        output: '',
        success: false,
        error: 'Agent not found',
      };
    }

    // Poll until complete (with timeout)
    const timeout = 300000; // 5 minutes
    const startTime = Date.now();

    while (!agent.completed && Date.now() - startTime < timeout) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    if (!agent.completed) {
      return {
        agentId,
        output: agent.output.join('\n'),
        success: false,
        error: 'Agent timed out',
      };
    }

    return agent.result!;
  }

  /**
   * Filter tools based on subagent type configuration.
   *
   * @param allowedTools - Array of tool names or '*' for all
   * @returns Filtered tool registry
   */
  private filterTools(allowedTools: string[] | '*'): IToolRegistry {
    const registry = new ToolRegistry();
    const allTools = this.parentTools.getAll();

    for (const tool of allTools) {
      // Never include Task tool in subagents (prevent recursion)
      if (tool.name === 'Task') {
        continue;
      }

      // If '*', include all except Task
      if (allowedTools === '*') {
        registry.register(tool);
        continue;
      }

      // Otherwise, check if tool is in allowed list
      if (allowedTools.includes(tool.name)) {
        registry.register(tool);
      }
    }

    return registry;
  }

  /**
   * Build system prompt for a subagent.
   */
  private buildSubagentSystemPrompt(
    config: SubagentConfig,
    systemPromptAddition?: string
  ): string {
    // Start with base system prompt
    let prompt = createSystemPrompt({ cwd: this.cwd });

    // Add subagent-specific context
    prompt += '\n\n';
    prompt += '## Subagent Context\n\n';
    prompt += `You are a subagent spawned for a specific task.\n`;
    prompt += `Task type: ${config.subagent_type}\n`;
    prompt += `Task description: ${config.description}\n\n`;

    // Add type-specific additions
    if (systemPromptAddition) {
      prompt += systemPromptAddition + '\n\n';
    }

    // Add constraints
    prompt += '## Subagent Constraints\n\n';
    prompt += '- Focus on completing the assigned task efficiently\n';
    prompt += '- Return a clear, concise summary of your findings or actions\n';
    prompt += '- Do not spawn additional subagents\n';

    return prompt;
  }

  /**
   * Run a subagent synchronously.
   */
  private async runSubagent(
    agent: RunningSubagent,
    prompt: string
  ): Promise<SubagentResult> {
    const logger = getLogger();

    try {
      const outputParts: string[] = [];

      for await (const event of agent.loop.run(prompt)) {
        switch (event.type) {
          case 'text':
            outputParts.push(event.content);
            agent.output.push(event.content);
            break;
          case 'error':
            logger.warn('Subagent error', { agentId: agent.agentId, error: event.error });
            break;
          case 'done':
            logger.debug('Subagent completed', {
              agentId: agent.agentId,
              iterations: event.totalIterations,
              toolCalls: event.totalToolCalls,
            });
            break;
        }
      }

      const output = outputParts.join('');
      const result: SubagentResult = {
        agentId: agent.agentId,
        output,
        success: true,
      };

      agent.completed = true;
      agent.result = result;

      // Clean up after a delay
      setTimeout(() => {
        this.runningAgents.delete(agent.agentId);
      }, 60000); // Keep for 1 minute for potential queries

      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error('Subagent execution error', { agentId: agent.agentId, error: errorMsg });

      const result: SubagentResult = {
        agentId: agent.agentId,
        output: agent.output.join(''),
        success: false,
        error: errorMsg,
      };

      agent.completed = true;
      agent.result = result;

      return result;
    }
  }

  /**
   * Run a subagent in the background.
   */
  private runInBackground(agent: RunningSubagent, prompt: string): void {
    const logger = getLogger();

    // Fire and forget - run in background
    this.runSubagent(agent, prompt).catch((error) => {
      logger.error('Background subagent failed', {
        agentId: agent.agentId,
        error: String(error),
      });
    });
  }

  /**
   * Generate a unique agent ID.
   */
  private generateAgentId(): string {
    return `subagent_${Date.now()}_${randomUUID().substring(0, 8)}`;
  }

  /**
   * Get count of running agents.
   */
  getRunningCount(): number {
    return Array.from(this.runningAgents.values()).filter((a) => !a.completed).length;
  }

  /**
   * List all agent IDs (running and completed).
   */
  listAgents(): string[] {
    return Array.from(this.runningAgents.keys());
  }
}
