# CLI Interface

This document describes the command-line interface for OpenAgent.

## Overview

The CLI provides:
- Interactive chat mode
- One-shot queries
- Session management
- Configuration commands
- MCP server management

## Installation

```bash
# Install globally via npm
npm install -g openagent

# Or via bun
bun install -g openagent

# Verify installation
openagent --version
```

## Basic Usage

### Interactive Mode

```bash
# Start interactive session
openagent

# Start in specific directory
openagent --cwd /path/to/project

# With specific provider
openagent --provider anthropic
```

### One-Shot Mode

```bash
# Single query
openagent "What files are in this directory?"

# Pipe input
echo "Explain this code" | openagent

# Read from file
openagent --input prompt.txt
```

### Print Mode (Non-Interactive)

```bash
# Output only final response
openagent --print "List all TypeScript files"

# JSON output
openagent --print --output-format json "Count lines of code"
```

## Command Reference

### Global Options

| Option | Description |
|--------|-------------|
| `--version, -v` | Show version number |
| `--help, -h` | Show help |
| `--cwd <path>` | Set working directory |
| `--provider <name>` | LLM provider (openai, anthropic, gemini, ollama) |
| `--model <name>` | Specific model to use |
| `--print, -p` | Non-interactive mode |
| `--output-format <fmt>` | Output format (text, json, stream-json) |
| `--input-format <fmt>` | Input format (text, stream-json) |

### Session Options

| Option | Description |
|--------|-------------|
| `--session <id>` | Use specific session ID |
| `--resume <id>` | Resume previous session |
| `--continue, -c` | Continue most recent session |

### Permission Options

| Option | Description |
|--------|-------------|
| `--mode <mode>` | Permission mode (default, strict, permissive) |
| `--allow <tool>` | Allow specific tool |
| `--deny <tool>` | Deny specific tool |
| `--allow-path <pattern>` | Allow file path pattern |
| `--dangerously-skip-permissions` | Skip all permission checks |

## Subcommands

### `openagent config`

Manage configuration.

```bash
# Show current config
openagent config show

# Set a value
openagent config set llm.provider anthropic
openagent config set llm.anthropic.apiKey sk-ant-...

# Get a value
openagent config get llm.provider

# Reset to defaults
openagent config reset
```

### `openagent mcp`

Manage MCP servers.

```bash
# List connected servers
openagent mcp list

# Add a server
openagent mcp add mysql-db \
  --type stdio \
  --command "npx @openagent/mcp-server-database" \
  --env DATABASE_URL=mysql://...

# Add GitHub server
openagent mcp add github \
  --type stdio \
  --command "npx @modelcontextprotocol/server-github" \
  --env GITHUB_TOKEN=ghp_...

# Remove a server
openagent mcp remove mysql-db

# List tools from a server
openagent mcp tools mysql-db
```

### `openagent session`

Manage sessions.

```bash
# List recent sessions
openagent session list

# Show session details
openagent session show <id>

# Delete a session
openagent session delete <id>

# Export session
openagent session export <id> > session.json
```

### `openagent doctor`

Diagnose issues.

```bash
# Run all diagnostics
openagent doctor

# Check specific component
openagent doctor --check llm
openagent doctor --check mcp
openagent doctor --check permissions
```

## Streaming Output Format

When using `--output-format stream-json`, events are emitted as newline-delimited JSON:

```json
{"type":"session_start","session_id":"session_abc123"}
{"type":"text","content":"I'll help you "}
{"type":"text","content":"find those files."}
{"type":"tool_call_start","tool":"Glob","params":{"pattern":"**/*.ts"}}
{"type":"tool_call_end","tool":"Glob","success":true}
{"type":"text","content":"Found 42 TypeScript files."}
{"type":"done","usage":{"input_tokens":150,"output_tokens":89}}
```

## Interactive Commands

Within an interactive session:

| Command | Description |
|---------|-------------|
| `/help` | Show help |
| `/clear` | Clear conversation |
| `/session` | Show session info |
| `/compact` | Force context compaction |
| `/config` | Show current config |
| `/quit, /exit` | Exit session |

## Environment Variables

| Variable | Description |
|----------|-------------|
| `OPENAGENT_PROVIDER` | Default LLM provider |
| `OPENAGENT_MODEL` | Default model |
| `OPENAI_API_KEY` | OpenAI API key |
| `ANTHROPIC_API_KEY` | Anthropic API key |
| `GOOGLE_API_KEY` | Google/Gemini API key |
| `OPENAGENT_CONFIG_DIR` | Config directory (default: ~/.openagent) |
| `OPENAGENT_LOG_LEVEL` | Log level (debug, info, warn, error) |

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | General error |
| 2 | Invalid arguments |
| 3 | Configuration error |
| 4 | LLM provider error |
| 5 | Permission denied |

## CLI Implementation

```typescript
// apps/cli/src/index.ts

import { Command } from 'commander';
import { version } from '../package.json';
import { runInteractive } from './commands/interactive';
import { runPrint } from './commands/print';
import { configCommand } from './commands/config';
import { mcpCommand } from './commands/mcp';
import { sessionCommand } from './commands/session';
import { doctorCommand } from './commands/doctor';

const program = new Command();

program
  .name('openagent')
  .description('LLM-agnostic coding agent')
  .version(version);

// Main command (interactive or print)
program
  .argument('[prompt]', 'Initial prompt')
  .option('-p, --print', 'Non-interactive mode')
  .option('-c, --continue', 'Continue last session')
  .option('--cwd <path>', 'Working directory')
  .option('--provider <name>', 'LLM provider')
  .option('--model <name>', 'Model to use')
  .option('--resume <id>', 'Resume session')
  .option('--output-format <format>', 'Output format')
  .option('--mode <mode>', 'Permission mode')
  .option('--allow <tool>', 'Allow tool', collect, [])
  .option('--deny <tool>', 'Deny tool', collect, [])
  .action(async (prompt, options) => {
    if (options.print || prompt) {
      await runPrint(prompt, options);
    } else {
      await runInteractive(options);
    }
  });

// Subcommands
program.addCommand(configCommand());
program.addCommand(mcpCommand());
program.addCommand(sessionCommand());
program.addCommand(doctorCommand());

program.parse();

function collect(value: string, previous: string[]) {
  return previous.concat([value]);
}
```

### Interactive Mode Implementation

```typescript
// apps/cli/src/commands/interactive.ts

import { render } from 'ink';
import React from 'react';
import { InteractiveApp } from '../components/InteractiveApp';

export async function runInteractive(options: any) {
  const { waitUntilExit } = render(
    <InteractiveApp options={options} />
  );

  await waitUntilExit();
}
```

### Terminal UI (Ink)

```tsx
// apps/cli/src/components/InteractiveApp.tsx

import React, { useState, useEffect } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import { TextInput } from 'ink-text-input';
import { AgentLoop } from '@openagent/core';
import { MessageDisplay } from './MessageDisplay';
import { ToolCallDisplay } from './ToolCallDisplay';

export function InteractiveApp({ options }) {
  const { exit } = useApp();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [agent, setAgent] = useState(null);

  useEffect(() => {
    // Initialize agent
    const initAgent = async () => {
      const loop = await createAgentLoop(options);
      setAgent(loop);
    };
    initAgent();
  }, []);

  const handleSubmit = async (value: string) => {
    if (!value.trim()) return;

    // Handle commands
    if (value.startsWith('/')) {
      handleCommand(value);
      return;
    }

    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: value }]);
    setIsLoading(true);

    // Run agent
    for await (const event of agent.run(value)) {
      switch (event.type) {
        case 'text':
          setMessages(prev => {
            const last = prev[prev.length - 1];
            if (last?.role === 'assistant' && last.streaming) {
              return [
                ...prev.slice(0, -1),
                { ...last, content: last.content + event.content },
              ];
            }
            return [...prev, { role: 'assistant', content: event.content, streaming: true }];
          });
          break;
        case 'done':
          setIsLoading(false);
          setMessages(prev => {
            const last = prev[prev.length - 1];
            if (last?.streaming) {
              return [...prev.slice(0, -1), { ...last, streaming: false }];
            }
            return prev;
          });
          break;
      }
    }
  };

  const handleCommand = (cmd: string) => {
    switch (cmd) {
      case '/quit':
      case '/exit':
        exit();
        break;
      case '/clear':
        setMessages([]);
        break;
      case '/help':
        setMessages(prev => [...prev, {
          role: 'system',
          content: 'Commands: /help, /clear, /quit',
        }]);
        break;
    }
  };

  return (
    <Box flexDirection="column" padding={1}>
      <Box flexDirection="column" flexGrow={1}>
        {messages.map((msg, i) => (
          <MessageDisplay key={i} message={msg} />
        ))}
      </Box>

      <Box marginTop={1}>
        <Text color="cyan">{'> '}</Text>
        <TextInput
          value={input}
          onChange={setInput}
          onSubmit={handleSubmit}
          placeholder={isLoading ? 'Thinking...' : 'Type a message...'}
        />
      </Box>
    </Box>
  );
}
```

## Examples

### Basic Workflow

```bash
# Start working on a project
cd my-project
openagent

# Ask about the codebase
> What is the structure of this project?

# Make changes
> Add a new API endpoint for user registration

# Review and test
> Run the tests for the auth module

# Exit
> /quit
```

### Automated Pipeline

```bash
# One-shot code analysis
openagent --print "Analyze the codebase and suggest improvements" > analysis.md

# Batch processing
for file in src/*.ts; do
  openagent --print "Review this file for bugs: $file"
done

# CI integration
openagent --print --output-format json "Run all tests and report status" | jq '.success'
```

### With MCP Integrations

```bash
# Set up database connection
openagent mcp add db --type stdio --command "npx @openagent/mcp-server-database" --env DATABASE_URL=...

# Query database
openagent "What tables exist in the database and what are their schemas?"

# Generate code from schema
openagent "Generate TypeScript interfaces for all database tables"
```

## Next Steps

- See [CONFIGURATION.md](CONFIGURATION.md) for config file details
- See [MCP-CLIENT.md](MCP-CLIENT.md) for MCP setup
- See [DESKTOP-APP.md](DESKTOP-APP.md) for GUI alternative
