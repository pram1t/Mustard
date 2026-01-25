/**
 * @openagent/hooks
 *
 * Hook system for OpenAgent - lifecycle hooks that allow
 * custom scripts to run at various agent events.
 */

// Types
export type {
  HookEvent,
  HookMatcher,
  HookConfig,
  HooksConfig,
  HookInput,
  HookResult,
  HookContext,
} from './types.js';

// Executor
export { HookExecutor, createHookExecutor } from './executor.js';
