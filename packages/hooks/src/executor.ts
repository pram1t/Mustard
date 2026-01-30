/**
 * Hook Executor
 *
 * Executes hook scripts at lifecycle events.
 * Handles script spawning, input/output, timeouts, and result parsing.
 */

import { spawn } from 'child_process';
import { getLogger, filterEnvVars } from '@openagent/logger';
import type {
  HookEvent,
  HookConfig,
  HookInput,
  HookResult,
  HooksConfig,
  HookContext,
} from './types.js';

/** Default timeout for hooks (10 seconds) */
const DEFAULT_TIMEOUT = 10000;

/**
 * Hook Executor
 *
 * Manages and executes lifecycle hooks.
 */
export class HookExecutor {
  private hooks: Map<HookEvent, HookConfig[]> = new Map();
  private context: HookContext;

  /**
   * Create a new hook executor.
   *
   * @param config - Hooks configuration by event type
   * @param context - Execution context (sessionId, cwd)
   */
  constructor(config: HooksConfig, context: HookContext) {
    this.context = context;

    // Initialize hooks map from config
    for (const [event, hooks] of Object.entries(config)) {
      if (hooks && hooks.length > 0) {
        this.hooks.set(event as HookEvent, hooks);
      }
    }
  }

  /**
   * Register a hook dynamically.
   *
   * @param event - Event type to register for
   * @param config - Hook configuration
   */
  register(event: HookEvent, config: HookConfig): void {
    const existing = this.hooks.get(event) || [];
    existing.push(config);
    this.hooks.set(event, existing);
  }

  /**
   * Check if any hooks are registered for an event.
   *
   * @param event - Event type to check
   * @returns True if hooks are registered
   */
  hasHooks(event: HookEvent): boolean {
    const hooks = this.hooks.get(event);
    return hooks !== undefined && hooks.length > 0;
  }

  /**
   * Trigger hooks for an event.
   *
   * @param event - Event type
   * @param data - Event-specific data
   * @returns Combined result from all hooks
   */
  async trigger(
    event: HookEvent,
    data: Partial<Omit<HookInput, 'event' | 'timestamp' | 'sessionId'>> = {}
  ): Promise<HookResult> {
    const logger = getLogger();
    const hooks = this.hooks.get(event) || [];

    // Filter hooks that match the context
    const matchingHooks = hooks.filter((hook) => this.matchesFilter(hook, data));

    if (matchingHooks.length === 0) {
      return { blocked: false };
    }

    logger.debug('Triggering hooks', {
      event,
      hookCount: matchingHooks.length,
      tool: data.tool,
    });

    // Build input for hooks
    const input: HookInput = {
      event,
      timestamp: Date.now(),
      sessionId: this.context.sessionId,
      ...data,
    };

    // Execute hooks in sequence
    let result: HookResult = { blocked: false };

    for (const hook of matchingHooks) {
      const hookResult = await this.executeHook(hook, input);

      // If blocked, stop immediately
      if (hookResult.blocked) {
        logger.info('Hook blocked action', {
          event,
          tool: data.tool,
          output: hookResult.output,
        });
        return hookResult;
      }

      // Accumulate modifications
      if (hookResult.modifiedMessage !== undefined) {
        result.modifiedMessage = hookResult.modifiedMessage;
        // Update input for next hook
        input.message = hookResult.modifiedMessage;
      }
      if (hookResult.modifiedParams !== undefined) {
        result.modifiedParams = hookResult.modifiedParams;
        // Update input for next hook
        input.params = hookResult.modifiedParams;
      }
      if (hookResult.output) {
        result.output = (result.output || '') + hookResult.output;
      }
      if (hookResult.error) {
        result.error = (result.error || '') + hookResult.error;
      }
    }

    return result;
  }

  /**
   * Check if a hook matches the current context.
   */
  private matchesFilter(
    hook: HookConfig,
    data: Partial<Omit<HookInput, 'event' | 'timestamp' | 'sessionId'>>
  ): boolean {
    if (!hook.matcher) {
      return true; // No matcher = always run
    }

    // Tool name exact match
    if (hook.matcher.tool && data.tool !== hook.matcher.tool) {
      return false;
    }

    // Tool name pattern match
    if (hook.matcher.toolPattern && data.tool) {
      try {
        const regex = new RegExp(hook.matcher.toolPattern);
        if (!regex.test(data.tool)) {
          return false;
        }
      } catch {
        // Invalid regex, skip this matcher
        return false;
      }
    }

    return true;
  }

  /**
   * Execute a single hook.
   */
  private async executeHook(hook: HookConfig, input: HookInput): Promise<HookResult> {
    const logger = getLogger();
    const timeout = hook.timeout || DEFAULT_TIMEOUT;

    return new Promise((resolve) => {
      try {
        // Use filtered environment to prevent credential leakage to hook processes
        const safeEnv = filterEnvVars();

        // Use shell: true for cross-platform compatibility
        const proc = spawn(hook.command, [], {
          cwd: hook.cwd || this.context.cwd,
          env: { ...safeEnv, ...hook.env },
          stdio: ['pipe', 'pipe', 'pipe'],
          shell: true,
        });

        let stdout = '';
        let stderr = '';
        let resolved = false;

        const cleanup = () => {
          if (!resolved) {
            resolved = true;
          }
        };

        proc.stdout.on('data', (data) => {
          stdout += data.toString();
        });

        proc.stderr.on('data', (data) => {
          stderr += data.toString();
        });

        // Handle stdin errors (EPIPE if process exits before we write)
        proc.stdin.on('error', (err) => {
          // Ignore EPIPE - process exited before we could write, which is fine
          if ((err as NodeJS.ErrnoException).code !== 'EPIPE') {
            logger.debug('Hook stdin error', { error: err.message });
          }
        });

        // Send input via stdin
        try {
          proc.stdin.write(JSON.stringify(input));
          proc.stdin.end();
        } catch {
          // Ignore write errors - process may have already exited
        }

        // Timeout handler
        const timeoutId = setTimeout(() => {
          if (!resolved) {
            proc.kill('SIGTERM');
            cleanup();
            logger.warn('Hook timed out', {
              command: hook.command,
              timeout,
            });
            // Fail open - don't block on timeout
            resolve({
              blocked: false,
              error: `Hook timed out after ${timeout}ms`,
            });
          }
        }, timeout);

        proc.on('close', (code) => {
          clearTimeout(timeoutId);
          if (resolved) return;
          cleanup();

          if (code !== 0) {
            logger.debug('Hook exited with error', {
              command: hook.command,
              code,
              stderr: stderr.slice(0, 200),
            });
            // Fail open - non-zero exit doesn't block
            resolve({
              blocked: false,
              output: stderr || stdout,
              error: `Hook exited with code ${code}`,
            });
            return;
          }

          // Try to parse stdout as JSON result
          const trimmedOutput = stdout.trim();
          if (trimmedOutput) {
            try {
              const result = JSON.parse(trimmedOutput);
              resolve({
                blocked: result.blocked === true,
                modifiedMessage: result.modifiedMessage,
                modifiedParams: result.modifiedParams,
                output: result.output,
                error: result.error,
              });
            } catch {
              // Not JSON, treat stdout as output
              resolve({
                blocked: false,
                output: stdout,
              });
            }
          } else {
            // Empty output, just success
            resolve({ blocked: false });
          }
        });

        proc.on('error', (error) => {
          clearTimeout(timeoutId);
          if (resolved) return;
          cleanup();

          logger.warn('Hook execution error', {
            command: hook.command,
            error: error.message,
          });
          // Fail open on error
          resolve({
            blocked: false,
            error: `Hook error: ${error.message}`,
          });
        });
      } catch (error) {
        // Fail open on any unexpected error
        const errorMsg = error instanceof Error ? error.message : String(error);
        logger.error('Hook spawn error', {
          command: hook.command,
          error: errorMsg,
        });
        resolve({
          blocked: false,
          error: `Hook spawn error: ${errorMsg}`,
        });
      }
    });
  }

  /**
   * Get the number of hooks registered for an event.
   */
  getHookCount(event: HookEvent): number {
    return this.hooks.get(event)?.length || 0;
  }

  /**
   * Get all registered events.
   */
  getRegisteredEvents(): HookEvent[] {
    return Array.from(this.hooks.keys());
  }
}

/**
 * Create a hook executor from configuration.
 *
 * @param config - Hooks configuration
 * @param context - Execution context
 * @returns HookExecutor instance
 */
export function createHookExecutor(
  config: HooksConfig,
  context: HookContext
): HookExecutor {
  return new HookExecutor(config, context);
}
