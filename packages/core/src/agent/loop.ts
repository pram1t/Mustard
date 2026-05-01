/**
 * Agent Loop
 *
 * Core orchestration engine that connects the LLM and Tools.
 * Manages the conversation loop, tool execution, and event streaming.
 */

import { randomUUID } from 'crypto';
import type { Message, ChatParams, ToolCall, StreamChunk, ToolDefinition } from '@pram1t/mustard-llm';
import type { LLMRouter } from '@pram1t/mustard-llm';
import type { ToolResult, ExecutionContext, ISubagentManager } from '@pram1t/mustard-tools';
import type { HookExecutor, HookResult } from '@pram1t/mustard-hooks';
import type { PermissionManager } from '../permissions/index.js';
import { getLogger } from '@pram1t/mustard-logger';
import { ContextManager } from '../context/manager.js';
import { SubagentManager } from './subagent.js';
import type {
  AgentConfig,
  AgentEvent,
  AgentState,
  RunOptions,
} from './types.js';
import { DEFAULT_AGENT_CONFIG } from './types.js';
import { executeTools } from './execution.js';
import { createSystemPrompt } from './system-prompt.js';

/**
 * Result from tool execution with hooks
 */
interface ToolExecutionResult {
  toolCallId: string;
  toolName: string;
  result: ToolResult;
  hookEvents: AgentEvent[];
}

/**
 * Agent Loop
 *
 * The main orchestration engine that:
 * 1. Receives user input
 * 2. Calls the LLM for responses
 * 3. Executes tools when requested
 * 4. Streams events back to the caller
 */
/**
 * Internal configuration type with all required fields resolved
 */
interface ResolvedAgentConfig {
  tools: AgentConfig['tools'];
  systemPrompt: string;
  maxIterations: number;
  contextConfig: Partial<import('../context/types').ContextConfig>;
  cwd: string;
  sessionId: string;
  homeDir: string;
  hooks?: HookExecutor;
  permissions?: PermissionManager;
  enableSubagents: boolean;
}

export class AgentLoop {
  private config: ResolvedAgentConfig;
  private router: LLMRouter;
  private context: ContextManager;
  private state: AgentState;
  private initialized = false;
  private subagentManager?: SubagentManager;

  /**
   * Create a new agent loop.
   *
   * @param router - LLM router for making chat requests
   * @param config - Agent configuration
   */
  constructor(router: LLMRouter, config: AgentConfig) {
    this.router = router;

    // Resolve cwd first since it's used in system prompt generation
    const cwd = config.cwd || process.cwd();

    // Generate OS-aware system prompt with cwd if not explicitly provided
    const systemPrompt = config.systemPrompt
      || createSystemPrompt({ cwd });

    const homeDir = config.homeDir || process.env.HOME || process.env.USERPROFILE || '';
    const sessionId = config.sessionId || this.generateSessionId();

    this.config = {
      tools: config.tools,
      systemPrompt,
      maxIterations: config.maxIterations || DEFAULT_AGENT_CONFIG.maxIterations,
      contextConfig: config.contextConfig || {},
      cwd,
      sessionId,
      homeDir,
      hooks: config.hooks,
      permissions: config.permissions,
      enableSubagents: config.enableSubagents ?? false,
    };

    // Create subagent manager if enabled
    if (this.config.enableSubagents) {
      this.subagentManager = new SubagentManager(
        router,
        config.tools,
        cwd,
        homeDir
      );
    }

    // Create context manager using the router's primary provider
    const provider = router.getPrimaryProvider();
    this.context = new ContextManager(
      config.contextConfig || {},
      provider
    );

    // Initialize state
    this.state = {
      iteration: 0,
      toolCallCount: 0,
      isRunning: false,
    };
  }

  /**
   * Initialize the agent (set system prompt).
   * Called automatically on first run, but can be called manually.
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    await this.context.setSystemMessage(this.config.systemPrompt);
    this.initialized = true;
  }

  /**
   * Run the agent with a user message.
   *
   * @param userMessage - The user's input message
   * @param options - Run options (signal, maxIterations override)
   * @yields AgentEvent - Events as the agent processes
   */
  async *run(userMessage: string, options: RunOptions = {}): AsyncGenerator<AgentEvent> {
    const logger = getLogger();
    const maxIterations = options.maxIterations || this.config.maxIterations;
    const signal = options.signal;
    const hooks = this.config.hooks;

    // Initialize if needed
    await this.initialize();

    // Reset state for this run
    this.state = {
      iteration: 0,
      toolCallCount: 0,
      isRunning: true,
    };

    // Trigger session_start hook
    if (hooks?.hasHooks('session_start')) {
      const hookResult = await hooks.trigger('session_start', {});
      yield* this.emitHookEvents('session_start', hookResult, hooks.getHookCount('session_start'));
      if (hookResult.blocked) {
        yield { type: 'error', error: hookResult.output || 'Blocked by session_start hook', recoverable: false };
        return;
      }
    }

    // Trigger user_prompt_submit hook (can modify message)
    let processedMessage = userMessage;
    if (hooks?.hasHooks('user_prompt_submit')) {
      const hookResult = await hooks.trigger('user_prompt_submit', { message: userMessage });
      yield* this.emitHookEvents('user_prompt_submit', hookResult, hooks.getHookCount('user_prompt_submit'));
      if (hookResult.blocked) {
        yield { type: 'error', error: hookResult.output || 'Blocked by user_prompt_submit hook', recoverable: false };
        return;
      }
      if (hookResult.modifiedMessage !== undefined) {
        processedMessage = hookResult.modifiedMessage;
        logger.debug('Message modified by hook', { original: userMessage.slice(0, 50), modified: processedMessage.slice(0, 50) });
      }
    }

    // Add user message to context
    const userMsg: Message = { role: 'user', content: processedMessage };
    await this.context.addMessage(userMsg);

    logger.info('Agent run started', {
      sessionId: this.config.sessionId,
      messageLength: processedMessage.length,
    });

    try {
      // Main agent loop
      while (this.state.iteration < maxIterations) {
        // Check for abort
        if (signal?.aborted) {
          yield { type: 'error', error: 'Aborted', recoverable: false };
          break;
        }

        this.state.iteration++;

        // Emit thinking event
        yield { type: 'thinking', iteration: this.state.iteration };

        // Check if context needs compaction
        if (this.context.needsCompaction()) {
          const stateBefore = this.context.getState();
          await this.context.compact();
          const stateAfter = this.context.getState();

          yield {
            type: 'compaction',
            messagesRemoved: stateBefore.messages.length - stateAfter.messages.length,
            tokensRemoved: stateBefore.tokenCount - stateAfter.tokenCount,
          };
        }

        // Build chat params
        const chatParams = this.buildChatParams();

        // Call LLM
        const toolCalls: ToolCall[] = [];
        let assistantContent = '';

        try {
          for await (const chunk of this.router.chat(chatParams)) {
            // Check for abort during streaming
            if (signal?.aborted) {
              yield { type: 'error', error: 'Aborted', recoverable: false };
              return;
            }

            const event = this.processChunk(chunk, toolCalls);
            if (event) {
              // Accumulate text for the assistant message
              if (event.type === 'text') {
                assistantContent += event.content;
              }
              yield event;
            }
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          logger.error('LLM chat error', { error: errorMsg, iteration: this.state.iteration });
          yield { type: 'error', error: errorMsg, recoverable: false };
          break;
        }

        // Add assistant message to context (even if empty, to maintain structure)
        if (assistantContent || toolCalls.length > 0) {
          const assistantMsg: Message = {
            role: 'assistant',
            content: assistantContent,
            // Include tool_calls if any - required by OpenAI API
            ...(toolCalls.length > 0 && { tool_calls: toolCalls }),
          };
          await this.context.addMessage(assistantMsg);
        }

        // If no tool calls, we're done
        if (toolCalls.length === 0) {
          break;
        }

        // Emit tool call events
        for (const toolCall of toolCalls) {
          yield { type: 'tool_call', tool_call: toolCall };
        }

        // Execute tools with pre/post hooks
        const results = await this.executeToolCallsWithHooks(toolCalls, signal);

        // Add tool results to context and emit events
        for (const { toolCallId, toolName, result, hookEvents } of results) {
          // Emit any hook events first
          for (const event of hookEvents) {
            yield event;
          }

          // Emit tool result event
          yield {
            type: 'tool_result',
            tool_call_id: toolCallId,
            tool_name: toolName,
            result,
          };

          // Add tool result message to context
          const toolMsg: Message = {
            role: 'tool',
            content: typeof result.output === 'string'
              ? result.output
              : JSON.stringify(result.output),
            tool_call_id: toolCallId,
            name: toolName,
          };
          await this.context.addMessage(toolMsg);
        }

        this.state.toolCallCount += toolCalls.length;
      }

      // Check if we hit max iterations
      if (this.state.iteration >= maxIterations) {
        logger.warn('Max iterations reached', {
          maxIterations,
          sessionId: this.config.sessionId,
        });
        yield {
          type: 'error',
          error: `Maximum iterations (${maxIterations}) reached`,
          recoverable: true,
        };
      }

      // Emit done event
      yield {
        type: 'done',
        totalIterations: this.state.iteration,
        totalToolCalls: this.state.toolCallCount,
      };

    } finally {
      // Trigger stop hook
      if (hooks?.hasHooks('stop')) {
        const hookResult = await hooks.trigger('stop', {});
        // Emit hook events but don't block on stop
        for (const event of this.collectHookEvents('stop', hookResult, hooks.getHookCount('stop'))) {
          // We can't yield in finally, so just log
          if (event.type === 'hook_output') {
            logger.info('Stop hook output', { output: event.output });
          }
        }
      }

      this.state.isRunning = false;
      logger.info('Agent run completed', {
        sessionId: this.config.sessionId,
        iterations: this.state.iteration,
        toolCalls: this.state.toolCallCount,
      });
    }
  }

  /**
   * Get the current agent state.
   */
  getState(): AgentState {
    return { ...this.state };
  }

  /**
   * Get the context manager for direct access.
   */
  getContext(): ContextManager {
    return this.context;
  }

  /**
   * Clear the conversation history (except system message).
   */
  async reset(): Promise<void> {
    this.context.clear();
    this.initialized = false;
    this.state = {
      iteration: 0,
      toolCallCount: 0,
      isRunning: false,
    };
    await this.initialize();
  }

  /**
   * Build chat parameters for the LLM.
   */
  private buildChatParams(): ChatParams {
    const messages = this.context.getMessages();
    const toolDefinitions = this.config.tools.getDefinitions();

    return {
      messages,
      tools: toolDefinitions.length > 0 ? toolDefinitions as ToolDefinition[] : undefined,
      tool_choice: toolDefinitions.length > 0 ? 'auto' : undefined,
    };
  }

  /**
   * Process a stream chunk and return an agent event if applicable.
   */
  private processChunk(chunk: StreamChunk, toolCalls: ToolCall[]): AgentEvent | null {
    switch (chunk.type) {
      case 'text':
        return { type: 'text', content: chunk.content };

      case 'tool_call':
        toolCalls.push(chunk.tool_call);
        return null; // Don't emit yet, will batch emit after stream

      case 'error':
        return { type: 'error', error: chunk.error, recoverable: false };

      case 'usage':
        // Could emit a usage event, but for now just log
        getLogger().debug('Token usage', {
          input: chunk.input_tokens,
          output: chunk.output_tokens,
        });
        return null;

      case 'done':
        return null; // Agent handles its own done event

      default:
        return null;
    }
  }

  /**
   * Execute tool calls with pre/post hooks and permission checks.
   */
  private async executeToolCallsWithHooks(
    toolCalls: ToolCall[],
    signal?: AbortSignal
  ): Promise<Array<ToolExecutionResult>> {
    const logger = getLogger();
    const hooks = this.config.hooks;
    const permissions = this.config.permissions;
    const results: ToolExecutionResult[] = [];

    const executionContext: ExecutionContext = {
      cwd: this.config.cwd,
      sessionId: this.config.sessionId,
      homeDir: this.config.homeDir,
      config: {},
      signal,
      subagentManager: this.subagentManager as ISubagentManager | undefined,
    };

    for (const toolCall of toolCalls) {
      const hookEvents: AgentEvent[] = [];
      let params = toolCall.arguments;

      // Pre-tool hook
      if (hooks?.hasHooks('pre_tool_use')) {
        const hookResult = await hooks.trigger('pre_tool_use', {
          tool: toolCall.name,
          params,
        });
        hookEvents.push(...this.collectHookEvents('pre_tool_use', hookResult, hooks.getHookCount('pre_tool_use')));

        if (hookResult.blocked) {
          // Tool was blocked by hook
          results.push({
            toolCallId: toolCall.id,
            toolName: toolCall.name,
            result: {
              success: false,
              output: '',
              error: hookResult.output || `Tool ${toolCall.name} blocked by pre_tool_use hook`,
            },
            hookEvents,
          });
          continue;
        }

        // Apply modified params if any
        if (hookResult.modifiedParams !== undefined) {
          params = hookResult.modifiedParams as Record<string, unknown>;
          logger.debug('Tool params modified by hook', { tool: toolCall.name });
        }
      }

      // Permission check (after pre-hook, before tool execution)
      if (permissions) {
        const permResult = await permissions.check({
          tool: toolCall.name,
          params,
          sessionId: this.config.sessionId,
        });

        if (permResult.decision === 'deny') {
          // Tool was denied by permission system
          hookEvents.push({
            type: 'permission_denied',
            tool: toolCall.name,
            reason: permResult.reason,
          });
          results.push({
            toolCallId: toolCall.id,
            toolName: toolCall.name,
            result: {
              success: false,
              output: '',
              error: `Permission denied: ${permResult.reason}`,
            },
            hookEvents,
          });
          logger.debug('Tool blocked by permission system', {
            tool: toolCall.name,
            reason: permResult.reason,
          });
          continue;
        }

        if (permResult.decision === 'ask') {
          // Emit ask event
          hookEvents.push({
            type: 'permission_ask',
            tool: toolCall.name,
            reason: permResult.reason,
            approved: permResult.userApproved,
          });

          if (!permResult.userApproved) {
            // User declined or no callback to ask
            results.push({
              toolCallId: toolCall.id,
              toolName: toolCall.name,
              result: {
                success: false,
                output: '',
                error: `Requires approval: ${permResult.reason}`,
              },
              hookEvents,
            });
            logger.debug('Tool requires user approval', {
              tool: toolCall.name,
              reason: permResult.reason,
            });
            continue;
          }
        }
      }

      // Execute the tool
      const tool = this.config.tools.get(toolCall.name);
      let result: ToolResult;

      if (!tool) {
        result = {
          success: false,
          output: '',
          error: `Tool not found: ${toolCall.name}`,
        };
      } else {
        try {
          result = await tool.execute(params, executionContext);
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          result = {
            success: false,
            output: '',
            error: `Tool execution error: ${errorMsg}`,
          };
        }
      }

      // Post-tool hook
      if (hooks?.hasHooks('post_tool_use')) {
        const hookResult = await hooks.trigger('post_tool_use', {
          tool: toolCall.name,
          params,
          result,
        });
        hookEvents.push(...this.collectHookEvents('post_tool_use', hookResult, hooks.getHookCount('post_tool_use')));
        // Post hooks can't block, but could add output
      }

      results.push({
        toolCallId: toolCall.id,
        toolName: toolCall.name,
        result,
        hookEvents,
      });
    }

    return results;
  }

  /**
   * Emit hook events as a generator.
   */
  private *emitHookEvents(
    event: import('@pram1t/mustard-hooks').HookEvent,
    hookResult: HookResult,
    hookCount: number
  ): Generator<AgentEvent> {
    for (const e of this.collectHookEvents(event, hookResult, hookCount)) {
      yield e;
    }
  }

  /**
   * Collect hook events into an array.
   */
  private collectHookEvents(
    event: import('@pram1t/mustard-hooks').HookEvent,
    hookResult: HookResult,
    hookCount: number
  ): AgentEvent[] {
    const events: AgentEvent[] = [];

    // Always emit triggered event
    events.push({ type: 'hook_triggered', event, hookCount });

    // Emit blocked event if blocked
    if (hookResult.blocked) {
      events.push({ type: 'hook_blocked', event, reason: hookResult.output });
    }

    // Emit output event if there's output
    if (hookResult.output) {
      events.push({ type: 'hook_output', event, output: hookResult.output });
    }

    return events;
  }

  /**
   * Execute tool calls and return results (legacy method, use executeToolCallsWithHooks).
   */
  private async executeToolCalls(
    toolCalls: ToolCall[],
    signal?: AbortSignal
  ): Promise<Map<string, ToolResult>> {
    const executionContext: ExecutionContext = {
      cwd: this.config.cwd,
      sessionId: this.config.sessionId,
      homeDir: this.config.homeDir,
      config: {},
      signal,
    };

    return executeTools(toolCalls, this.config.tools, executionContext);
  }

  /**
   * Generate a unique session ID using cryptographically secure random values.
   */
  private generateSessionId(): string {
    return `session_${randomUUID()}`;
  }
}

/**
 * Create an agent loop with simplified configuration.
 *
 * @param router - LLM router
 * @param config - Agent configuration
 * @returns AgentLoop instance
 */
export function createAgent(router: LLMRouter, config: AgentConfig): AgentLoop {
  return new AgentLoop(router, config);
}
