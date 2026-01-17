# Agent Loop

This document describes the core agent loop that orchestrates the AI assistant's behavior.

## Overview

The agent loop is the heart of OpenAgent. It implements the gather-act-verify-repeat pattern:

```
┌─────────────────────────────────────────────────────────────┐
│                      AGENT LOOP                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│    ┌──────────────┐                                         │
│    │  User Input  │                                         │
│    └──────┬───────┘                                         │
│           │                                                  │
│           ▼                                                  │
│    ┌──────────────┐                                         │
│    │   Context    │◀────────────────────────┐               │
│    │   Manager    │                         │               │
│    └──────┬───────┘                         │               │
│           │                                  │               │
│           ▼                                  │               │
│    ┌──────────────┐                         │               │
│    │     LLM      │                         │               │
│    │    Router    │                         │               │
│    └──────┬───────┘                         │               │
│           │                                  │               │
│     ┌─────┴─────┐                           │               │
│     │           │                           │               │
│     ▼           ▼                           │               │
│  ┌──────┐  ┌──────────┐                     │               │
│  │ Text │  │  Tool    │                     │               │
│  │Output│  │  Calls   │                     │               │
│  └──┬───┘  └────┬─────┘                     │               │
│     │           │                           │               │
│     │           ▼                           │               │
│     │    ┌──────────────┐                   │               │
│     │    │  Permission  │                   │               │
│     │    │    Check     │                   │               │
│     │    └──────┬───────┘                   │               │
│     │           │                           │               │
│     │           ▼                           │               │
│     │    ┌──────────────┐                   │               │
│     │    │    Tool      │                   │               │
│     │    │  Execution   │                   │               │
│     │    └──────┬───────┘                   │               │
│     │           │                           │               │
│     │           ▼                           │               │
│     │    ┌──────────────┐                   │               │
│     │    │   Add to     │───────────────────┘               │
│     │    │   Context    │                                   │
│     │    └──────────────┘                                   │
│     │                                                        │
│     ▼                                                        │
│  ┌──────────────┐                                           │
│  │   Stream     │                                           │
│  │   to User    │                                           │
│  └──────────────┘                                           │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Implementation

```typescript
// packages/core/src/agent/loop.ts

import type { LLMRouter, StreamChunk, ToolCall } from '@openagent/llm';
import type { ToolRegistry, ExecutionContext, ToolResult } from '@openagent/tools';
import type { MCPRegistry } from '@openagent/mcp';
import type { HookExecutor } from '@openagent/hooks';
import { ContextManager } from '../context/manager';
import { PermissionManager } from '../permissions/manager';

/**
 * Events emitted during agent execution
 */
export type AgentEvent =
  | { type: 'text'; content: string }
  | { type: 'tool_call_start'; tool: string; params: Record<string, unknown> }
  | { type: 'tool_call_end'; tool: string; result: ToolResult }
  | { type: 'permission_request'; tool: string; params: Record<string, unknown> }
  | { type: 'error'; message: string }
  | { type: 'done'; usage: { input_tokens: number; output_tokens: number } };

/**
 * Configuration for the agent loop
 */
interface AgentLoopConfig {
  /** Maximum turns before stopping */
  maxTurns?: number;
  /** Whether to stream responses */
  stream?: boolean;
  /** System prompt to prepend */
  systemPrompt?: string;
}

/**
 * The core agent loop
 */
export class AgentLoop {
  private llm: LLMRouter;
  private tools: ToolRegistry;
  private mcp: MCPRegistry;
  private context: ContextManager;
  private permissions: PermissionManager;
  private hooks: HookExecutor;
  private config: AgentLoopConfig;

  constructor(
    llm: LLMRouter,
    tools: ToolRegistry,
    mcp: MCPRegistry,
    context: ContextManager,
    permissions: PermissionManager,
    hooks: HookExecutor,
    config: AgentLoopConfig = {}
  ) {
    this.llm = llm;
    this.tools = tools;
    this.mcp = mcp;
    this.context = context;
    this.permissions = permissions;
    this.hooks = hooks;
    this.config = {
      maxTurns: 100,
      stream: true,
      ...config,
    };
  }

  /**
   * Run the agent loop with a user message
   */
  async *run(userMessage: string): AsyncGenerator<AgentEvent> {
    // Trigger session start hook if this is a new session
    if (this.context.isEmpty()) {
      await this.hooks.trigger('session_start', {});

      // Add system prompt if configured
      if (this.config.systemPrompt) {
        this.context.addMessage({
          role: 'system',
          content: this.config.systemPrompt,
        });
      }
    }

    // Trigger user prompt hook
    const hookResult = await this.hooks.trigger('user_prompt_submit', {
      message: userMessage,
    });

    // Hook can modify or block the message
    if (hookResult.blocked) {
      yield { type: 'error', message: 'Message blocked by hook' };
      return;
    }

    const processedMessage = hookResult.modifiedMessage || userMessage;

    // Add user message to context
    this.context.addMessage({
      role: 'user',
      content: processedMessage,
    });

    // Get all available tools (built-in + MCP)
    const mcpTools = await this.mcp.getAllTools();
    const allTools = [...this.tools.getAll(), ...mcpTools];
    const toolDefinitions = allTools.map((t) => ({
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    }));

    let turns = 0;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    // Main agent loop
    while (turns < this.config.maxTurns!) {
      turns++;

      // Check context limits and compact if needed
      if (this.context.needsCompaction()) {
        await this.context.compact();
      }

      // Send to LLM
      const toolCalls: ToolCall[] = [];
      let textResponse = '';

      try {
        for await (const chunk of this.llm.chat({
          messages: this.context.getMessages(),
          tools: toolDefinitions,
          tool_choice: 'auto',
        })) {
          switch (chunk.type) {
            case 'text':
              textResponse += chunk.content;
              yield { type: 'text', content: chunk.content };
              break;

            case 'tool_call':
              toolCalls.push(chunk.tool_call);
              break;

            case 'usage':
              totalInputTokens += chunk.input_tokens;
              totalOutputTokens += chunk.output_tokens;
              break;
          }
        }
      } catch (error) {
        yield { type: 'error', message: `LLM error: ${error}` };
        break;
      }

      // Add assistant message to context
      if (textResponse) {
        this.context.addMessage({
          role: 'assistant',
          content: textResponse,
        });
      }

      // If no tool calls, we're done
      if (toolCalls.length === 0) {
        break;
      }

      // Execute tool calls
      const results = await this.executeToolCalls(toolCalls, allTools);

      // Yield results and add to context
      for (const { toolCall, result, events } of results) {
        // Yield any events generated during execution
        for (const event of events) {
          yield event;
        }

        // Add tool result to context
        this.context.addMessage({
          role: 'tool',
          name: toolCall.name,
          tool_call_id: toolCall.id,
          content: typeof result.output === 'string'
            ? result.output
            : JSON.stringify(result.output),
        });
      }
    }

    // Trigger stop hook
    await this.hooks.trigger('stop', {
      turns,
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
    });

    yield {
      type: 'done',
      usage: {
        input_tokens: totalInputTokens,
        output_tokens: totalOutputTokens,
      },
    };
  }

  /**
   * Execute a batch of tool calls
   */
  private async executeToolCalls(
    toolCalls: ToolCall[],
    allTools: Tool[]
  ): Promise<Array<{
    toolCall: ToolCall;
    result: ToolResult;
    events: AgentEvent[];
  }>> {
    const results: Array<{
      toolCall: ToolCall;
      result: ToolResult;
      events: AgentEvent[];
    }> = [];

    // Check which tools can be parallelized
    const parallelizable = toolCalls.filter((tc) => {
      const tool = allTools.find((t) => t.name === tc.name);
      // File operations should be sequential
      // Read-only operations can be parallel
      return tool && !['Write', 'Edit', 'Bash'].includes(tc.name);
    });

    const sequential = toolCalls.filter((tc) => !parallelizable.includes(tc));

    // Execute parallel tools concurrently
    const parallelResults = await Promise.all(
      parallelizable.map((tc) => this.executeSingleToolCall(tc, allTools))
    );
    results.push(...parallelResults);

    // Execute sequential tools one by one
    for (const toolCall of sequential) {
      const result = await this.executeSingleToolCall(toolCall, allTools);
      results.push(result);
    }

    return results;
  }

  /**
   * Execute a single tool call
   */
  private async executeSingleToolCall(
    toolCall: ToolCall,
    allTools: Tool[]
  ): Promise<{
    toolCall: ToolCall;
    result: ToolResult;
    events: AgentEvent[];
  }> {
    const events: AgentEvent[] = [];
    const tool = allTools.find((t) => t.name === toolCall.name);

    if (!tool) {
      return {
        toolCall,
        result: {
          success: false,
          output: '',
          error: `Unknown tool: ${toolCall.name}`,
        },
        events: [{ type: 'error', message: `Unknown tool: ${toolCall.name}` }],
      };
    }

    // Check permissions
    const permission = await this.permissions.check(toolCall.name, toolCall.arguments);

    if (permission === 'deny') {
      return {
        toolCall,
        result: {
          success: false,
          output: '',
          error: 'Permission denied',
        },
        events: [{ type: 'error', message: `Permission denied for ${toolCall.name}` }],
      };
    }

    if (permission === 'ask') {
      events.push({
        type: 'permission_request',
        tool: toolCall.name,
        params: toolCall.arguments,
      });

      // In actual implementation, this would wait for user approval
      // For now, we'll assume approval comes from the UI layer
      const approved = await this.permissions.requestApproval(
        toolCall.name,
        toolCall.arguments
      );

      if (!approved) {
        return {
          toolCall,
          result: {
            success: false,
            output: '',
            error: 'User denied permission',
          },
          events,
        };
      }
    }

    // Pre-tool hook
    const preHookResult = await this.hooks.trigger('pre_tool_use', {
      tool: toolCall.name,
      params: toolCall.arguments,
    });

    if (preHookResult.blocked) {
      return {
        toolCall,
        result: {
          success: false,
          output: '',
          error: 'Blocked by pre_tool_use hook',
        },
        events,
      };
    }

    // Execute tool
    events.push({
      type: 'tool_call_start',
      tool: toolCall.name,
      params: toolCall.arguments,
    });

    const context: ExecutionContext = {
      cwd: process.cwd(),
      sessionId: this.context.sessionId,
      homeDir: process.env.HOME || process.env.USERPROFILE || '',
      config: this.config as any,
      permissions: this.permissions,
      hooks: this.hooks,
    };

    let result: ToolResult;

    try {
      result = await tool.execute(toolCall.arguments, context);
    } catch (error) {
      result = {
        success: false,
        output: '',
        error: `Tool execution failed: ${error}`,
      };
    }

    events.push({
      type: 'tool_call_end',
      tool: toolCall.name,
      result,
    });

    // Post-tool hook
    await this.hooks.trigger('post_tool_use', {
      tool: toolCall.name,
      params: toolCall.arguments,
      result,
    });

    return { toolCall, result, events };
  }
}
```

## Subagent Handling

When the `Task` tool is called, the agent loop spawns a subagent:

```typescript
// packages/core/src/agent/subagent.ts

import { AgentLoop } from './loop';
import { ContextManager } from '../context/manager';

interface SubagentConfig {
  description: string;
  prompt: string;
  subagent_type: string;
  run_in_background?: boolean;
}

const SUBAGENT_TYPES: Record<string, {
  description: string;
  tools: string[];
  systemPrompt?: string;
}> = {
  'Explore': {
    description: 'Fast codebase exploration',
    tools: ['Read', 'Glob', 'Grep'],
    systemPrompt: 'You are exploring a codebase. Be thorough but concise.',
  },
  'Plan': {
    description: 'Implementation planning',
    tools: ['*'], // All tools
    systemPrompt: 'You are planning an implementation. Consider all options.',
  },
  'Bash': {
    description: 'Command execution',
    tools: ['Bash'],
    systemPrompt: 'You execute shell commands. Be careful and precise.',
  },
  'general-purpose': {
    description: 'General purpose agent',
    tools: ['*'],
  },
};

export class SubagentManager {
  private mainLoop: AgentLoop;

  constructor(mainLoop: AgentLoop) {
    this.mainLoop = mainLoop;
  }

  async spawn(config: SubagentConfig): Promise<string> {
    const subagentType = SUBAGENT_TYPES[config.subagent_type];
    if (!subagentType) {
      throw new Error(`Unknown subagent type: ${config.subagent_type}`);
    }

    // Create isolated context for subagent
    const subContext = new ContextManager({
      maxTokens: 100000, // Smaller context for subagents
    });

    // Create subagent loop with filtered tools
    // ... (similar to main loop but with restricted tools)

    // Run subagent to completion
    let result = '';
    for await (const event of subagentLoop.run(config.prompt)) {
      if (event.type === 'text') {
        result += event.content;
      }
    }

    return result;
  }
}
```

## Streaming Protocol

The agent loop emits events that can be consumed by the CLI or desktop app:

```typescript
// Event types for streaming
type AgentEvent =
  | { type: 'text'; content: string }           // Partial text response
  | { type: 'tool_call_start'; ... }            // Tool execution starting
  | { type: 'tool_call_end'; ... }              // Tool execution complete
  | { type: 'permission_request'; ... }         // Needs user approval
  | { type: 'error'; message: string }          // Error occurred
  | { type: 'done'; usage: {...} };             // Agent finished
```

## Error Recovery

```typescript
// packages/core/src/agent/error-handling.ts

interface RetryConfig {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
}

async function withRetry<T>(
  fn: () => Promise<T>,
  config: RetryConfig = { maxAttempts: 3, baseDelay: 1000, maxDelay: 30000 }
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < config.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      // Check if retryable
      if (!isRetryableError(error)) {
        throw error;
      }

      // Calculate delay with exponential backoff + jitter
      const delay = Math.min(
        config.baseDelay * Math.pow(2, attempt) + Math.random() * 1000,
        config.maxDelay
      );

      await sleep(delay);
    }
  }

  throw lastError;
}

function isRetryableError(error: any): boolean {
  // Rate limits
  if (error?.status === 429) return true;
  // Server errors
  if (error?.status >= 500) return true;
  // Network errors
  if (error?.code === 'ECONNRESET') return true;
  if (error?.code === 'ETIMEDOUT') return true;

  return false;
}
```

## Usage Example

```typescript
// Example usage from CLI
import { AgentLoop } from '@openagent/core';
import { createDefaultLLMRouter } from '@openagent/llm';
import { createDefaultRegistry } from '@openagent/tools';

async function main() {
  const llm = createDefaultLLMRouter(config);
  const tools = createDefaultRegistry();
  const mcp = new MCPRegistry();
  const context = new ContextManager();
  const permissions = new PermissionManager(config.permissions);
  const hooks = new HookExecutor(config.hooks);

  const agent = new AgentLoop(llm, tools, mcp, context, permissions, hooks, {
    systemPrompt: 'You are a helpful coding assistant.',
  });

  // Run and stream events
  for await (const event of agent.run('What files are in this directory?')) {
    switch (event.type) {
      case 'text':
        process.stdout.write(event.content);
        break;
      case 'tool_call_start':
        console.log(`\n[Calling ${event.tool}...]`);
        break;
      case 'tool_call_end':
        console.log(`[${event.tool} complete]`);
        break;
      case 'done':
        console.log(`\n[Tokens: ${event.usage.input_tokens} in, ${event.usage.output_tokens} out]`);
        break;
    }
  }
}
```

## Next Steps

- See [CONTEXT-MANAGEMENT.md](CONTEXT-MANAGEMENT.md) for context handling
- See [SUBAGENT-SYSTEM.md](SUBAGENT-SYSTEM.md) for subagent details
- See [HOOK-SYSTEM.md](HOOK-SYSTEM.md) for lifecycle hooks
