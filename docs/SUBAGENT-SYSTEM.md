# Subagent System

This document describes the subagent system for parallel and specialized task execution.

## Overview

Subagents are isolated agent instances that:
- Run in their own context window
- Focus on specific task types
- Return only the final result to the parent
- Enable parallel execution of independent tasks

## Subagent Types

| Type | Purpose | Available Tools |
|------|---------|-----------------|
| `Explore` | Fast codebase exploration | Read, Glob, Grep |
| `Plan` | Implementation planning | All tools |
| `Bash` | Command execution | Bash only |
| `general-purpose` | Any task | All tools |

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    MAIN AGENT                                    │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                  Main Context Window                       │  │
│  │  User: "Analyze the codebase structure"                    │  │
│  │  Assistant: "I'll spawn explore agents..."                 │  │
│  │                                                            │  │
│  │  [Task tool call: spawn Explore subagent]                  │  │
│  └───────────────────────────────────────────────────────────┘  │
│                           │                                      │
│           ┌───────────────┼───────────────┐                     │
│           │               │               │                     │
│           ▼               ▼               ▼                     │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐               │
│  │ Subagent 1  │ │ Subagent 2  │ │ Subagent 3  │               │
│  │  (Explore)  │ │  (Explore)  │ │  (Explore)  │               │
│  │             │ │             │ │             │               │
│  │ "Find all   │ │ "Find test  │ │ "Find API   │               │
│  │  models"    │ │  patterns"  │ │  endpoints" │               │
│  │             │ │             │ │             │               │
│  │ Own context │ │ Own context │ │ Own context │               │
│  │ window      │ │ window      │ │ window      │               │
│  └──────┬──────┘ └──────┬──────┘ └──────┬──────┘               │
│         │               │               │                       │
│         ▼               ▼               ▼                       │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │               Results aggregated back                    │   │
│  │               to main context                            │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## Subagent Configuration

```typescript
// packages/core/src/agent/subagent.ts

/**
 * Configuration for spawning a subagent
 */
interface SubagentConfig {
  /** Short description of the task */
  description: string;

  /** Detailed prompt for the subagent */
  prompt: string;

  /** Type of subagent to spawn */
  subagent_type: 'Explore' | 'Plan' | 'Bash' | 'general-purpose';

  /** Run in background (don't wait for result) */
  run_in_background?: boolean;

  /** Maximum turns before forcing completion */
  max_turns?: number;

  /** Specific model to use (inherits from parent if not set) */
  model?: 'sonnet' | 'opus' | 'haiku';

  /** Resume a previous subagent by ID */
  resume?: string;
}

/**
 * Built-in subagent type definitions
 */
const SUBAGENT_TYPES: Record<string, {
  description: string;
  tools: string[] | '*';
  systemPrompt: string;
  maxTurns: number;
}> = {
  'Explore': {
    description: 'Fast codebase exploration for finding files and patterns',
    tools: ['Read', 'Glob', 'Grep'],
    systemPrompt: `You are a fast codebase explorer. Your job is to:
- Find files matching patterns
- Search for code patterns
- Read and summarize relevant files
- Be thorough but concise
Return your findings in a structured format.`,
    maxTurns: 20,
  },

  'Plan': {
    description: 'Implementation planning and design',
    tools: '*',
    systemPrompt: `You are a software architect. Your job is to:
- Understand the current codebase
- Design implementation approaches
- Consider trade-offs and alternatives
- Create detailed, actionable plans
Focus on practical implementation details.`,
    maxTurns: 50,
  },

  'Bash': {
    description: 'Shell command execution specialist',
    tools: ['Bash'],
    systemPrompt: `You execute shell commands. Be careful and precise.
Only run commands that are necessary for the task.
Report any errors or unexpected output clearly.`,
    maxTurns: 10,
  },

  'general-purpose': {
    description: 'General purpose agent for any task',
    tools: '*',
    systemPrompt: `You are a helpful assistant working on a specific task.
Complete the task thoroughly and return a clear summary of what you did.`,
    maxTurns: 30,
  },
};
```

## Subagent Manager Implementation

```typescript
// packages/core/src/agent/subagent.ts

import { AgentLoop } from './loop';
import { ContextManager } from '../context/manager';
import type { LLMRouter } from '@openagent/llm';
import type { ToolRegistry } from '@openagent/tools';

interface SubagentResult {
  /** Unique ID for this subagent run */
  agentId: string;

  /** Final output from the subagent */
  output: string;

  /** Whether the subagent completed successfully */
  success: boolean;

  /** Error message if failed */
  error?: string;

  /** Token usage */
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

export class SubagentManager {
  private llm: LLMRouter;
  private tools: ToolRegistry;
  private runningAgents: Map<string, {
    loop: AgentLoop;
    promise: Promise<SubagentResult>;
  }> = new Map();

  constructor(llm: LLMRouter, tools: ToolRegistry) {
    this.llm = llm;
    this.tools = tools;
  }

  /**
   * Spawn a new subagent
   */
  async spawn(config: SubagentConfig): Promise<SubagentResult> {
    const agentId = generateAgentId();
    const subagentType = SUBAGENT_TYPES[config.subagent_type];

    if (!subagentType) {
      return {
        agentId,
        output: '',
        success: false,
        error: `Unknown subagent type: ${config.subagent_type}`,
        usage: { input_tokens: 0, output_tokens: 0 },
      };
    }

    // Create isolated context
    const context = new ContextManager({
      maxTokens: 100000, // Smaller context for subagents
    });

    // Filter tools based on subagent type
    const filteredTools = this.filterTools(subagentType.tools);

    // Create subagent loop
    const loop = new AgentLoop(
      this.llm,
      filteredTools,
      new MCPRegistry(), // Subagents don't get MCP by default
      context,
      new PermissionManager({ mode: 'permissive' }), // Subagents are trusted
      new HookExecutor({}),
      {
        maxTurns: config.max_turns || subagentType.maxTurns,
        systemPrompt: subagentType.systemPrompt,
      }
    );

    // Run the subagent
    const promise = this.runSubagent(loop, config.prompt, agentId);

    if (config.run_in_background) {
      // Store for later retrieval
      this.runningAgents.set(agentId, { loop, promise });

      return {
        agentId,
        output: `Subagent started in background. Use agent ID ${agentId} to check status.`,
        success: true,
        usage: { input_tokens: 0, output_tokens: 0 },
      };
    }

    return promise;
  }

  /**
   * Get result from a background subagent
   */
  async getResult(agentId: string): Promise<SubagentResult | null> {
    const agent = this.runningAgents.get(agentId);
    if (!agent) {
      return null;
    }

    return agent.promise;
  }

  /**
   * Run subagent to completion
   */
  private async runSubagent(
    loop: AgentLoop,
    prompt: string,
    agentId: string
  ): Promise<SubagentResult> {
    let output = '';
    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    try {
      for await (const event of loop.run(prompt)) {
        switch (event.type) {
          case 'text':
            output += event.content;
            break;
          case 'done':
            totalInputTokens = event.usage.input_tokens;
            totalOutputTokens = event.usage.output_tokens;
            break;
          case 'error':
            return {
              agentId,
              output,
              success: false,
              error: event.message,
              usage: { input_tokens: totalInputTokens, output_tokens: totalOutputTokens },
            };
        }
      }

      return {
        agentId,
        output,
        success: true,
        usage: { input_tokens: totalInputTokens, output_tokens: totalOutputTokens },
      };
    } catch (error) {
      return {
        agentId,
        output,
        success: false,
        error: String(error),
        usage: { input_tokens: totalInputTokens, output_tokens: totalOutputTokens },
      };
    }
  }

  /**
   * Filter tools based on subagent type
   */
  private filterTools(allowedTools: string[] | '*'): ToolRegistry {
    if (allowedTools === '*') {
      return this.tools;
    }

    const filtered = new ToolRegistry();
    for (const toolName of allowedTools) {
      const tool = this.tools.get(toolName);
      if (tool) {
        filtered.register(tool);
      }
    }
    return filtered;
  }
}

function generateAgentId(): string {
  return `agent_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}
```

## Parallel Execution

Launch multiple subagents simultaneously:

```typescript
// Example: Parallel exploration
async function parallelExplore(manager: SubagentManager) {
  const tasks = [
    manager.spawn({
      description: 'Find models',
      prompt: 'Find all model/entity definitions in the codebase',
      subagent_type: 'Explore',
    }),
    manager.spawn({
      description: 'Find tests',
      prompt: 'Find all test files and describe the testing patterns used',
      subagent_type: 'Explore',
    }),
    manager.spawn({
      description: 'Find APIs',
      prompt: 'Find all API endpoints and their handlers',
      subagent_type: 'Explore',
    }),
  ];

  const results = await Promise.all(tasks);
  return results;
}
```

## Subagent Communication

Subagents cannot directly communicate with each other. Communication flows through the parent:

```
┌────────────────────────────────────────────────────────────┐
│                                                             │
│  Main Agent                                                 │
│       │                                                     │
│       ├──spawn──▶ Subagent A                               │
│       │               │                                     │
│       │           (works)                                   │
│       │               │                                     │
│       │◀──result────┘                                      │
│       │                                                     │
│       │ (Main agent processes result,                       │
│       │  decides what to do next)                           │
│       │                                                     │
│       ├──spawn──▶ Subagent B                               │
│       │           (receives context from A's result)        │
│       │               │                                     │
│       │◀──result────┘                                      │
│       │                                                     │
│       ▼                                                     │
│   Continue main task                                        │
│                                                             │
└────────────────────────────────────────────────────────────┘
```

## Background Subagents

For long-running tasks, subagents can run in the background:

```typescript
// Spawn background subagent
const result = await manager.spawn({
  description: 'Run full test suite',
  prompt: 'Run all tests and report failures',
  subagent_type: 'Bash',
  run_in_background: true,
});

console.log(`Started: ${result.agentId}`);

// ... continue with other work ...

// Check status later
const finalResult = await manager.getResult(result.agentId);
if (finalResult) {
  console.log(`Tests complete: ${finalResult.output}`);
}
```

## Resuming Subagents

Subagents can be resumed with their previous context:

```typescript
// Resume a previous subagent
const result = await manager.spawn({
  description: 'Continue previous task',
  prompt: 'Continue from where you left off',
  subagent_type: 'general-purpose',
  resume: 'agent_abc123', // Previous agent ID
});
```

## Best Practices

1. **Use Explore for Search**: When searching code, use multiple Explore subagents in parallel
2. **Isolate Side Effects**: Use Bash subagents for commands that might fail
3. **Limit Context**: Subagents don't need full conversation history
4. **Be Specific**: Give subagents focused, specific tasks
5. **Check Background**: Always retrieve background subagent results

## Limitations

- Subagents cannot spawn their own subagents (no nesting)
- Subagents don't have access to MCP servers by default
- Background subagents may timeout after extended periods
- Subagent context is lost after completion (unless resumed)

## Next Steps

- See [AGENT-LOOP.md](AGENT-LOOP.md) for main agent details
- See [CONTEXT-MANAGEMENT.md](CONTEXT-MANAGEMENT.md) for context handling
- See [TOOL-SYSTEM.md](TOOL-SYSTEM.md) for tool filtering
