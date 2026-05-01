# Configuration Guide

This document describes the configuration system for OpenAgent.

## Overview

OpenAgent uses a centralized configuration system with:

- Environment variable support
- Zod schema validation
- Type-safe configuration access
- Sensible defaults

## Package

Configuration is provided by the `@pram1t/mustard-config` package.

```typescript
import { getConfig, loadConfig, validateConfig } from '@pram1t/mustard-config';
```

## Quick Start

### Using Environment Variables

Create a `.env` file in the project root (or copy from `.env.example`):

```bash
cp .env.example .env
```

Edit `.env` with your values:

```env
OPENAI_API_KEY=sk-your-key-here
LOG_LEVEL=debug
```

### Accessing Configuration

```typescript
import { getConfig } from '@pram1t/mustard-config';

const config = getConfig();

console.log(config.llm.provider);     // 'openai'
console.log(config.logging.level);    // 'debug'
console.log(config.tools.bash.maxTimeout);  // 120000
```

## Configuration Schema

### Logging

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `LOG_LEVEL` | string | `info` (prod) / `debug` (dev) | Log level: trace, debug, info, warn, error, fatal, silent |
| `LOG_FORMAT` | string | `json` (prod) / `pretty` (dev) | Output format: json, pretty |

### LLM Provider

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `OPENAI_API_KEY` | string | - | OpenAI API key (required for OpenAI provider) |
| `ANTHROPIC_API_KEY` | string | - | Anthropic API key (required for Anthropic provider) |
| `OPENAGENT_PROVIDER` | string | `openai` | Default provider: openai, anthropic, gemini, ollama |
| `OPENAGENT_MODEL` | string | - | Default model (provider-specific) |
| `OPENAI_BASE_URL` | string | - | Custom base URL for OpenAI-compatible APIs |
| `LLM_RETRY_ATTEMPTS` | number | `3` | Number of retry attempts (0-10) |
| `LLM_RETRY_DELAY` | number | `1000` | Delay between retries in ms (0-60000) |

### Tool Configuration

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `BASH_TIMEOUT` | number | `120000` | Bash command timeout in ms (1000-600000) |
| `BASH_MAX_OUTPUT` | number | `30000` | Max bash output size in chars (1000-1000000) |
| `MAX_OUTPUT_SIZE` | number | `100000` | Max tool output size in chars (1000-1000000) |
| `BASH_ALLOWED_ENV_VARS` | string | - | Comma-separated list of allowed env vars for bash |

### Security

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `AUDIT_LOGGING` | boolean | `false` | Enable audit logging for tool executions |
| `SANITIZE_INPUTS` | boolean | `true` | Enable input sanitization |

## TypeScript Types

All configuration types are exported:

```typescript
import type {
  Config,
  LoggingConfig,
  LLMConfig,
  ToolConfig,
  SecurityConfig,
  LogLevel,
  LogFormat,
  LLMProvider,
} from '@pram1t/mustard-config';
```

### Config Structure

```typescript
interface Config {
  logging: {
    level: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal' | 'silent';
    format?: 'json' | 'pretty';
  };
  llm: {
    provider: 'openai' | 'anthropic' | 'gemini' | 'ollama';
    model?: string;
    apiKey?: string;
    baseUrl?: string;
    retryAttempts: number;
    retryDelay: number;
  };
  tools: {
    bash: {
      maxTimeout: number;
      maxOutputSize: number;
      allowedEnvVars?: string[];
    };
    maxOutputSize: number;
  };
  security: {
    auditLogging: boolean;
    sanitizeInputs: boolean;
  };
}
```

## Validation

### Schema Validation

Configuration is validated using Zod schemas:

```typescript
import { ConfigSchema, validateConfig, ConfigError } from '@pram1t/mustard-config';

try {
  const config = validateConfig(userInput);
} catch (error) {
  if (error instanceof ConfigError) {
    console.error('Validation errors:', error.errors);
  }
}
```

### Startup Validation

Validate required configuration at application startup:

```typescript
import { loadConfig, validateStartup } from '@pram1t/mustard-config';

const config = loadConfig();

try {
  validateStartup(config);
} catch (error) {
  console.error('Missing required configuration:', error.message);
  process.exit(1);
}
```

## Advanced Usage

### Custom Configuration

You can pass custom configuration programmatically:

```typescript
import { ConfigSchema } from '@pram1t/mustard-config';

const customConfig = ConfigSchema.parse({
  logging: { level: 'debug' },
  llm: { provider: 'anthropic' },
});
```

### Resetting Configuration

For testing, you can reset the cached configuration:

```typescript
import { resetConfig, getConfig } from '@pram1t/mustard-config';

// Reset cache
resetConfig();

// Next call will reload from environment
const freshConfig = getConfig();
```

### Partial Configuration

Configuration supports partial objects with defaults:

```typescript
import { ConfigSchema } from '@pram1t/mustard-config';

// Only override what you need
const config = ConfigSchema.parse({
  logging: { level: 'debug' },
  // All other values use defaults
});
```

## Environment-Specific Defaults

| Setting | Development | Production |
|---------|-------------|------------|
| `logging.level` | `debug` | `info` |
| `logging.format` | `pretty` | `json` |

Development mode is detected when `NODE_ENV` is not `production`.

## Best Practices

1. **Use .env.example**: Keep a template for required variables
2. **Never commit .env**: It should be in .gitignore
3. **Validate early**: Call `validateStartup()` at application start
4. **Use typed access**: Use `getConfig()` for type-safe access
5. **Don't hardcode**: Always use config for tuneable values

## Troubleshooting

### Missing API Key

```
ConfigError: Missing required configuration
  - OPENAI_API_KEY is required when using OpenAI provider
```

Solution: Set `OPENAI_API_KEY` in your environment or `.env` file.

### Invalid Value

```
ConfigError: Configuration validation failed
  - llm.retryAttempts: Number must be less than or equal to 10
```

Solution: Check the valid ranges in the schema documentation above.

### Config Not Updating

If changes to `.env` aren't reflected, the config may be cached:

```typescript
import { resetConfig, getConfig } from '@pram1t/mustard-config';

resetConfig();
const config = getConfig();
```
