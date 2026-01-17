# Tool System

This document describes the tool system that gives OpenAgent the ability to interact with the environment.

## Overview

Tools are the "hands" of the agent - they allow it to:
- Read and write files
- Search the codebase
- Execute shell commands
- Make web requests
- Interact with the user
- Delegate to subagents

## Tool Interface

```typescript
// packages/tools/src/interface.ts

import type { JSONSchema } from 'json-schema';

/**
 * Context provided to tool execution
 */
interface ExecutionContext {
  /** Current working directory */
  cwd: string;

  /** Session ID for tracking */
  sessionId: string;

  /** User home directory */
  homeDir: string;

  /** Configuration */
  config: Config;

  /** Permission manager for nested checks */
  permissions: PermissionManager;

  /** Hook executor for lifecycle events */
  hooks: HookExecutor;

  /** Abort signal for cancellation */
  signal?: AbortSignal;
}

/**
 * Result from tool execution
 */
interface ToolResult {
  /** Whether execution succeeded */
  success: boolean;

  /** Output content (string for display, object for structured data) */
  output: string | object;

  /** Error message if failed */
  error?: string;

  /** Additional metadata */
  metadata?: {
    /** Files that were modified */
    modifiedFiles?: string[];
    /** Tokens consumed (for context tracking) */
    tokensUsed?: number;
    /** Execution time in ms */
    executionTime?: number;
  };
}

/**
 * Tool definition
 */
interface Tool {
  /** Unique tool name */
  name: string;

  /** Description for LLM to understand when to use */
  description: string;

  /** JSON Schema for parameters */
  parameters: {
    type: 'object';
    properties: Record<string, JSONSchema>;
    required?: string[];
    additionalProperties?: boolean;
  };

  /**
   * Execute the tool
   * @param params - Validated parameters from LLM
   * @param context - Execution context
   */
  execute(params: Record<string, unknown>, context: ExecutionContext): Promise<ToolResult>;
}
```

## Built-in Tools

### Read Tool

Reads file contents with line numbers.

```typescript
// packages/tools/src/builtin/read.ts

import * as fs from 'fs/promises';
import * as path from 'path';
import type { Tool, ToolResult, ExecutionContext } from '../interface';

export const ReadTool: Tool = {
  name: 'Read',

  description: `Reads a file from the filesystem.
- The file_path must be an absolute path
- By default reads up to 2000 lines from the beginning
- Can specify offset and limit for large files
- Returns content with line numbers (cat -n format)
- Can read images, PDFs, and Jupyter notebooks`,

  parameters: {
    type: 'object',
    properties: {
      file_path: {
        type: 'string',
        description: 'Absolute path to the file to read',
      },
      offset: {
        type: 'number',
        description: 'Line number to start reading from (1-indexed)',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of lines to read',
      },
    },
    required: ['file_path'],
  },

  async execute(params, context): Promise<ToolResult> {
    const { file_path, offset = 1, limit = 2000 } = params as {
      file_path: string;
      offset?: number;
      limit?: number;
    };

    try {
      // Resolve path
      const resolvedPath = path.isAbsolute(file_path)
        ? file_path
        : path.resolve(context.cwd, file_path);

      // Check file exists
      const stat = await fs.stat(resolvedPath);
      if (stat.isDirectory()) {
        return {
          success: false,
          output: '',
          error: `Path is a directory, not a file: ${resolvedPath}`,
        };
      }

      // Read file
      const content = await fs.readFile(resolvedPath, 'utf-8');
      const lines = content.split('\n');

      // Apply offset and limit
      const startLine = Math.max(1, offset);
      const endLine = Math.min(lines.length, startLine + limit - 1);
      const selectedLines = lines.slice(startLine - 1, endLine);

      // Format with line numbers (cat -n style)
      const formatted = selectedLines
        .map((line, i) => {
          const lineNum = startLine + i;
          const padding = String(endLine).length;
          return `${String(lineNum).padStart(padding)}\t${line}`;
        })
        .join('\n');

      return {
        success: true,
        output: formatted,
        metadata: {
          tokensUsed: Math.ceil(formatted.length / 4),
        },
      };
    } catch (error) {
      return {
        success: false,
        output: '',
        error: `Failed to read file: ${error}`,
      };
    }
  },
};
```

### Write Tool

Creates or overwrites files.

```typescript
// packages/tools/src/builtin/write.ts

import * as fs from 'fs/promises';
import * as path from 'path';
import type { Tool, ToolResult, ExecutionContext } from '../interface';

export const WriteTool: Tool = {
  name: 'Write',

  description: `Writes content to a file.
- Creates parent directories if they don't exist
- Overwrites existing files
- file_path must be absolute
- Prefer Edit tool for modifying existing files`,

  parameters: {
    type: 'object',
    properties: {
      file_path: {
        type: 'string',
        description: 'Absolute path to write to',
      },
      content: {
        type: 'string',
        description: 'Content to write to the file',
      },
    },
    required: ['file_path', 'content'],
  },

  async execute(params, context): Promise<ToolResult> {
    const { file_path, content } = params as {
      file_path: string;
      content: string;
    };

    try {
      const resolvedPath = path.isAbsolute(file_path)
        ? file_path
        : path.resolve(context.cwd, file_path);

      // Create parent directories
      await fs.mkdir(path.dirname(resolvedPath), { recursive: true });

      // Write file
      await fs.writeFile(resolvedPath, content, 'utf-8');

      return {
        success: true,
        output: `Successfully wrote ${content.length} characters to ${resolvedPath}`,
        metadata: {
          modifiedFiles: [resolvedPath],
        },
      };
    } catch (error) {
      return {
        success: false,
        output: '',
        error: `Failed to write file: ${error}`,
      };
    }
  },
};
```

### Edit Tool

Performs surgical string replacements.

```typescript
// packages/tools/src/builtin/edit.ts

import * as fs from 'fs/promises';
import * as path from 'path';
import type { Tool, ToolResult, ExecutionContext } from '../interface';

export const EditTool: Tool = {
  name: 'Edit',

  description: `Performs exact string replacement in files.
- old_string must match exactly (including whitespace/indentation)
- Edit fails if old_string is not unique - provide more context
- Use replace_all: true to replace all occurrences
- Prefer this over Write for modifying existing files`,

  parameters: {
    type: 'object',
    properties: {
      file_path: {
        type: 'string',
        description: 'Absolute path to the file to edit',
      },
      old_string: {
        type: 'string',
        description: 'Exact string to find and replace',
      },
      new_string: {
        type: 'string',
        description: 'String to replace with',
      },
      replace_all: {
        type: 'boolean',
        description: 'Replace all occurrences (default: false)',
        default: false,
      },
    },
    required: ['file_path', 'old_string', 'new_string'],
  },

  async execute(params, context): Promise<ToolResult> {
    const { file_path, old_string, new_string, replace_all = false } = params as {
      file_path: string;
      old_string: string;
      new_string: string;
      replace_all?: boolean;
    };

    try {
      const resolvedPath = path.isAbsolute(file_path)
        ? file_path
        : path.resolve(context.cwd, file_path);

      // Read current content
      const content = await fs.readFile(resolvedPath, 'utf-8');

      // Check if old_string exists
      if (!content.includes(old_string)) {
        return {
          success: false,
          output: '',
          error: `String not found in file: "${old_string.slice(0, 100)}..."`,
        };
      }

      // Check uniqueness if not replace_all
      if (!replace_all) {
        const count = content.split(old_string).length - 1;
        if (count > 1) {
          return {
            success: false,
            output: '',
            error: `String appears ${count} times. Use replace_all: true or provide more context to make it unique.`,
          };
        }
      }

      // Perform replacement
      const newContent = replace_all
        ? content.split(old_string).join(new_string)
        : content.replace(old_string, new_string);

      // Write back
      await fs.writeFile(resolvedPath, newContent, 'utf-8');

      const replacements = content.split(old_string).length - 1;
      return {
        success: true,
        output: `Successfully replaced ${replacements} occurrence(s) in ${resolvedPath}`,
        metadata: {
          modifiedFiles: [resolvedPath],
        },
      };
    } catch (error) {
      return {
        success: false,
        output: '',
        error: `Failed to edit file: ${error}`,
      };
    }
  },
};
```

### Glob Tool

Fast file pattern matching.

```typescript
// packages/tools/src/builtin/glob.ts

import { glob } from 'glob';
import * as path from 'path';
import type { Tool, ToolResult, ExecutionContext } from '../interface';

export const GlobTool: Tool = {
  name: 'Glob',

  description: `Finds files matching a glob pattern.
- Supports patterns like "**/*.ts", "src/**/*.tsx"
- Returns file paths sorted by modification time
- Use for finding files by name patterns`,

  parameters: {
    type: 'object',
    properties: {
      pattern: {
        type: 'string',
        description: 'Glob pattern to match files',
      },
      path: {
        type: 'string',
        description: 'Directory to search in (default: cwd)',
      },
    },
    required: ['pattern'],
  },

  async execute(params, context): Promise<ToolResult> {
    const { pattern, path: searchPath } = params as {
      pattern: string;
      path?: string;
    };

    try {
      const cwd = searchPath
        ? path.isAbsolute(searchPath)
          ? searchPath
          : path.resolve(context.cwd, searchPath)
        : context.cwd;

      const files = await glob(pattern, {
        cwd,
        absolute: true,
        nodir: true,
        ignore: ['**/node_modules/**', '**/.git/**'],
      });

      if (files.length === 0) {
        return {
          success: true,
          output: `No files found matching pattern: ${pattern}`,
        };
      }

      // Sort by modification time (newest first)
      const withStats = await Promise.all(
        files.map(async (f) => {
          const stat = await fs.stat(f);
          return { path: f, mtime: stat.mtimeMs };
        })
      );
      withStats.sort((a, b) => b.mtime - a.mtime);

      const output = withStats.map((f) => f.path).join('\n');
      return {
        success: true,
        output: `Found ${files.length} files:\n${output}`,
      };
    } catch (error) {
      return {
        success: false,
        output: '',
        error: `Glob failed: ${error}`,
      };
    }
  },
};
```

### Grep Tool

Regex content search.

```typescript
// packages/tools/src/builtin/grep.ts

import { execFile } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import type { Tool, ToolResult, ExecutionContext } from '../interface';

const execFileAsync = promisify(execFile);

export const GrepTool: Tool = {
  name: 'Grep',

  description: `Searches file contents using regex patterns.
- Uses ripgrep (rg) for fast searching
- Supports regex patterns
- Can filter by file type or glob
- Output modes: files_with_matches, content, count`,

  parameters: {
    type: 'object',
    properties: {
      pattern: {
        type: 'string',
        description: 'Regex pattern to search for',
      },
      path: {
        type: 'string',
        description: 'File or directory to search in (default: cwd)',
      },
      glob: {
        type: 'string',
        description: 'Glob pattern to filter files (e.g., "*.ts")',
      },
      type: {
        type: 'string',
        description: 'File type to search (e.g., "ts", "py", "js")',
      },
      output_mode: {
        type: 'string',
        enum: ['files_with_matches', 'content', 'count'],
        description: 'Output format (default: files_with_matches)',
      },
      case_insensitive: {
        type: 'boolean',
        description: 'Case insensitive search',
      },
    },
    required: ['pattern'],
  },

  async execute(params, context): Promise<ToolResult> {
    const {
      pattern,
      path: searchPath,
      glob: globPattern,
      type: fileType,
      output_mode = 'files_with_matches',
      case_insensitive = false,
    } = params as {
      pattern: string;
      path?: string;
      glob?: string;
      type?: string;
      output_mode?: 'files_with_matches' | 'content' | 'count';
      case_insensitive?: boolean;
    };

    try {
      const cwd = searchPath
        ? path.isAbsolute(searchPath)
          ? searchPath
          : path.resolve(context.cwd, searchPath)
        : context.cwd;

      const args: string[] = [];

      // Output mode
      if (output_mode === 'files_with_matches') {
        args.push('-l');
      } else if (output_mode === 'count') {
        args.push('-c');
      } else {
        args.push('-n'); // Line numbers
      }

      // Options
      if (case_insensitive) args.push('-i');
      if (globPattern) args.push('--glob', globPattern);
      if (fileType) args.push('--type', fileType);

      // Pattern
      args.push(pattern);

      // Path
      args.push(cwd);

      const { stdout } = await execFileAsync('rg', args, {
        maxBuffer: 10 * 1024 * 1024, // 10MB
        timeout: 30000,
      });

      return {
        success: true,
        output: stdout.trim() || 'No matches found',
      };
    } catch (error: any) {
      // rg returns exit code 1 for no matches
      if (error.code === 1 && !error.stderr) {
        return {
          success: true,
          output: 'No matches found',
        };
      }
      return {
        success: false,
        output: '',
        error: `Grep failed: ${error.message}`,
      };
    }
  },
};
```

### Bash Tool

Execute shell commands.

```typescript
// packages/tools/src/builtin/bash.ts

import { spawn } from 'child_process';
import type { Tool, ToolResult, ExecutionContext } from '../interface';

export const BashTool: Tool = {
  name: 'Bash',

  description: `Executes shell commands.
- Commands run in persistent shell session
- Always quote paths with spaces
- Prefer dedicated tools (Read, Write, Glob, Grep) over shell equivalents
- Timeout default: 2 minutes, max: 10 minutes
- Can run commands in background`,

  parameters: {
    type: 'object',
    properties: {
      command: {
        type: 'string',
        description: 'Shell command to execute',
      },
      timeout: {
        type: 'number',
        description: 'Timeout in milliseconds (default: 120000)',
      },
      run_in_background: {
        type: 'boolean',
        description: 'Run command in background',
      },
      description: {
        type: 'string',
        description: 'Human-readable description of command',
      },
    },
    required: ['command'],
  },

  async execute(params, context): Promise<ToolResult> {
    const {
      command,
      timeout = 120000,
      run_in_background = false,
    } = params as {
      command: string;
      timeout?: number;
      run_in_background?: boolean;
    };

    return new Promise((resolve) => {
      const shell = process.platform === 'win32' ? 'cmd.exe' : '/bin/bash';
      const shellArgs = process.platform === 'win32' ? ['/c', command] : ['-c', command];

      const proc = spawn(shell, shellArgs, {
        cwd: context.cwd,
        env: { ...process.env, ...context.config.env },
        stdio: ['pipe', 'pipe', 'pipe'],
        detached: run_in_background,
      });

      let stdout = '';
      let stderr = '';

      proc.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      const timeoutId = setTimeout(() => {
        proc.kill('SIGTERM');
        resolve({
          success: false,
          output: stdout,
          error: `Command timed out after ${timeout}ms`,
        });
      }, timeout);

      proc.on('close', (code) => {
        clearTimeout(timeoutId);

        if (code === 0) {
          resolve({
            success: true,
            output: stdout.trim() || '(no output)',
          });
        } else {
          resolve({
            success: false,
            output: stdout,
            error: stderr || `Command exited with code ${code}`,
          });
        }
      });

      proc.on('error', (error) => {
        clearTimeout(timeoutId);
        resolve({
          success: false,
          output: '',
          error: `Failed to execute command: ${error.message}`,
        });
      });

      if (run_in_background) {
        proc.unref();
        resolve({
          success: true,
          output: `Command started in background (PID: ${proc.pid})`,
        });
      }
    });
  },
};
```

### WebFetch Tool

HTTP requests.

```typescript
// packages/tools/src/builtin/web-fetch.ts

import type { Tool, ToolResult, ExecutionContext } from '../interface';

export const WebFetchTool: Tool = {
  name: 'WebFetch',

  description: `Fetches content from a URL.
- Automatically converts HTML to markdown
- Supports redirects
- Use for reading documentation, APIs, web pages
- Content may be summarized if too large`,

  parameters: {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        description: 'URL to fetch',
      },
      prompt: {
        type: 'string',
        description: 'What information to extract from the page',
      },
    },
    required: ['url', 'prompt'],
  },

  async execute(params, context): Promise<ToolResult> {
    const { url, prompt } = params as { url: string; prompt: string };

    try {
      // Validate URL
      const parsed = new URL(url);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return {
          success: false,
          output: '',
          error: 'Only HTTP(S) URLs are supported',
        };
      }

      // Fetch with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'OpenAgent/1.0',
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return {
          success: false,
          output: '',
          error: `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      const contentType = response.headers.get('content-type') || '';
      let content: string;

      if (contentType.includes('text/html')) {
        const html = await response.text();
        content = htmlToMarkdown(html); // Convert HTML to markdown
      } else if (contentType.includes('application/json')) {
        const json = await response.json();
        content = JSON.stringify(json, null, 2);
      } else {
        content = await response.text();
      }

      // Truncate if too large
      if (content.length > 50000) {
        content = content.slice(0, 50000) + '\n\n[Content truncated...]';
      }

      return {
        success: true,
        output: `URL: ${url}\n\nContent:\n${content}`,
      };
    } catch (error) {
      return {
        success: false,
        output: '',
        error: `Failed to fetch URL: ${error}`,
      };
    }
  },
};

function htmlToMarkdown(html: string): string {
  // Simplified HTML to markdown conversion
  // In production, use a library like turndown
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<head[^>]*>[\s\S]*?<\/head>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
```

### AskUser Tool

Interactive user prompts.

```typescript
// packages/tools/src/builtin/ask-user.ts

import type { Tool, ToolResult, ExecutionContext } from '../interface';

export const AskUserTool: Tool = {
  name: 'AskUser',

  description: `Asks the user a question with optional predefined choices.
- Use to gather preferences or clarify requirements
- Supports single-select and multi-select questions
- Users can always provide custom input`,

  parameters: {
    type: 'object',
    properties: {
      questions: {
        type: 'array',
        description: 'Questions to ask (1-4)',
        items: {
          type: 'object',
          properties: {
            question: { type: 'string' },
            header: { type: 'string', description: 'Short label (max 12 chars)' },
            options: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  label: { type: 'string' },
                  description: { type: 'string' },
                },
              },
            },
            multiSelect: { type: 'boolean' },
          },
        },
      },
    },
    required: ['questions'],
  },

  async execute(params, context): Promise<ToolResult> {
    // This tool requires UI integration
    // The CLI/Desktop app handles the actual user interaction
    // This implementation is a placeholder

    return {
      success: true,
      output: JSON.stringify({
        type: 'user_question',
        questions: params.questions,
      }),
    };
  },
};
```

### Task Tool

Spawn subagents.

```typescript
// packages/tools/src/builtin/task.ts

import type { Tool, ToolResult, ExecutionContext } from '../interface';

export const TaskTool: Tool = {
  name: 'Task',

  description: `Spawns a subagent to handle complex tasks.
- Subagents run in isolated context
- Only final result returned to parent
- Use for parallel exploration or specialized work
- Available types: Explore, Plan, Bash`,

  parameters: {
    type: 'object',
    properties: {
      description: {
        type: 'string',
        description: 'Short (3-5 word) description of task',
      },
      prompt: {
        type: 'string',
        description: 'Detailed task instructions',
      },
      subagent_type: {
        type: 'string',
        description: 'Type of subagent to spawn',
        enum: ['Explore', 'Plan', 'Bash', 'general-purpose'],
      },
      run_in_background: {
        type: 'boolean',
        description: 'Run subagent in background',
      },
    },
    required: ['description', 'prompt', 'subagent_type'],
  },

  async execute(params, context): Promise<ToolResult> {
    // Subagent spawning is handled by the agent loop
    // This returns a marker that the loop interprets

    return {
      success: true,
      output: JSON.stringify({
        type: 'spawn_subagent',
        ...params,
      }),
    };
  },
};
```

## Tool Registry

```typescript
// packages/tools/src/registry.ts

import type { Tool } from './interface';

export class ToolRegistry {
  private tools: Map<string, Tool> = new Map();

  register(tool: Tool): void {
    this.tools.set(tool.name, tool);
  }

  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  getAll(): Tool[] {
    return Array.from(this.tools.values());
  }

  getDefinitions(): ToolDefinition[] {
    return this.getAll().map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    }));
  }

  async execute(
    name: string,
    params: Record<string, unknown>,
    context: ExecutionContext
  ): Promise<ToolResult> {
    const tool = this.tools.get(name);
    if (!tool) {
      return {
        success: false,
        output: '',
        error: `Unknown tool: ${name}`,
      };
    }

    return tool.execute(params, context);
  }
}

// Create default registry with built-in tools
export function createDefaultRegistry(): ToolRegistry {
  const registry = new ToolRegistry();

  registry.register(ReadTool);
  registry.register(WriteTool);
  registry.register(EditTool);
  registry.register(GlobTool);
  registry.register(GrepTool);
  registry.register(BashTool);
  registry.register(WebFetchTool);
  registry.register(AskUserTool);
  registry.register(TaskTool);
  // ... more

  return registry;
}
```

## Creating Custom Tools

See [templates/tool-template.ts](../templates/tool-template.ts) for a starter template.

Key considerations:
1. Clear, concise description for LLM
2. Well-defined JSON Schema parameters
3. Proper error handling
4. Absolute vs relative path handling
5. Context-aware execution

## Tool Execution Flow

```
┌──────────────────────────────────────────────────────────────┐
│                    Tool Execution Flow                        │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  1. LLM returns tool_call: {name, arguments}                 │
│                    │                                          │
│                    ▼                                          │
│  2. Permission Check                                          │
│     - Evaluate allow/deny/ask rules                          │
│     - Prompt user if needed                                   │
│                    │                                          │
│                    ▼                                          │
│  3. Pre-Tool Hook                                             │
│     - Validate parameters                                     │
│     - Modify if needed                                        │
│     - Can block execution                                     │
│                    │                                          │
│                    ▼                                          │
│  4. Tool Execution                                            │
│     - Resolve paths                                           │
│     - Execute operation                                       │
│     - Capture result                                          │
│                    │                                          │
│                    ▼                                          │
│  5. Post-Tool Hook                                            │
│     - Format output                                           │
│     - Log activity                                            │
│     - Trigger side effects                                    │
│                    │                                          │
│                    ▼                                          │
│  6. Return result to agent loop                               │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

## Next Steps

- See [MCP-CLIENT.md](MCP-CLIENT.md) for external tool integration
- See [PERMISSION-SYSTEM.md](PERMISSION-SYSTEM.md) for tool access control
- See [HOOK-SYSTEM.md](HOOK-SYSTEM.md) for lifecycle events
