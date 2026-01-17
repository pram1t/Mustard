# Hook System

This document describes the hook system that enables extensibility and automation.

## Overview

Hooks are executable scripts that run at specific lifecycle events. They allow:
- Pre-processing user input
- Validating tool parameters
- Post-processing tool results
- Custom logging and notifications
- Workflow automation

## Hook Events

| Event | Trigger | Use Cases |
|-------|---------|-----------|
| `session_start` | New session begins | Load context, set up environment |
| `user_prompt_submit` | User sends message | Validate, transform, inject context |
| `pre_tool_use` | Before tool executes | Security checks, parameter validation |
| `post_tool_use` | After tool completes | Format output, run tests, log |
| `notification` | Agent wants to notify | Custom alerting, integrations |
| `stop` | Session ends | Cleanup, summary, logging |

## Hook Configuration

```json
// ~/.openagent/config.json
{
  "hooks": {
    "session_start": [
      {
        "command": "node ~/.openagent/hooks/init.js",
        "timeout": 5000
      }
    ],
    "pre_tool_use": [
      {
        "matcher": { "tool": "Bash" },
        "command": "node ~/.openagent/hooks/validate-bash.js",
        "timeout": 3000
      }
    ],
    "post_tool_use": [
      {
        "matcher": { "tool": "Edit" },
        "command": "npm run lint -- --fix",
        "timeout": 30000
      }
    ]
  }
}
```

## Hook Interface

```typescript
// packages/hooks/src/system.ts

/**
 * Hook event types
 */
type HookEvent =
  | 'session_start'
  | 'user_prompt_submit'
  | 'pre_tool_use'
  | 'post_tool_use'
  | 'notification'
  | 'stop';

/**
 * Matcher for filtering when hooks run
 */
interface HookMatcher {
  /** Tool name to match (for pre/post_tool_use) */
  tool?: string;
  /** Regex pattern for tool name */
  toolPattern?: string;
}

/**
 * Hook configuration
 */
interface HookConfig {
  /** Shell command to execute */
  command: string;
  /** Timeout in milliseconds */
  timeout?: number;
  /** Matcher to filter when hook runs */
  matcher?: HookMatcher;
  /** Environment variables to set */
  env?: Record<string, string>;
  /** Working directory */
  cwd?: string;
}

/**
 * Data passed to hooks via stdin
 */
interface HookInput {
  event: HookEvent;
  timestamp: number;
  sessionId: string;

  // Event-specific data
  message?: string;           // user_prompt_submit
  tool?: string;              // pre/post_tool_use
  params?: object;            // pre/post_tool_use
  result?: object;            // post_tool_use
  notification?: string;      // notification
}

/**
 * Result from hook execution
 */
interface HookResult {
  /** Whether the hook blocked the action */
  blocked: boolean;
  /** Modified message (for user_prompt_submit) */
  modifiedMessage?: string;
  /** Modified params (for pre_tool_use) */
  modifiedParams?: object;
  /** Custom output to display */
  output?: string;
  /** Error if hook failed */
  error?: string;
}
```

## Hook Executor Implementation

```typescript
// packages/hooks/src/executor.ts

import { spawn } from 'child_process';
import type { HookEvent, HookConfig, HookInput, HookResult } from './system';

export class HookExecutor {
  private hooks: Map<HookEvent, HookConfig[]> = new Map();

  constructor(config: Record<HookEvent, HookConfig[]>) {
    for (const [event, hooks] of Object.entries(config)) {
      this.hooks.set(event as HookEvent, hooks);
    }
  }

  /**
   * Register a hook
   */
  register(event: HookEvent, config: HookConfig): void {
    const existing = this.hooks.get(event) || [];
    existing.push(config);
    this.hooks.set(event, existing);
  }

  /**
   * Trigger hooks for an event
   */
  async trigger(event: HookEvent, data: Partial<HookInput>): Promise<HookResult> {
    const hooks = this.hooks.get(event) || [];
    const matchingHooks = hooks.filter(h => this.matchesFilter(h, data));

    if (matchingHooks.length === 0) {
      return { blocked: false };
    }

    // Execute hooks in sequence
    // Any hook can block, modify, or just observe
    let result: HookResult = { blocked: false };

    for (const hook of matchingHooks) {
      const hookResult = await this.executeHook(hook, {
        event,
        timestamp: Date.now(),
        sessionId: data.sessionId || 'unknown',
        ...data,
      });

      // If blocked, stop immediately
      if (hookResult.blocked) {
        return hookResult;
      }

      // Accumulate modifications
      if (hookResult.modifiedMessage) {
        result.modifiedMessage = hookResult.modifiedMessage;
      }
      if (hookResult.modifiedParams) {
        result.modifiedParams = hookResult.modifiedParams;
      }
      if (hookResult.output) {
        result.output = (result.output || '') + hookResult.output;
      }
    }

    return result;
  }

  /**
   * Check if hook matches the current context
   */
  private matchesFilter(hook: HookConfig, data: Partial<HookInput>): boolean {
    if (!hook.matcher) {
      return true; // No matcher means always run
    }

    // Tool name exact match
    if (hook.matcher.tool && data.tool !== hook.matcher.tool) {
      return false;
    }

    // Tool name pattern match
    if (hook.matcher.toolPattern) {
      const regex = new RegExp(hook.matcher.toolPattern);
      if (!regex.test(data.tool || '')) {
        return false;
      }
    }

    return true;
  }

  /**
   * Execute a single hook
   */
  private async executeHook(
    hook: HookConfig,
    input: HookInput
  ): Promise<HookResult> {
    return new Promise((resolve) => {
      const timeout = hook.timeout || 10000;

      // Parse command
      const [cmd, ...args] = hook.command.split(' ');

      const proc = spawn(cmd, args, {
        cwd: hook.cwd || process.cwd(),
        env: { ...process.env, ...hook.env },
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true,
      });

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      // Send input via stdin
      proc.stdin.write(JSON.stringify(input));
      proc.stdin.end();

      // Timeout handler
      const timeoutId = setTimeout(() => {
        proc.kill('SIGTERM');
        // Fail open - don't block on timeout
        resolve({
          blocked: false,
          error: `Hook timed out after ${timeout}ms`,
        });
      }, timeout);

      proc.on('close', (code) => {
        clearTimeout(timeoutId);

        if (code !== 0) {
          // Fail open - non-zero exit doesn't block
          resolve({
            blocked: false,
            output: stderr || stdout,
            error: `Hook exited with code ${code}`,
          });
          return;
        }

        // Try to parse stdout as JSON result
        try {
          const result = JSON.parse(stdout);
          resolve({
            blocked: result.blocked === true,
            modifiedMessage: result.modifiedMessage,
            modifiedParams: result.modifiedParams,
            output: result.output,
          });
        } catch {
          // If not JSON, treat stdout as output
          resolve({
            blocked: false,
            output: stdout,
          });
        }
      });

      proc.on('error', (error) => {
        clearTimeout(timeoutId);
        // Fail open on error
        resolve({
          blocked: false,
          error: `Hook error: ${error.message}`,
        });
      });
    });
  }
}
```

## Example Hooks

### Bash Command Validator

Blocks dangerous bash commands:

```javascript
// ~/.openagent/hooks/validate-bash.js
const readline = require('readline');

async function main() {
  const rl = readline.createInterface({ input: process.stdin });

  let input = '';
  for await (const line of rl) {
    input += line;
  }

  const data = JSON.parse(input);
  const command = data.params?.command || '';

  // Dangerous patterns
  const dangerous = [
    /rm\s+-rf\s+\//,           // rm -rf /
    />\s*\/dev\/sd[a-z]/,      // Overwrite disk
    /mkfs/,                     // Format filesystem
    /dd\s+if=/,                // Raw disk operations
    /:(){ :|:& };:/,           // Fork bomb
  ];

  for (const pattern of dangerous) {
    if (pattern.test(command)) {
      console.log(JSON.stringify({
        blocked: true,
        output: `Blocked dangerous command: ${command}`,
      }));
      process.exit(0);
    }
  }

  // Allow the command
  console.log(JSON.stringify({ blocked: false }));
}

main();
```

### Auto-Format on Edit

Runs prettier after file edits:

```javascript
// ~/.openagent/hooks/format-on-edit.js
const { execSync } = require('child_process');
const readline = require('readline');

async function main() {
  const rl = readline.createInterface({ input: process.stdin });

  let input = '';
  for await (const line of rl) {
    input += line;
  }

  const data = JSON.parse(input);

  // Only run on post_tool_use for Edit
  if (data.event !== 'post_tool_use' || data.tool !== 'Edit') {
    console.log(JSON.stringify({ blocked: false }));
    return;
  }

  const filePath = data.params?.file_path;
  if (!filePath) {
    console.log(JSON.stringify({ blocked: false }));
    return;
  }

  // Run prettier on the file
  try {
    execSync(`npx prettier --write "${filePath}"`, { stdio: 'pipe' });
    console.log(JSON.stringify({
      blocked: false,
      output: `Formatted ${filePath}`,
    }));
  } catch (error) {
    console.log(JSON.stringify({
      blocked: false,
      error: `Format failed: ${error.message}`,
    }));
  }
}

main();
```

### Session Logger

Logs all sessions for audit:

```javascript
// ~/.openagent/hooks/session-logger.js
const fs = require('fs');
const path = require('path');
const readline = require('readline');

async function main() {
  const rl = readline.createInterface({ input: process.stdin });

  let input = '';
  for await (const line of rl) {
    input += line;
  }

  const data = JSON.parse(input);

  // Log all events
  const logDir = path.join(process.env.HOME, '.openagent', 'logs');
  fs.mkdirSync(logDir, { recursive: true });

  const logFile = path.join(logDir, `${data.sessionId}.log`);
  const logEntry = {
    timestamp: new Date().toISOString(),
    event: data.event,
    tool: data.tool,
    message: data.message?.slice(0, 200),
  };

  fs.appendFileSync(logFile, JSON.stringify(logEntry) + '\n');

  console.log(JSON.stringify({ blocked: false }));
}

main();
```

### Context Injection

Injects project-specific context into user messages:

```javascript
// ~/.openagent/hooks/inject-context.js
const fs = require('fs');
const path = require('path');
const readline = require('readline');

async function main() {
  const rl = readline.createInterface({ input: process.stdin });

  let input = '';
  for await (const line of rl) {
    input += line;
  }

  const data = JSON.parse(input);

  // Only modify user_prompt_submit
  if (data.event !== 'user_prompt_submit') {
    console.log(JSON.stringify({ blocked: false }));
    return;
  }

  // Check for project context file
  const contextFile = path.join(process.cwd(), '.openagent-context.md');

  if (fs.existsSync(contextFile)) {
    const context = fs.readFileSync(contextFile, 'utf-8');
    const modifiedMessage = `[Project Context]\n${context}\n\n[User Request]\n${data.message}`;

    console.log(JSON.stringify({
      blocked: false,
      modifiedMessage,
    }));
  } else {
    console.log(JSON.stringify({ blocked: false }));
  }
}

main();
```

## Hook Flow Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                       HOOK FLOW                               │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  User Message                                                 │
│       │                                                       │
│       ▼                                                       │
│  ┌────────────────────────────────────┐                      │
│  │     HOOK: user_prompt_submit       │                      │
│  │  - Can modify message              │                      │
│  │  - Can block (return blocked:true) │                      │
│  │  - Can inject context              │                      │
│  └────────────────┬───────────────────┘                      │
│                   │                                           │
│                   ▼                                           │
│            LLM Processing                                     │
│                   │                                           │
│                   ▼                                           │
│            Tool Call Requested                                │
│                   │                                           │
│                   ▼                                           │
│  ┌────────────────────────────────────┐                      │
│  │     HOOK: pre_tool_use             │                      │
│  │  - Can modify params               │                      │
│  │  - Can block dangerous actions     │                      │
│  │  - Security validation             │                      │
│  └────────────────┬───────────────────┘                      │
│                   │                                           │
│         ┌────────┴─────────┐                                 │
│         │  blocked: true?  │                                 │
│         └────────┬─────────┘                                 │
│            No    │    Yes                                    │
│                  │      └──▶ Return error to LLM             │
│                  ▼                                           │
│            Tool Execution                                     │
│                  │                                           │
│                  ▼                                           │
│  ┌────────────────────────────────────┐                      │
│  │     HOOK: post_tool_use            │                      │
│  │  - Format/transform output         │                      │
│  │  - Run linters/tests               │                      │
│  │  - Log activity                    │                      │
│  └────────────────┬───────────────────┘                      │
│                   │                                           │
│                   ▼                                           │
│            Continue agent loop                                │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

## Best Practices

1. **Fail Open**: Hooks should not block on errors - return `{ blocked: false }` on failure
2. **Timeouts**: Set reasonable timeouts (3-10 seconds for validation, longer for build tasks)
3. **JSON Output**: Always output valid JSON for reliable parsing
4. **Idempotent**: Hooks may run multiple times; design accordingly
5. **Security**: Validate tool parameters but don't leak sensitive info in logs

## Next Steps

- See [PERMISSION-SYSTEM.md](PERMISSION-SYSTEM.md) for access control
- See [CONFIGURATION.md](CONFIGURATION.md) for hook settings
- See [CLI-INTERFACE.md](CLI-INTERFACE.md) for managing hooks
