/**
 * Logger Types
 */

/**
 * Log levels in order of severity
 */
export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal' | 'silent';

/**
 * Logger configuration options
 */
export interface LoggerConfig {
  /** Log level (default: 'info' in production, 'debug' in development) */
  level?: LogLevel;

  /** Output format: 'json' for structured logs, 'pretty' for human-readable */
  format?: 'json' | 'pretty';

  /** Base context to include in all log messages */
  context?: Record<string, unknown>;

  /** Whether to include timestamps (default: true) */
  timestamp?: boolean;

  /** Application name for log identification */
  name?: string;
}

/**
 * Log context that can be added to messages
 */
export interface LogContext {
  /** Request/session ID for correlation */
  requestId?: string;

  /** Session ID for tracking user sessions */
  sessionId?: string;

  /** Operation name for tracing */
  operation?: string;

  /** Additional context properties */
  [key: string]: unknown;
}

/**
 * Logger interface
 */
export interface Logger {
  /** Log level getter */
  readonly level: LogLevel;

  /** Create a child logger with additional context */
  child(context: LogContext): Logger;

  /** Log at trace level */
  trace(msg: string, context?: LogContext): void;
  trace(context: LogContext, msg: string): void;

  /** Log at debug level */
  debug(msg: string, context?: LogContext): void;
  debug(context: LogContext, msg: string): void;

  /** Log at info level */
  info(msg: string, context?: LogContext): void;
  info(context: LogContext, msg: string): void;

  /** Log at warn level */
  warn(msg: string, context?: LogContext): void;
  warn(context: LogContext, msg: string): void;

  /** Log at error level */
  error(msg: string, context?: LogContext): void;
  error(context: LogContext, msg: string): void;
  error(error: Error, msg?: string): void;

  /** Log at fatal level */
  fatal(msg: string, context?: LogContext): void;
  fatal(context: LogContext, msg: string): void;
  fatal(error: Error, msg?: string): void;
}
