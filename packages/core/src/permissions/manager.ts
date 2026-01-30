/**
 * Permission Manager
 *
 * Manages the four-level permission system for controlling tool access.
 * Provides rule matching, approval caching, and user prompt callbacks.
 */

import { getLogger } from '@openagent/logger';
import type {
  PermissionMode,
  PermissionDecision,
  PermissionRule,
  PermissionResult,
  PermissionContext,
  PermissionConfig,
  ApprovalCallback,
} from './types.js';

// ============================================================================
// Built-in Deny Rules (hardcoded, never bypassable)
// ============================================================================

/**
 * Built-in deny rules that are always enforced for safety.
 * These cannot be overridden by configuration.
 */
const BUILTIN_DENY_RULES: PermissionRule[] = [
  // ==========================================================================
  // Unix/Linux System Directories
  // ==========================================================================
  {
    type: 'builtin_deny',
    tool: 'Write',
    pathPattern: '^/(bin|sbin|usr|etc|var|boot|lib|lib64|opt|root|sys|proc)(/|$)',
    reason: 'Writing to system directories is not allowed',
  },
  {
    type: 'builtin_deny',
    tool: 'Edit',
    pathPattern: '^/(bin|sbin|usr|etc|var|boot|lib|lib64|opt|root|sys|proc)(/|$)',
    reason: 'Editing system directories is not allowed',
  },

  // ==========================================================================
  // Windows System Directories (expanded)
  // ==========================================================================
  {
    type: 'builtin_deny',
    tool: 'Write',
    pathPattern: '^[A-Za-z]:[\\\\/](Windows|Program Files|Program Files \\(x86\\)|ProgramData|System32|SysWOW64|System|drivers|Boot|Recovery)($|[\\\\/])',
    reason: 'Writing to Windows system directories is not allowed',
  },
  {
    type: 'builtin_deny',
    tool: 'Edit',
    pathPattern: '^[A-Za-z]:[\\\\/](Windows|Program Files|Program Files \\(x86\\)|ProgramData|System32|SysWOW64|System|drivers|Boot|Recovery)($|[\\\\/])',
    reason: 'Editing Windows system directories is not allowed',
  },

  // ==========================================================================
  // Dangerous Shell Commands
  // ==========================================================================
  {
    type: 'builtin_deny',
    tool: 'Bash',
    commandPattern: 'rm\\s+(-[rRf]+\\s+)*(/|~|\\$HOME)\\s*$',
    reason: 'Removing root or home directory is not allowed',
  },
  {
    type: 'builtin_deny',
    tool: 'Bash',
    commandPattern: 'rm\\s+-[rRf]*\\s+--no-preserve-root',
    reason: 'Dangerous rm command with --no-preserve-root is not allowed',
  },
  {
    type: 'builtin_deny',
    tool: 'Bash',
    commandPattern: '(mkfs|fdisk|parted|dd\\s+if=.+\\s+of=/dev/)',
    reason: 'Disk formatting/partitioning commands are not allowed',
  },
  {
    type: 'builtin_deny',
    tool: 'Bash',
    commandPattern: '^\\s*(sudo|su)\\s+',
    reason: 'Privilege escalation commands are not allowed',
  },

  // ==========================================================================
  // Environment/Secret Files
  // ==========================================================================
  {
    type: 'builtin_deny',
    tool: 'Read',
    pathPattern: '\\.env(\\.local|\\.production|\\.secret|\\.development|\\.test)?$',
    reason: 'Reading .env files may expose secrets',
  },
  {
    type: 'builtin_deny',
    tool: 'Read',
    pathPattern: '\\.(pem|key|p12|pfx|secret|p7b|cer|crt|der)$',
    reason: 'Reading private key/certificate files is not allowed',
  },

  // ==========================================================================
  // SSH Credentials
  // ==========================================================================
  {
    type: 'builtin_deny',
    tool: 'Read',
    pathPattern: '[\\\\/]\\.ssh[\\\\/](id_|known_hosts|authorized_keys|config)',
    reason: 'Reading SSH credential files is not allowed',
  },

  // ==========================================================================
  // Cloud Provider Credentials
  // ==========================================================================
  {
    type: 'builtin_deny',
    tool: 'Read',
    pathPattern: '[\\\\/]\\.aws[\\\\/](credentials|config)$',
    reason: 'Reading AWS credential files is not allowed',
  },
  {
    type: 'builtin_deny',
    tool: 'Read',
    pathPattern: '[\\\\/]\\.gcloud[\\\\/]',
    reason: 'Reading GCloud configuration is not allowed',
  },
  {
    type: 'builtin_deny',
    tool: 'Read',
    pathPattern: '[\\\\/]\\.azure[\\\\/]',
    reason: 'Reading Azure configuration is not allowed',
  },
  {
    type: 'builtin_deny',
    tool: 'Read',
    pathPattern: 'service[_-]?account[^/\\\\]*\\.json$',
    reason: 'Reading service account files is not allowed',
  },

  // ==========================================================================
  // Container/Orchestration Credentials
  // ==========================================================================
  {
    type: 'builtin_deny',
    tool: 'Read',
    pathPattern: '[\\\\/]\\.docker[\\\\/]config\\.json$',
    reason: 'Reading Docker credentials is not allowed',
  },
  {
    type: 'builtin_deny',
    tool: 'Read',
    pathPattern: '[\\\\/]\\.kube[\\\\/]config$',
    reason: 'Reading Kubernetes configuration is not allowed',
  },

  // ==========================================================================
  // Generic Credential Files
  // ==========================================================================
  {
    type: 'builtin_deny',
    tool: 'Read',
    pathPattern: '(^|[\\\\/])credentials(\\.json|\\.yaml|\\.yml|\\.xml)?$',
    reason: 'Reading credential files is not allowed',
  },
  {
    type: 'builtin_deny',
    tool: 'Read',
    pathPattern: '[\\\\/]_netrc$',
    reason: 'Reading netrc files is not allowed',
  },
  {
    type: 'builtin_deny',
    tool: 'Read',
    pathPattern: '[\\\\/]\\.netrc$',
    reason: 'Reading netrc files is not allowed',
  },
  {
    type: 'builtin_deny',
    tool: 'Read',
    pathPattern: '[\\\\/]\\.npmrc$',
    reason: 'Reading npmrc may expose auth tokens',
  },
  {
    type: 'builtin_deny',
    tool: 'Read',
    pathPattern: '[\\\\/]\\.pypirc$',
    reason: 'Reading pypirc may expose auth tokens',
  },
];

// ============================================================================
// Default Allow Tools (for 'default' mode)
// ============================================================================

/**
 * Tools that are allowed by default in 'default' mode.
 * These are read-only tools that don't modify the system.
 */
const DEFAULT_ALLOW_TOOLS: string[] = [
  'Read',
  'Glob',
  'Grep',
  'WebFetch',
  'WebSearch',
];

// ============================================================================
// Permission Manager Class
// ============================================================================

/**
 * Permission Manager
 *
 * Manages tool permissions with a four-level rule system:
 * 1. Built-in deny rules (hardcoded, never bypassable)
 * 2. Custom deny rules (user-configured)
 * 3. Allow rules (user-configured)
 * 4. Ask rules / default behavior (based on mode)
 */
export class PermissionManager {
  private mode: PermissionMode;
  private denyRules: PermissionRule[];
  private allowRules: PermissionRule[];
  private askRules: PermissionRule[];
  private defaultAllowTools: Set<string>;
  private cacheApprovals: boolean;
  private approvalCache: Map<string, boolean>;
  private approvalCallback?: ApprovalCallback;

  /**
   * Create a new PermissionManager.
   *
   * @param config - Permission configuration
   */
  constructor(config: Partial<PermissionConfig> = {}) {
    this.mode = config.mode || 'default';
    this.denyRules = config.denyRules || [];
    this.allowRules = config.allowRules || [];
    this.askRules = config.askRules || [];
    this.defaultAllowTools = new Set(config.defaultAllowTools || DEFAULT_ALLOW_TOOLS);
    this.cacheApprovals = config.cacheApprovals !== false; // Default true
    this.approvalCache = new Map();
  }

  /**
   * Set the approval callback for requesting user permission.
   *
   * @param callback - Function to call when user approval is needed
   */
  setApprovalCallback(callback: ApprovalCallback): void {
    this.approvalCallback = callback;
  }

  /**
   * Clear the approval cache.
   * Call this when starting a new session or when approvals should be reset.
   */
  clearCache(): void {
    this.approvalCache.clear();
  }

  /**
   * Check if a tool invocation is permitted.
   *
   * @param context - The permission context (tool, params, sessionId)
   * @returns PermissionResult indicating the decision
   */
  async check(context: PermissionContext): Promise<PermissionResult> {
    const logger = getLogger();

    // 1. Check built-in deny rules (highest priority, never bypassable)
    for (const rule of BUILTIN_DENY_RULES) {
      if (this.matchesRule(rule, context)) {
        logger.debug('Permission denied by built-in rule', {
          tool: context.tool,
          rule: rule.reason,
        });
        return {
          decision: 'deny',
          matchedRule: rule,
          reason: rule.reason || 'Blocked by built-in security rule',
        };
      }
    }

    // 2. Check custom deny rules
    for (const rule of this.denyRules) {
      if (this.matchesRule(rule, context)) {
        logger.debug('Permission denied by custom rule', {
          tool: context.tool,
          rule: rule.reason,
        });
        return {
          decision: 'deny',
          matchedRule: rule,
          reason: rule.reason || 'Blocked by custom deny rule',
        };
      }
    }

    // 3. Check allow rules
    for (const rule of this.allowRules) {
      if (this.matchesRule(rule, context)) {
        logger.debug('Permission allowed by custom rule', {
          tool: context.tool,
          rule: rule.reason,
        });
        return {
          decision: 'allow',
          matchedRule: rule,
          reason: rule.reason || 'Allowed by custom allow rule',
        };
      }
    }

    // 4. Check ask rules
    for (const rule of this.askRules) {
      if (this.matchesRule(rule, context)) {
        return await this.handleAsk(context, rule);
      }
    }

    // 5. Apply default behavior based on mode
    return await this.applyDefaultMode(context);
  }

  /**
   * Check if a rule matches the given context.
   */
  matchesRule(rule: PermissionRule, context: PermissionContext): boolean {
    // Check tool name exact match
    if (rule.tool && rule.tool !== context.tool) {
      return false;
    }

    // Check tool pattern (regex)
    if (rule.toolPattern) {
      try {
        const regex = new RegExp(rule.toolPattern, 'i');
        if (!regex.test(context.tool)) {
          return false;
        }
      } catch {
        // Invalid regex, skip this rule
        return false;
      }
    }

    // Check path pattern (for Write, Edit, Read tools)
    if (rule.pathPattern) {
      const filePath = this.extractFilePath(context);
      if (!filePath) {
        return false;
      }
      try {
        const regex = new RegExp(rule.pathPattern, 'i');
        if (!regex.test(filePath)) {
          return false;
        }
      } catch {
        // Invalid regex, skip this rule
        return false;
      }
    }

    // Check command pattern (for Bash tool)
    if (rule.commandPattern) {
      const command = this.extractCommand(context);
      if (!command) {
        return false;
      }
      try {
        const regex = new RegExp(rule.commandPattern, 'i');
        if (!regex.test(command)) {
          return false;
        }
      } catch {
        // Invalid regex, skip this rule
        return false;
      }
    }

    // If no specific pattern is required, match on tool name only
    if (!rule.tool && !rule.toolPattern && !rule.pathPattern && !rule.commandPattern) {
      return false; // Empty rules match nothing
    }

    return true;
  }

  /**
   * Extract file path from tool parameters.
   */
  private extractFilePath(context: PermissionContext): string | null {
    const params = context.params;
    // Common parameter names for file paths
    const pathKeys = ['file_path', 'filePath', 'path', 'file'];
    for (const key of pathKeys) {
      if (typeof params[key] === 'string') {
        return params[key] as string;
      }
    }
    return null;
  }

  /**
   * Extract command from Bash tool parameters.
   */
  private extractCommand(context: PermissionContext): string | null {
    const params = context.params;
    if (typeof params.command === 'string') {
      return params.command;
    }
    return null;
  }

  /**
   * Handle an 'ask' decision by checking cache or prompting user.
   */
  private async handleAsk(
    context: PermissionContext,
    rule?: PermissionRule
  ): Promise<PermissionResult> {
    const cacheKey = this.buildCacheKey(context);
    const reason = rule?.reason || `Tool ${context.tool} requires approval`;

    // Check cache first
    if (this.cacheApprovals && this.approvalCache.has(cacheKey)) {
      const approved = this.approvalCache.get(cacheKey)!;
      return {
        decision: approved ? 'allow' : 'deny',
        matchedRule: rule,
        reason: approved ? 'Previously approved' : 'Previously denied',
        userApproved: approved,
      };
    }

    // If no callback, return ask decision without approval
    if (!this.approvalCallback) {
      return {
        decision: 'ask',
        matchedRule: rule,
        reason,
        userApproved: undefined,
      };
    }

    // Prompt user for approval
    const logger = getLogger();
    logger.debug('Requesting user approval', {
      tool: context.tool,
      reason,
    });

    try {
      const approved = await this.approvalCallback(context.tool, context.params, reason);

      // Cache the result
      if (this.cacheApprovals) {
        this.approvalCache.set(cacheKey, approved);
      }

      return {
        decision: approved ? 'allow' : 'deny',
        matchedRule: rule,
        reason: approved ? 'User approved' : 'User denied',
        userApproved: approved,
      };
    } catch (error) {
      logger.warn('Approval callback failed', { error });
      return {
        decision: 'deny',
        matchedRule: rule,
        reason: 'Approval request failed',
        userApproved: false,
      };
    }
  }

  /**
   * Apply default permission behavior based on mode.
   */
  private async applyDefaultMode(context: PermissionContext): Promise<PermissionResult> {
    switch (this.mode) {
      case 'permissive':
        // Allow everything not explicitly denied
        return {
          decision: 'allow',
          reason: 'Permissive mode: allowed by default',
        };

      case 'strict':
        // Ask for everything not explicitly allowed
        return await this.handleAsk(context, {
          type: 'ask',
          tool: context.tool,
          reason: `Strict mode: ${context.tool} requires approval`,
        });

      case 'default':
      default:
        // Allow safe tools, ask for others
        if (this.defaultAllowTools.has(context.tool)) {
          return {
            decision: 'allow',
            reason: `Default mode: ${context.tool} is a safe tool`,
          };
        }
        return await this.handleAsk(context, {
          type: 'ask',
          tool: context.tool,
          reason: `Default mode: ${context.tool} requires approval`,
        });
    }
  }

  /**
   * Build a cache key for the approval cache.
   * Uses tool name and a hash of params for uniqueness.
   */
  private buildCacheKey(context: PermissionContext): string {
    // For simplicity, cache by tool + sessionId + simplified params
    // More sophisticated implementations might hash specific params
    const paramsKey = this.simplifyParams(context);
    return `${context.sessionId}:${context.tool}:${paramsKey}`;
  }

  /**
   * Simplify params for cache key generation.
   */
  private simplifyParams(context: PermissionContext): string {
    const params = context.params;
    // For file operations, use the path
    const filePath = this.extractFilePath(context);
    if (filePath) {
      return filePath;
    }
    // For bash, use the command (truncated)
    const command = this.extractCommand(context);
    if (command) {
      return command.slice(0, 100);
    }
    // Default: stringify params
    try {
      return JSON.stringify(params).slice(0, 100);
    } catch {
      return 'default';
    }
  }

  /**
   * Get the current permission mode.
   */
  getMode(): PermissionMode {
    return this.mode;
  }

  /**
   * Set the permission mode.
   */
  setMode(mode: PermissionMode): void {
    this.mode = mode;
  }

  /**
   * Add a custom deny rule.
   */
  addDenyRule(rule: Omit<PermissionRule, 'type'>): void {
    this.denyRules.push({ ...rule, type: 'deny' });
  }

  /**
   * Add a custom allow rule.
   */
  addAllowRule(rule: Omit<PermissionRule, 'type'>): void {
    this.allowRules.push({ ...rule, type: 'allow' });
  }

  /**
   * Add a custom ask rule.
   */
  addAskRule(rule: Omit<PermissionRule, 'type'>): void {
    this.askRules.push({ ...rule, type: 'ask' });
  }

  /**
   * Add a tool to the default allow list.
   */
  addDefaultAllowTool(tool: string): void {
    this.defaultAllowTools.add(tool);
  }

  /**
   * Remove a tool from the default allow list.
   */
  removeDefaultAllowTool(tool: string): void {
    this.defaultAllowTools.delete(tool);
  }
}

/**
 * Create a permission manager with the given configuration.
 */
export function createPermissionManager(config?: Partial<PermissionConfig>): PermissionManager {
  return new PermissionManager(config);
}

/**
 * Export built-in deny rules for testing purposes.
 */
export const BUILTIN_RULES = BUILTIN_DENY_RULES;
