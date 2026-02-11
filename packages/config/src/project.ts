/**
 * Project Configuration Loader
 *
 * Discovers and loads project-specific configuration from .openagent/config.json
 * Implements the configuration hierarchy: CLI > Env > Project > Global > Defaults
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { ZodError } from 'zod';
import { ProjectConfigSchema, type ProjectConfig, type Config, type LLMProvider } from './schema.js';
import { loadConfig as loadEnvConfig } from './loader.js';
import type {
  ResolvedConfig,
  ConfigSource,
  LoadConfigOptions,
  CLIConfigFlags,
  ConfigValueSource,
} from './types.js';

/**
 * OpenAgent configuration directory name
 */
export const CONFIG_DIR_NAME = '.openagent';

/**
 * Configuration file name
 */
export const CONFIG_FILE_NAME = 'config.json';

/**
 * Get the global configuration directory path
 */
export function getGlobalConfigDir(): string {
  return path.join(os.homedir(), CONFIG_DIR_NAME);
}

/**
 * Get the global configuration file path
 */
export function getGlobalConfigPath(): string {
  return path.join(getGlobalConfigDir(), CONFIG_FILE_NAME);
}

/**
 * Get the project configuration directory path
 */
export function getProjectConfigDir(projectPath: string): string {
  return path.join(projectPath, CONFIG_DIR_NAME);
}

/**
 * Get the project configuration file path
 */
export function getProjectConfigPath(projectPath: string): string {
  return path.join(getProjectConfigDir(projectPath), CONFIG_FILE_NAME);
}

/**
 * Find the project root by searching upward for .openagent/config.json
 * Returns null if no project root is found
 */
export async function findProjectRoot(startPath: string): Promise<string | null> {
  let currentPath = path.resolve(startPath);
  const root = path.parse(currentPath).root;

  while (currentPath !== root) {
    const configPath = getProjectConfigPath(currentPath);

    try {
      await fs.access(configPath);
      return currentPath;
    } catch {
      // Config doesn't exist at this level, go up
      currentPath = path.dirname(currentPath);
    }
  }

  // Also check root
  try {
    await fs.access(getProjectConfigPath(root));
    return root;
  } catch {
    return null;
  }
}

/**
 * Check if a directory has an .openagent folder (even without config.json)
 */
export async function hasOpenAgentDir(dirPath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(getProjectConfigDir(dirPath));
    return stat.isDirectory();
  } catch {
    return false;
  }
}

/**
 * Load and validate project configuration from a path
 * Returns null if the config file doesn't exist
 */
export async function loadProjectConfig(projectPath: string): Promise<ProjectConfig | null> {
  const configPath = getProjectConfigPath(projectPath);

  try {
    const content = await fs.readFile(configPath, 'utf-8');
    const rawConfig = JSON.parse(content);
    return ProjectConfigSchema.parse(rawConfig);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    if (error instanceof ZodError) {
      const messages = error.errors.map(
        (e) => `${e.path.join('.')}: ${e.message}`
      );
      throw new Error(`Invalid project config at ${configPath}:\n${messages.join('\n')}`);
    }
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid JSON in project config at ${configPath}: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Load and validate global user configuration
 * Returns null if the config file doesn't exist
 */
export async function loadGlobalConfig(): Promise<ProjectConfig | null> {
  const configPath = getGlobalConfigPath();

  try {
    const content = await fs.readFile(configPath, 'utf-8');
    const rawConfig = JSON.parse(content);
    return ProjectConfigSchema.parse(rawConfig);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    if (error instanceof ZodError) {
      const messages = error.errors.map(
        (e) => `${e.path.join('.')}: ${e.message}`
      );
      throw new Error(`Invalid global config at ${configPath}:\n${messages.join('\n')}`);
    }
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid JSON in global config at ${configPath}: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Determine the effective value and source for a configuration option
 */
function resolveValue<T>(
  cliValue: T | undefined,
  envValue: T | undefined,
  projectValue: T | undefined,
  globalValue: T | undefined,
  defaultValue: T | undefined
): { value: T | undefined; source: ConfigValueSource } {
  if (cliValue !== undefined) {
    return { value: cliValue, source: 'cli' };
  }
  if (envValue !== undefined) {
    return { value: envValue, source: 'env' };
  }
  if (projectValue !== undefined) {
    return { value: projectValue, source: 'project' };
  }
  if (globalValue !== undefined) {
    return { value: globalValue, source: 'global' };
  }
  return { value: defaultValue, source: 'default' };
}

/**
 * Load and merge configuration from all sources
 * Priority: CLI flags > Environment > Project config > Global config > Defaults
 */
export async function loadResolvedConfig(
  options: LoadConfigOptions
): Promise<ResolvedConfig> {
  const { cwd, cliFlags = {}, skipProjectConfig, skipGlobalConfig } = options;

  // Load environment-based config (includes defaults)
  const envConfig = loadEnvConfig();

  // Find project root and load project config
  let projectRoot: string | null = null;
  let projectConfig: ProjectConfig | null = null;

  if (!skipProjectConfig) {
    projectRoot = await findProjectRoot(cwd);
    if (projectRoot) {
      projectConfig = await loadProjectConfig(projectRoot);
    }
  }

  // Load global config
  let globalConfig: ProjectConfig | null = null;
  if (!skipGlobalConfig) {
    globalConfig = await loadGlobalConfig();
  }

  // Resolve each value with source tracking
  const modelResolved = resolveValue(
    cliFlags.model,
    envConfig.llm.model,
    projectConfig?.model,
    globalConfig?.model,
    undefined
  );

  const providerResolved = resolveValue(
    cliFlags.provider,
    envConfig.llm.provider,
    projectConfig?.provider,
    globalConfig?.provider,
    'openai' as LLMProvider
  );

  const systemPromptResolved = resolveValue(
    undefined, // CLI doesn't have system prompt flag
    undefined, // Env doesn't have system prompt
    projectConfig?.systemPrompt,
    globalConfig?.systemPrompt,
    undefined
  );

  const historyEnabledResolved = resolveValue(
    undefined,
    undefined,
    projectConfig?.historyEnabled,
    globalConfig?.historyEnabled,
    true
  );

  const todoPersistenceResolved = resolveValue(
    undefined,
    undefined,
    projectConfig?.todoPersistence,
    globalConfig?.todoPersistence,
    true
  );

  // Build source tracking
  const source: ConfigSource = {
    model: modelResolved.source,
    provider: providerResolved.source,
    systemPrompt: systemPromptResolved.source,
    historyEnabled: historyEnabledResolved.source,
    todoPersistence: todoPersistenceResolved.source,
  };

  return {
    config: envConfig,
    projectConfig,
    globalConfig,
    projectRoot,
    source,
    effectiveModel: modelResolved.value,
    effectiveProvider: providerResolved.value,
    effectiveSystemPrompt: systemPromptResolved.value,
  };
}

/**
 * Quick check if we're inside a project with .openagent/
 */
export async function isInProject(cwd: string): Promise<boolean> {
  const projectRoot = await findProjectRoot(cwd);
  return projectRoot !== null;
}

/**
 * Get todos file path (project-specific if available, else global)
 */
export async function getTodosPath(cwd: string): Promise<string> {
  const projectRoot = await findProjectRoot(cwd);

  if (projectRoot) {
    return path.join(getProjectConfigDir(projectRoot), 'todos.json');
  }

  return path.join(getGlobalConfigDir(), 'todos.json');
}

/**
 * Get plans directory path (project-specific if available, else global)
 */
export async function getPlansDir(cwd: string): Promise<string> {
  const projectRoot = await findProjectRoot(cwd);

  if (projectRoot) {
    return path.join(getProjectConfigDir(projectRoot), 'plans');
  }

  return path.join(getGlobalConfigDir(), 'plans');
}

/**
 * Get history directory path (project-specific if available, else global)
 */
export async function getHistoryDir(cwd: string): Promise<string> {
  const projectRoot = await findProjectRoot(cwd);

  if (projectRoot) {
    return path.join(getProjectConfigDir(projectRoot), 'history');
  }

  return path.join(getGlobalConfigDir(), 'history');
}
