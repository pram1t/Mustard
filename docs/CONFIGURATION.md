# Configuration

This document describes all configuration options for OpenAgent.

## Configuration Files

Configuration is loaded from multiple sources in order of priority:

```
┌─────────────────────────────────────────────────────────────────┐
│                  CONFIGURATION HIERARCHY                         │
│                  (Later overrides earlier)                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. Built-in Defaults                                            │
│     └── Hardcoded sensible defaults                              │
│                                                                  │
│  2. User Configuration                                           │
│     └── ~/.openagent/config.json                                 │
│     └── Personal settings, API keys                              │
│                                                                  │
│  3. Project Configuration                                        │
│     └── .openagent/config.json                                   │
│     └── Shared team settings, committed to repo                  │
│                                                                  │
│  4. Project Local Configuration                                  │
│     └── .openagent/config.local.json                             │
│     └── Personal overrides, not committed                        │
│                                                                  │
│  5. Environment Variables                                        │
│     └── OPENAGENT_*, OPENAI_API_KEY, etc.                        │
│                                                                  │
│  6. CLI Arguments                                                │
│     └── --provider, --model, --allow, etc.                       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Complete Configuration Schema

```json
{
  "$schema": "https://openagent.dev/config-schema.json",

  "llm": {
    "provider": "openai",
    "fallback": ["anthropic", "ollama"],

    "openai": {
      "apiKey": "sk-...",
      "model": "gpt-4o",
      "baseURL": null,
      "organization": null
    },

    "anthropic": {
      "apiKey": "sk-ant-...",
      "model": "claude-sonnet-4-5-20251101"
    },

    "gemini": {
      "apiKey": "...",
      "model": "gemini-1.5-pro"
    },

    "ollama": {
      "baseURL": "http://localhost:11434",
      "model": "llama3.1"
    },

    "custom": {
      "name": "my-provider",
      "baseURL": "http://localhost:8000",
      "apiKey": "",
      "model": "my-model"
    }
  },

  "permissions": {
    "mode": "default",
    "allow": [
      { "tool": "Read" },
      { "tool": "Glob" },
      { "tool": "Grep" }
    ],
    "deny": [
      { "tool": "Bash", "conditions": { "commandPattern": "rm\\s+-rf" } }
    ],
    "ask": [
      { "tool": "Write" },
      { "tool": "Edit" },
      { "tool": "Bash" }
    ]
  },

  "hooks": {
    "session_start": [],
    "user_prompt_submit": [],
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
    ],
    "notification": [],
    "stop": []
  },

  "mcp": {
    "servers": {
      "mysql-main": {
        "type": "stdio",
        "command": "npx",
        "args": ["@openagent/mcp-server-database"],
        "env": {
          "DATABASE_URL": "mysql://user:pass@localhost/db"
        }
      },
      "github": {
        "type": "stdio",
        "command": "npx",
        "args": ["@modelcontextprotocol/server-github"],
        "env": {
          "GITHUB_TOKEN": "ghp_..."
        }
      }
    }
  },

  "context": {
    "maxTokens": 128000,
    "compactionThreshold": 0.8,
    "preserveRecentCount": 20
  },

  "session": {
    "directory": "~/.openagent/sessions",
    "autoSave": true,
    "autoSaveInterval": 60000
  },

  "ui": {
    "theme": "auto",
    "showTokenCount": true,
    "showTimings": false
  },

  "logging": {
    "level": "info",
    "file": "~/.openagent/logs/openagent.log"
  }
}
```

## Configuration Sections

### LLM Configuration

```typescript
interface LLMConfig {
  /** Primary provider to use */
  provider: 'openai' | 'anthropic' | 'gemini' | 'ollama' | 'custom';

  /** Fallback providers if primary fails */
  fallback?: string[];

  /** OpenAI configuration */
  openai?: {
    apiKey: string;
    model?: string;
    baseURL?: string;
    organization?: string;
  };

  /** Anthropic configuration */
  anthropic?: {
    apiKey: string;
    model?: string;
  };

  /** Google Gemini configuration */
  gemini?: {
    apiKey: string;
    model?: string;
  };

  /** Ollama configuration */
  ollama?: {
    baseURL?: string;
    model?: string;
  };

  /** Custom OpenAI-compatible provider */
  custom?: {
    name: string;
    baseURL: string;
    apiKey?: string;
    model: string;
  };
}
```

### Permission Configuration

```typescript
interface PermissionConfig {
  /** Permission mode */
  mode: 'default' | 'strict' | 'permissive';

  /** Rules that automatically allow */
  allow: PermissionRule[];

  /** Rules that automatically deny */
  deny: PermissionRule[];

  /** Rules that prompt for approval */
  ask: PermissionRule[];
}

interface PermissionRule {
  tool: string;
  pattern?: boolean;
  conditions?: {
    params?: Record<string, unknown>;
    pathPattern?: string;
    commandPattern?: string;
  };
}
```

### Hook Configuration

```typescript
interface HookConfig {
  session_start?: HookDefinition[];
  user_prompt_submit?: HookDefinition[];
  pre_tool_use?: HookDefinition[];
  post_tool_use?: HookDefinition[];
  notification?: HookDefinition[];
  stop?: HookDefinition[];
}

interface HookDefinition {
  command: string;
  timeout?: number;
  matcher?: {
    tool?: string;
    toolPattern?: string;
  };
  env?: Record<string, string>;
  cwd?: string;
}
```

### MCP Configuration

```typescript
interface MCPConfig {
  servers: Record<string, MCPServerConfig>;
}

interface MCPServerConfig {
  type: 'stdio' | 'http';

  // For stdio
  command?: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;

  // For http
  url?: string;
  headers?: Record<string, string>;
}
```

### Context Configuration

```typescript
interface ContextConfig {
  /** Maximum tokens for context window */
  maxTokens: number;

  /** Percentage threshold to trigger compaction */
  compactionThreshold: number;

  /** Minimum recent messages to preserve */
  preserveRecentCount: number;
}
```

## Environment Variables

| Variable | Config Path | Description |
|----------|-------------|-------------|
| `OPENAGENT_PROVIDER` | `llm.provider` | Default LLM provider |
| `OPENAGENT_MODEL` | `llm.{provider}.model` | Default model |
| `OPENAI_API_KEY` | `llm.openai.apiKey` | OpenAI API key |
| `ANTHROPIC_API_KEY` | `llm.anthropic.apiKey` | Anthropic API key |
| `GOOGLE_API_KEY` | `llm.gemini.apiKey` | Gemini API key |
| `OPENAGENT_CONFIG_DIR` | - | Config directory |
| `OPENAGENT_LOG_LEVEL` | `logging.level` | Log level |
| `OPENAGENT_PERMISSION_MODE` | `permissions.mode` | Permission mode |

## Example Configurations

### Minimal Configuration

```json
{
  "llm": {
    "provider": "openai",
    "openai": {
      "apiKey": "sk-..."
    }
  }
}
```

### Team Configuration (committed)

```json
// .openagent/config.json
{
  "permissions": {
    "mode": "strict",
    "allow": [
      { "tool": "Read" },
      { "tool": "Glob" },
      { "tool": "Grep" }
    ],
    "deny": [
      { "tool": "*", "conditions": { "pathPattern": "\\.(env|secret)" } }
    ]
  },
  "hooks": {
    "post_tool_use": [
      {
        "matcher": { "tool": "Edit" },
        "command": "npm run lint"
      }
    ]
  }
}
```

### Local Override (not committed)

```json
// .openagent/config.local.json
{
  "llm": {
    "provider": "ollama",
    "ollama": {
      "model": "codellama"
    }
  },
  "permissions": {
    "mode": "permissive"
  }
}
```

### Full Development Setup

```json
{
  "llm": {
    "provider": "anthropic",
    "fallback": ["openai"],
    "anthropic": {
      "apiKey": "sk-ant-...",
      "model": "claude-sonnet-4-5-20251101"
    },
    "openai": {
      "apiKey": "sk-...",
      "model": "gpt-4o"
    }
  },

  "permissions": {
    "mode": "default",
    "allow": [
      { "tool": "Read" },
      { "tool": "Glob" },
      { "tool": "Grep" },
      { "tool": "Bash", "conditions": { "commandPattern": "^(npm|yarn|pnpm|bun)\\s+(run|test|build)" } }
    ]
  },

  "mcp": {
    "servers": {
      "postgres": {
        "type": "stdio",
        "command": "npx",
        "args": ["@openagent/mcp-server-database"],
        "env": {
          "DATABASE_URL": "postgresql://localhost/myapp"
        }
      },
      "github": {
        "type": "stdio",
        "command": "npx",
        "args": ["@modelcontextprotocol/server-github"],
        "env": {
          "GITHUB_TOKEN": "ghp_..."
        }
      }
    }
  },

  "hooks": {
    "post_tool_use": [
      {
        "matcher": { "tool": "Edit" },
        "command": "npx prettier --write",
        "timeout": 10000
      }
    ]
  },

  "context": {
    "maxTokens": 200000,
    "compactionThreshold": 0.75
  },

  "ui": {
    "showTokenCount": true
  }
}
```

## Configuration CLI

```bash
# View current configuration
openagent config show

# View specific section
openagent config show llm

# Set a value
openagent config set llm.provider anthropic
openagent config set llm.anthropic.model claude-opus-4-5-20251101

# Get a value
openagent config get llm.provider

# Unset a value
openagent config unset llm.custom

# Reset to defaults
openagent config reset

# Validate configuration
openagent config validate
```

## JSON Schema

Full JSON Schema for configuration validation:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "llm": {
      "type": "object",
      "properties": {
        "provider": {
          "type": "string",
          "enum": ["openai", "anthropic", "gemini", "ollama", "custom"]
        },
        "fallback": {
          "type": "array",
          "items": { "type": "string" }
        }
      },
      "required": ["provider"]
    },
    "permissions": {
      "type": "object",
      "properties": {
        "mode": {
          "type": "string",
          "enum": ["default", "strict", "permissive"]
        },
        "allow": { "type": "array" },
        "deny": { "type": "array" },
        "ask": { "type": "array" }
      }
    }
  }
}
```

## Next Steps

- See [CLI-INTERFACE.md](CLI-INTERFACE.md) for command-line options
- See [PERMISSION-SYSTEM.md](PERMISSION-SYSTEM.md) for permission details
- See [HOOK-SYSTEM.md](HOOK-SYSTEM.md) for hook configuration
