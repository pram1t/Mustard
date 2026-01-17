/**
 * @openagent/logger
 *
 * Structured logging for OpenAgent.
 */

export const version = '0.0.0';

// Types
export type { LogLevel, LoggerConfig, LogContext, Logger } from './types';

// Factory
export {
  createLogger,
  getLogger,
  setDefaultLogger,
  resetDefaultLogger,
} from './factory';
