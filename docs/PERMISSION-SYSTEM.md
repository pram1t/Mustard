# Permission System

This document describes the permission system that controls tool access.

## Overview

The permission system provides fine-grained control over what actions the agent can take:
- Allow specific tools or patterns automatically
- Deny dangerous operations
- Ask for user confirmation on sensitive actions

## Permission Evaluation Order

```
┌─────────────────────────────────────────────────────────────┐
│                 PERMISSION EVALUATION                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Tool Call Requested                                         │
│          │                                                   │
│          ▼                                                   │
│  ┌───────────────────┐                                      │
│  │ 1. Pre-Tool Hook  │──▶ blocked? ──▶ DENY                 │
│  └─────────┬─────────┘                                      │
│            │                                                 │
│            ▼                                                 │
│  ┌───────────────────┐                                      │
│  │ 2. Deny Rules     │──▶ matches? ──▶ DENY                 │
│  └─────────┬─────────┘                                      │
│            │                                                 │
│            ▼                                                 │
│  ┌───────────────────┐                                      │
│  │ 3. Allow Rules    │──▶ matches? ──▶ ALLOW                │
│  └─────────┬─────────┘                                      │
│            │                                                 │
│            ▼                                                 │
│  ┌───────────────────┐                                      │
│  │ 4. Ask Rules      │──▶ matches? ──▶ PROMPT USER          │
│  └─────────┬─────────┘                                      │
│            │                                                 │
│            ▼                                                 │
│  ┌───────────────────┐                                      │
│  │ 5. Permission     │                                      │
│  │    Mode Default   │                                      │
│  └─────────┬─────────┘                                      │
│            │                                                 │
│            ▼                                                 │
│  Default action based on mode                                │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Permission Rules

```typescript
// packages/core/src/permissions/types.ts

/**
 * Permission rule that matches tool calls
 */
interface PermissionRule {
  /** Tool name or pattern */
  tool: string;
  /** Whether this is a regex pattern */
  pattern?: boolean;
  /** Additional conditions */
  conditions?: {
    /** Match specific parameter values */
    params?: Record<string, unknown>;
    /** Match file path patterns */
    pathPattern?: string;
    /** Match command patterns (for Bash) */
    commandPattern?: string;
  };
}

/**
 * Permission configuration
 */
interface PermissionConfig {
  /** Mode determines default behavior */
  mode: 'default' | 'strict' | 'permissive';

  /** Rules that automatically allow */
  allow: PermissionRule[];

  /** Rules that automatically deny */
  deny: PermissionRule[];

  /** Rules that prompt user for approval */
  ask: PermissionRule[];
}
```

## Permission Manager Implementation

```typescript
// packages/core/src/permissions/manager.ts

import type { PermissionRule, PermissionConfig } from './types';

type PermissionResult = 'allow' | 'deny' | 'ask';

export class PermissionManager {
  private config: PermissionConfig;
  private approvalCallbacks: Map<string, (approved: boolean) => void> = new Map();

  constructor(config: PermissionConfig) {
    this.config = {
      mode: 'default',
      allow: [],
      deny: [],
      ask: [],
      ...config,
    };
  }

  /**
   * Check permission for a tool call
   */
  async check(
    tool: string,
    params: Record<string, unknown>
  ): Promise<PermissionResult> {
    // 1. Check deny rules first (highest priority)
    for (const rule of this.config.deny) {
      if (this.matchesRule(rule, tool, params)) {
        return 'deny';
      }
    }

    // 2. Check allow rules
    for (const rule of this.config.allow) {
      if (this.matchesRule(rule, tool, params)) {
        return 'allow';
      }
    }

    // 3. Check ask rules
    for (const rule of this.config.ask) {
      if (this.matchesRule(rule, tool, params)) {
        return 'ask';
      }
    }

    // 4. Default based on mode
    switch (this.config.mode) {
      case 'strict':
        return 'ask';  // Ask for everything not explicitly allowed
      case 'permissive':
        return 'allow'; // Allow everything not explicitly denied
      default:
        return this.getDefaultForTool(tool);
    }
  }

  /**
   * Request user approval for a tool call
   */
  async requestApproval(
    tool: string,
    params: Record<string, unknown>
  ): Promise<boolean> {
    // In production, this emits an event that the UI handles
    // The UI calls resolveApproval when user responds

    return new Promise((resolve) => {
      const id = `${tool}_${Date.now()}`;
      this.approvalCallbacks.set(id, resolve);

      // Timeout after 60 seconds
      setTimeout(() => {
        if (this.approvalCallbacks.has(id)) {
          this.approvalCallbacks.delete(id);
          resolve(false); // Default to deny on timeout
        }
      }, 60000);
    });
  }

  /**
   * UI calls this when user responds
   */
  resolveApproval(id: string, approved: boolean): void {
    const callback = this.approvalCallbacks.get(id);
    if (callback) {
      this.approvalCallbacks.delete(id);
      callback(approved);
    }
  }

  /**
   * Check if a rule matches the tool call
   */
  private matchesRule(
    rule: PermissionRule,
    tool: string,
    params: Record<string, unknown>
  ): boolean {
    // Check tool name
    if (rule.pattern) {
      const regex = new RegExp(rule.tool);
      if (!regex.test(tool)) return false;
    } else {
      if (rule.tool !== '*' && rule.tool !== tool) return false;
    }

    // Check conditions if specified
    if (rule.conditions) {
      // Check param values
      if (rule.conditions.params) {
        for (const [key, value] of Object.entries(rule.conditions.params)) {
          if (params[key] !== value) return false;
        }
      }

      // Check file path pattern
      if (rule.conditions.pathPattern && params.file_path) {
        const regex = new RegExp(rule.conditions.pathPattern);
        if (!regex.test(params.file_path as string)) return false;
      }

      // Check command pattern (for Bash)
      if (rule.conditions.commandPattern && params.command) {
        const regex = new RegExp(rule.conditions.commandPattern);
        if (!regex.test(params.command as string)) return false;
      }
    }

    return true;
  }

  /**
   * Get default permission for a tool in default mode
   */
  private getDefaultForTool(tool: string): PermissionResult {
    // Read-only tools are allowed by default
    const readOnlyTools = ['Read', 'Glob', 'Grep', 'WebFetch', 'WebSearch'];
    if (readOnlyTools.includes(tool)) {
      return 'allow';
    }

    // Everything else asks
    return 'ask';
  }

  /**
   * Add a temporary allow rule (for session)
   */
  allowTemporary(rule: PermissionRule): void {
    this.config.allow.push(rule);
  }

  /**
   * Add a temporary deny rule (for session)
   */
  denyTemporary(rule: PermissionRule): void {
    this.config.deny.unshift(rule); // Prepend so it takes priority
  }
}
```

## Configuration Examples

### Default Mode (Balanced)

```json
{
  "permissions": {
    "mode": "default",
    "allow": [
      { "tool": "Read" },
      { "tool": "Glob" },
      { "tool": "Grep" }
    ],
    "deny": [
      { "tool": "Bash", "conditions": { "commandPattern": "rm\\s+-rf" } },
      { "tool": "Write", "conditions": { "pathPattern": "\\.(env|key|pem)$" } }
    ],
    "ask": [
      { "tool": "Bash" },
      { "tool": "Write" },
      { "tool": "Edit" }
    ]
  }
}
```

### Strict Mode (High Security)

```json
{
  "permissions": {
    "mode": "strict",
    "allow": [
      { "tool": "Read", "conditions": { "pathPattern": "^/home/user/project" } }
    ],
    "deny": [
      { "tool": "Bash" },
      { "tool": "*", "conditions": { "pathPattern": "\\.(env|key|pem|secret)$" } }
    ],
    "ask": []
  }
}
```

### Permissive Mode (Development)

```json
{
  "permissions": {
    "mode": "permissive",
    "allow": [
      { "tool": "*" }
    ],
    "deny": [
      { "tool": "Bash", "conditions": { "commandPattern": "rm\\s+-rf\\s+/" } },
      { "tool": "Write", "conditions": { "pathPattern": "/etc/" } }
    ],
    "ask": []
  }
}
```

## Permission Hierarchy

Configuration is merged from multiple sources:

```
┌─────────────────────────────────────────────────────────────┐
│                 CONFIGURATION HIERARCHY                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. User-level (~/.openagent/config.json)                   │
│     └── Base permissions, personal preferences               │
│                                                              │
│  2. Project-level (.openagent/config.json)                  │
│     └── Shared team settings, committed to repo              │
│                                                              │
│  3. Project-local (.openagent/config.local.json)            │
│     └── Personal overrides, not committed                    │
│                                                              │
│  4. CLI flags (--allow, --deny)                              │
│     └── Session-specific overrides                           │
│                                                              │
│  Merge order: User → Project → Local → CLI                   │
│  Later sources override earlier ones                         │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Built-in Safety Rules

These rules are always enforced regardless of configuration:

```typescript
const BUILTIN_DENY_RULES: PermissionRule[] = [
  // Never write to system directories
  { tool: 'Write', conditions: { pathPattern: '^/(bin|sbin|usr|etc|var)/' } },
  { tool: 'Edit', conditions: { pathPattern: '^/(bin|sbin|usr|etc|var)/' } },

  // Never execute destructive commands without path
  { tool: 'Bash', conditions: { commandPattern: 'rm\\s+-rf\\s+/' } },
  { tool: 'Bash', conditions: { commandPattern: 'rm\\s+-rf\\s+~' } },
  { tool: 'Bash', conditions: { commandPattern: 'rm\\s+-rf\\s+\\*' } },

  // Never expose secrets
  { tool: 'Read', conditions: { pathPattern: '\\.(env|pem|key|secret)$' } },
];
```

## User Approval Flow

When a tool requires approval:

```
┌─────────────────────────────────────────────────────────────┐
│                   APPROVAL FLOW                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Agent: "I need to write to src/config.ts"                  │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  [CLI/Desktop shows approval prompt]                │    │
│  │                                                     │    │
│  │  Tool: Write                                        │    │
│  │  File: src/config.ts                                │    │
│  │                                                     │    │
│  │  Preview:                                           │    │
│  │  + export const API_URL = 'https://api.example';    │    │
│  │  - export const API_URL = 'http://localhost';       │    │
│  │                                                     │    │
│  │  [Allow] [Allow All] [Deny] [Deny All]              │    │
│  │                                                     │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  Options:                                                    │
│  - Allow: Approve this single action                         │
│  - Allow All: Allow this tool for rest of session           │
│  - Deny: Reject this single action                          │
│  - Deny All: Block this tool for rest of session            │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## CLI Commands

```bash
# Run with specific permission mode
openagent --mode strict "..."
openagent --mode permissive "..."

# Temporarily allow a tool
openagent --allow Bash "..."

# Temporarily deny a tool
openagent --deny Write "..."

# Allow specific file patterns
openagent --allow-path "src/**/*.ts" "..."
```

## Audit Logging

All permission decisions are logged:

```typescript
interface PermissionAuditEntry {
  timestamp: number;
  sessionId: string;
  tool: string;
  params: Record<string, unknown>;
  decision: 'allow' | 'deny' | 'ask';
  userApproved?: boolean;
  matchedRule?: PermissionRule;
}
```

## Next Steps

- See [HOOK-SYSTEM.md](HOOK-SYSTEM.md) for pre/post tool hooks
- See [CONFIGURATION.md](CONFIGURATION.md) for config file details
- See [CLI-INTERFACE.md](CLI-INTERFACE.md) for permission flags
