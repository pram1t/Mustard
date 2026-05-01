/**
 * @pram1t/mustard-logger
 *
 * Structured logging for OpenAgent.
 */

export const version = '0.0.0';

// Types
export type { LogLevel, LoggerConfig, LogContext, Logger } from './types.js';

// Factory
export {
  createLogger,
  getLogger,
  setDefaultLogger,
  resetDefaultLogger,
} from './factory.js';

// Environment variable filter
export {
  filterEnvVars,
  DEFAULT_SAFE_ENV_VARS,
  BLOCKED_ENV_VARS,
} from './env-filter.js';
export type { FilterEnvOptions } from './env-filter.js';
