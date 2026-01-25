/**
 * @openagent/config
 *
 * Configuration management for OpenAgent.
 */

export const version = '0.0.0';

// Schema and types
export {
  ConfigSchema,
  LogLevelSchema,
  LogFormatSchema,
  LLMProviderSchema,
  LoggingConfigSchema,
  LLMConfigSchema,
  ToolConfigSchema,
  SecurityConfigSchema,
  HookMatcherSchema,
  HookConfigSchema,
  HooksConfigSchema,
} from './schema.js';

export type {
  Config,
  LogLevel,
  LogFormat,
  LLMProvider,
  LoggingConfig,
  LLMConfig,
  ToolConfig,
  SecurityConfig,
  HookMatcher,
  HookConfig,
  HooksConfig,
} from './schema.js';

// Loader
export {
  loadConfig,
  validateConfig,
  validateStartup,
  getConfig,
  resetConfig,
  getConfigValue,
  ConfigError,
} from './loader.js';
