/**
 * @openagent/config
 *
 * Configuration management for OpenAgent.
 *
 * Supports:
 * - Environment-based configuration
 * - Project-specific config (.openagent/config.json)
 * - Global user config (~/.openagent/config.json)
 * - Plan management
 * - History management
 * - Skills infrastructure (types only)
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
  // New in Phase 11.5
  ProjectConfigSchema,
  PermissionsConfigSchema,
  MCPServerRefSchema,
  HistoryConfigSchema,
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
  // New in Phase 11.5
  ProjectConfig,
  PermissionsConfig,
  MCPServerRef,
  HistoryConfig,
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

// Project config (Phase 11.5)
export {
  CONFIG_DIR_NAME,
  CONFIG_FILE_NAME,
  getGlobalConfigDir,
  getGlobalConfigPath,
  getProjectConfigDir,
  getProjectConfigPath,
  findProjectRoot,
  hasOpenAgentDir,
  loadProjectConfig,
  loadGlobalConfig,
  loadResolvedConfig,
  isInProject,
  getTodosPath,
  getPlansDir,
  getHistoryDir,
} from './project.js';

// Config writer (Phase 11.5)
export {
  initProjectConfig,
  saveProjectConfig,
  saveGlobalConfig,
  ensureGlobalConfig,
} from './writer.js';

// Plans manager (Phase 11.5)
export {
  createPlan,
  getPlan,
  updatePlan,
  listPlans,
  deletePlan,
  getPlansByStatus,
  getLatestPlan,
} from './plans.js';

// History manager (Phase 11.5)
export {
  appendToHistory,
  loadHistory,
  listSessions,
  getSessionInfo,
  clearSessionHistory,
  clearAllHistory,
  rotateHistory,
  exportHistory,
  importHistory,
} from './history.js';

// Types (Phase 11.5)
export type {
  ResolvedConfig,
  ConfigSource,
  LoadConfigOptions,
  CLIConfigFlags,
  ConfigValueSource,
  Plan,
  HistoryEntry,
} from './types.js';

// Skills types (Phase 11.5 - foundation only)
export type {
  Skill,
  SkillContext,
  SkillFrontmatter,
  SkillResult,
  SkillRegistryEntry,
  LoadSkillsOptions,
} from './skills/index.js';

export { SkillFrontmatterSchema } from './skills/index.js';
