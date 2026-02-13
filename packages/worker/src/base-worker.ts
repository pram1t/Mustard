/**
 * OpenAgent V2 - BaseWorker
 *
 * Wraps AgentLoop via composition to create a specialized worker
 * with role-specific tools, prompt, and capabilities.
 */

import { randomUUID } from 'node:crypto';
import { AgentLoop } from '@openagent/core';
import type { AgentConfig, AgentEvent } from '@openagent/core';
import type { LLMRouter } from '@openagent/llm';
import type { IToolRegistry, Tool } from '@openagent/tools';
import { ToolRegistry } from '@openagent/tools';
import { buildWorkerPrompt } from './prompt-builder.js';
import type { IWorker, WorkerConfig, WorkerDefinition, WorkerStatus } from './types.js';

/**
 * Base worker implementation that composes an AgentLoop with
 * role-specific filtering and prompt configuration.
 */
export class BaseWorker implements IWorker {
  readonly id: string;
  readonly role: WorkerDefinition['role'];
  readonly name: string;

  private _status: WorkerStatus = 'idle';
  private readonly definition: WorkerDefinition;
  private readonly router: LLMRouter;
  private readonly tools: IToolRegistry;
  private readonly config: WorkerConfig;
  private readonly systemPrompt: string;

  constructor(
    definition: WorkerDefinition,
    router: LLMRouter,
    parentTools: IToolRegistry,
    config: WorkerConfig
  ) {
    this.id = randomUUID();
    this.definition = definition;
    this.role = definition.role;
    this.name = definition.name;
    this.router = router;
    this.config = config;

    // Build filtered tool registry
    this.tools = this.filterTools(parentTools);

    // Build system prompt
    this.systemPrompt = buildWorkerPrompt(definition, config.systemPromptOverride);
  }

  /**
   * Filter the parent tool registry based on the worker's tool configuration.
   * If `allowed` is empty, all tools are available (minus denied).
   * If `allowed` is non-empty, only those tools are available (minus denied).
   */
  private filterTools(parentTools: IToolRegistry): IToolRegistry {
    const filtered = new ToolRegistry();
    const allTools = parentTools.getAll();
    const { allowed, denied } = this.definition.tools;

    for (const tool of allTools) {
      const toolName = (tool as Tool).name ?? '';

      // Skip denied tools
      if (denied.length > 0 && denied.includes(toolName)) {
        continue;
      }

      // If allowed list is specified, only include those
      if (allowed.length > 0 && !allowed.includes(toolName)) {
        continue;
      }

      filtered.register(tool as Tool);
    }

    return filtered;
  }

  get status(): WorkerStatus {
    return this._status;
  }

  getStatus(): WorkerStatus {
    return this._status;
  }

  /**
   * Run the worker with a prompt.
   * Creates a fresh AgentLoop for each run (stateless between runs).
   */
  async *run(prompt: string, _taskId?: string): AsyncGenerator<AgentEvent> {
    this._status = 'working';

    try {
      const agentConfig: AgentConfig = {
        tools: this.tools,
        systemPrompt: this.systemPrompt,
        maxIterations: this.config.maxIterations ?? 50,
        cwd: this.config.cwd ?? process.cwd(),
        sessionId: this.config.sessionId,
      };

      const loop = new AgentLoop(this.router, agentConfig);
      await loop.initialize();

      for await (const event of loop.run(prompt)) {
        yield event;
      }

      this._status = 'idle';
    } catch (err) {
      this._status = 'error';
      throw err;
    }
  }
}
