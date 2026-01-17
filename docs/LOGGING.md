# Logging Guide

This document describes the logging infrastructure for the OpenAgent project.

## Overview

OpenAgent uses [Pino](https://getpino.io/) as the logging framework. Pino is a fast, low-overhead JSON logger that provides:

- Structured JSON logging for production
- Pretty-printed output for development
- Child loggers for context correlation
- Multiple log levels

## Package

The logger is provided by the `@openagent/logger` package.

```typescript
import { createLogger, getLogger, setDefaultLogger } from '@openagent/logger';
```

## Quick Start

### Using the Default Logger

```typescript
import { getLogger } from '@openagent/logger';

const logger = getLogger();

logger.info('Application started');
logger.debug('Debug information', { key: 'value' });
logger.warn('Warning message');
logger.error('Error occurred');
```

### Creating a Custom Logger

```typescript
import { createLogger } from '@openagent/logger';

const logger = createLogger({
  level: 'debug',
  name: 'my-component',
  format: 'pretty', // or 'json'
});
```

## Log Levels

Available log levels in order of severity:

| Level | Use Case |
|-------|----------|
| `trace` | Very detailed debugging information |
| `debug` | Debug information, helpful during development |
| `info` | General operational information |
| `warn` | Warning messages for potentially harmful situations |
| `error` | Error messages for failures |
| `fatal` | Critical errors that cause application exit |
| `silent` | Disable all logging |

### Default Levels

- **Development** (`NODE_ENV !== 'production'`): `debug`
- **Production** (`NODE_ENV === 'production'`): `info`

Override with `LOG_LEVEL` environment variable:

```bash
LOG_LEVEL=trace npm start
```

## Configuration

### LoggerConfig Options

```typescript
interface LoggerConfig {
  level?: LogLevel;           // Log level threshold
  format?: 'json' | 'pretty'; // Output format
  name?: string;              // Logger name
  timestamp?: boolean;        // Include timestamps (default: true)
  context?: LogContext;       // Base context for all logs
}
```

### Environment Variables

| Variable | Values | Default |
|----------|--------|---------|
| `LOG_LEVEL` | trace, debug, info, warn, error, fatal, silent | Based on NODE_ENV |
| `LOG_FORMAT` | json, pretty | Based on NODE_ENV |
| `NODE_ENV` | development, production | development |

## Child Loggers

Create child loggers to add context that persists across log calls:

```typescript
const logger = getLogger();

// Create child with request context
const requestLogger = logger.child({
  requestId: 'req-123',
  userId: 'user-456',
});

requestLogger.info('Processing request'); // Includes requestId and userId
requestLogger.debug('Step 1 complete');
requestLogger.info('Request complete');
```

## Logging Patterns

### Logging with Context

```typescript
// Context as second parameter
logger.info('User logged in', { userId: '123', ip: '192.168.1.1' });

// For errors with additional context
logger.error('Database connection failed', { host: 'db.example.com', port: 5432 });
```

### Logging Errors

```typescript
try {
  await someOperation();
} catch (error) {
  // Log error with message
  logger.error(error, 'Operation failed');

  // Or just the error (uses error.message)
  logger.error(error);
}
```

### Tool Execution Logging

The tools package logs tool execution:

```typescript
// Debug level - execution start
logger.debug('Executing tool: read', { toolName: 'read', params: { file_path: '/foo' } });

// Debug level - execution complete
logger.debug('Tool execution completed: read', { toolName: 'read', success: true, durationMs: 15 });

// Error level - execution failure
logger.error('Tool threw an error', { toolName: 'read', error: 'File not found' });
```

### LLM Router Logging

The LLM router logs provider events:

```typescript
// Warn level - provider not found
logger.warn('Provider not registered, skipping', { providerName: 'openai' });

// Warn level - retry attempt
logger.warn('Provider attempt failed', { providerName: 'openai', attempt: 1, maxAttempts: 3 });
```

## Output Formats

### Pretty Format (Development)

```
[2024-01-15 10:30:45] INFO (openagent): Application started
[2024-01-15 10:30:45] DEBUG (openagent): Processing request
    requestId: "req-123"
    userId: "user-456"
```

### JSON Format (Production)

```json
{"level":30,"time":"2024-01-15T10:30:45.123Z","name":"openagent","msg":"Application started"}
{"level":20,"time":"2024-01-15T10:30:45.456Z","name":"openagent","requestId":"req-123","userId":"user-456","msg":"Processing request"}
```

## Integration

### Setting the Default Logger

Configure logging at application startup:

```typescript
import { createLogger, setDefaultLogger } from '@openagent/logger';

// Create and set custom default logger
const logger = createLogger({
  level: process.env.LOG_LEVEL as LogLevel || 'info',
  name: 'myapp',
});

setDefaultLogger(logger);
```

### Using in Packages

Other packages import and use the logger:

```typescript
import { getLogger } from '@openagent/logger';

export class MyService {
  private logger = getLogger();

  async doSomething() {
    this.logger.info('Doing something');
    // ...
  }
}
```

## Testing

For tests, create a silent logger to suppress output:

```typescript
import { createLogger, setDefaultLogger, resetDefaultLogger } from '@openagent/logger';

beforeEach(() => {
  setDefaultLogger(createLogger({ level: 'silent' }));
});

afterEach(() => {
  resetDefaultLogger();
});
```

## Best Practices

1. **Use Structured Data**: Pass context as objects, not string concatenation
   ```typescript
   // Good
   logger.info('User action', { userId, action, duration });

   // Avoid
   logger.info(`User ${userId} performed ${action} in ${duration}ms`);
   ```

2. **Choose Appropriate Levels**:
   - `debug` for development diagnostics
   - `info` for business events
   - `warn` for recoverable issues
   - `error` for failures

3. **Use Child Loggers**: For request-scoped context (requestId, sessionId)

4. **Include Duration**: Log execution time for performance monitoring
   ```typescript
   const start = Date.now();
   await operation();
   logger.info('Operation complete', { durationMs: Date.now() - start });
   ```

5. **Don't Log Sensitive Data**: Never log passwords, tokens, or PII
