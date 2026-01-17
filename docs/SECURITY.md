# Security Guide

This document describes the security features and best practices for OpenAgent.

## Overview

OpenAgent implements several security measures to protect against common vulnerabilities:

- **Environment Variable Filtering**: Prevents secrets from leaking to child processes
- **Input Sanitization**: Protects against path traversal and injection attacks
- **Audit Logging**: Tracks tool executions for security monitoring
- **Configuration Validation**: Ensures secure defaults

## Environment Variable Filtering

### The Problem

When executing shell commands, passing `process.env` directly to child processes can leak sensitive information:

```typescript
// DANGEROUS: Leaks API keys to child process
spawn('bash', ['-c', command], { env: process.env });
```

### The Solution

OpenAgent filters environment variables before passing them to child processes:

```typescript
// SAFE: Only safe variables are passed
const safeEnv = filterEnvVars();
spawn('bash', ['-c', command], { env: safeEnv });
```

### Safe Variables (Allowlist)

These variables are always allowed:

| Category | Variables |
|----------|-----------|
| System Paths | PATH, HOME, USER, SHELL, PWD |
| Locale | LANG, LC_ALL, LC_CTYPE, TZ |
| Node.js | NODE_ENV, NODE_PATH |
| Git (safe) | GIT_AUTHOR_NAME, GIT_AUTHOR_EMAIL |
| Windows | USERPROFILE, APPDATA, TEMP, TMP |
| Unix | TMPDIR, XDG_CONFIG_HOME |

### Blocked Variables

These variables are NEVER passed through:

| Category | Examples |
|----------|----------|
| API Keys | OPENAI_API_KEY, ANTHROPIC_API_KEY, GITHUB_TOKEN |
| AWS Credentials | AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY |
| Database | DATABASE_URL, DATABASE_PASSWORD, POSTGRES_PASSWORD |
| Auth Secrets | JWT_SECRET, SESSION_SECRET, CLIENT_SECRET |
| Generic Patterns | *_TOKEN, *_SECRET, *_PASSWORD, *_CREDENTIAL |

### Custom Allowed Variables

To pass additional variables to bash commands, configure in `.env`:

```env
BASH_ALLOWED_ENV_VARS=MY_CUSTOM_VAR,ANOTHER_SAFE_VAR
```

## Input Sanitization

### Path Sanitization

Protects against path traversal attacks:

```typescript
import { sanitizePath } from '@openagent/tools';

// Safe: Returns normalized path
sanitizePath('subdir/file.txt', '/base');
// -> '/base/subdir/file.txt'

// Throws: Path traversal detected
sanitizePath('../etc/passwd', '/base');
// -> Error: Path traversal is not allowed

// Throws: URL-encoded traversal
sanitizePath('%2e%2e/etc/passwd', '/base');
// -> Error: Path traversal is not allowed
```

### Regex Validation

Protects against ReDoS (Regular Expression Denial of Service):

```typescript
import { validateRegexPattern } from '@openagent/tools';

// Safe: Valid pattern
validateRegexPattern('hello.*world'); // true

// Throws: Potentially dangerous pattern
validateRegexPattern('(.*)+.*');
// -> Error: Regex pattern may cause performance issues
```

### Command Validation

Basic validation for shell commands:

```typescript
import { validateCommand } from '@openagent/tools';

// Safe: Normal command
validateCommand('git status'); // true

// Throws: Command with null byte
validateCommand('ls\0rm -rf /');
// -> Error: Command contains invalid characters
```

## Audit Logging

### Enabling Audit Logging

Set in your environment:

```env
AUDIT_LOGGING=true
```

### What Gets Logged

When enabled, all tool executions are logged:

```json
{
  "level": "info",
  "msg": "AUDIT: Tool executed - Bash",
  "audit": true,
  "tool": "Bash",
  "params": { "command": "git status" },
  "sessionId": "session-123",
  "cwd": "/project",
  "timestamp": "2024-01-15T10:30:45.123Z"
}
```

### Sensitive Data Handling

Audit logs automatically truncate long parameters to prevent logging sensitive data:

```typescript
// Long content is truncated
params.content = "Very long file content..."; // -> "Very long file...[truncated]"
```

## Security Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SANITIZE_INPUTS` | `true` | Enable input sanitization |
| `AUDIT_LOGGING` | `false` | Enable audit logging |
| `BASH_ALLOWED_ENV_VARS` | (none) | Additional allowed env vars |

### Disabling Sanitization

For trusted environments, sanitization can be disabled:

```env
SANITIZE_INPUTS=false
```

**Warning**: Only disable in controlled, trusted environments.

## Security Best Practices

### 1. API Key Management

- Never commit API keys to version control
- Use `.env` files for local development
- Use secrets management for production
- Rotate keys regularly

```bash
# .gitignore
.env
.env.local
*.pem
*.key
```

### 2. File System Access

- Validate all file paths before access
- Use `sanitizePath()` for user-provided paths
- Limit file operations to project directories

```typescript
import { sanitizePath } from '@openagent/tools';

const safePath = sanitizePath(userInput, projectRoot);
```

### 3. Shell Command Execution

- Minimize use of BashTool
- Never pass user input directly to shell
- Always review commands before execution
- Use specific tools (Read, Write) when possible

### 4. Audit Logging

Enable audit logging in production:

```env
AUDIT_LOGGING=true
LOG_LEVEL=info
```

Monitor logs for:
- Unusual file access patterns
- Suspicious commands
- Failed operations

### 5. Least Privilege

- Only enable necessary tools
- Configure allowed env vars minimally
- Use read-only access where possible

## Reporting Security Issues

If you discover a security vulnerability:

1. Do NOT open a public issue
2. Email security details privately
3. Include reproduction steps
4. Allow time for a fix before disclosure

## Security Checklist

Before deploying OpenAgent:

- [ ] API keys stored securely (not in code)
- [ ] `.env` files in `.gitignore`
- [ ] Audit logging enabled (`AUDIT_LOGGING=true`)
- [ ] Input sanitization enabled (`SANITIZE_INPUTS=true`)
- [ ] Reviewed allowed environment variables
- [ ] Tested with potentially malicious inputs
- [ ] Logs monitored for security events
