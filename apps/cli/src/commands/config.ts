/**
 * Config Command
 *
 * Manage OpenAgent configuration from CLI.
 */

import * as fs from 'fs/promises';
import {
  loadResolvedConfig,
  getProjectConfigPath,
  getGlobalConfigPath,
  saveProjectConfig,
  saveGlobalConfig,
  loadProjectConfig,
  loadGlobalConfig,
  findProjectRoot,
} from '@pram1t/mustard-config';

export type ConfigAction = 'list' | 'get' | 'set' | 'edit' | 'path';

export interface ConfigOptions {
  global?: boolean;
}

/**
 * Execute the config command
 */
export async function configCommand(
  cwd: string,
  action: ConfigAction,
  key?: string,
  value?: string,
  options: ConfigOptions = {}
): Promise<void> {
  switch (action) {
    case 'list':
      await listConfig(cwd);
      break;
    case 'get':
      if (!key) {
        console.error('Error: Key is required for "config get"');
        process.exit(1);
      }
      await getConfigValue(cwd, key);
      break;
    case 'set':
      if (!key) {
        console.error('Error: Key is required for "config set"');
        process.exit(1);
      }
      await setConfigValue(cwd, key, value, options.global);
      break;
    case 'edit':
      await editConfig(cwd, options.global);
      break;
    case 'path':
      await showConfigPath(cwd, options.global);
      break;
    default:
      console.error(`Unknown config action: ${action}`);
      process.exit(1);
  }
}

/**
 * List all configuration with sources
 */
async function listConfig(cwd: string): Promise<void> {
  const resolved = await loadResolvedConfig({ cwd });

  console.log('OpenAgent Configuration\n');
  console.log('Source Legend: [cli] [env] [project] [global] [default]\n');

  // Show effective values with sources
  const items = [
    { key: 'model', value: resolved.effectiveModel, source: resolved.source.model || 'default' },
    { key: 'provider', value: resolved.effectiveProvider, source: resolved.source.provider || 'default' },
    { key: 'systemPrompt', value: resolved.effectiveSystemPrompt, source: resolved.source.systemPrompt || 'default' },
    { key: 'historyEnabled', value: resolved.projectConfig?.historyEnabled ?? resolved.globalConfig?.historyEnabled ?? true, source: resolved.source.historyEnabled || 'default' },
    { key: 'todoPersistence', value: resolved.projectConfig?.todoPersistence ?? resolved.globalConfig?.todoPersistence ?? true, source: resolved.source.todoPersistence || 'default' },
  ];

  for (const item of items) {
    const displayValue = item.value === undefined ? '(not set)' : String(item.value);
    const truncatedValue = displayValue.length > 50 ? displayValue.slice(0, 47) + '...' : displayValue;
    console.log(`  ${item.key}: ${truncatedValue} [${item.source}]`);
  }

  console.log('');

  // Show project info
  if (resolved.projectRoot) {
    console.log(`Project root: ${resolved.projectRoot}`);
    console.log(`Project config: ${getProjectConfigPath(resolved.projectRoot)}`);
  } else {
    console.log('Project config: (not found)');
  }

  console.log(`Global config: ${getGlobalConfigPath()}`);
}

/**
 * Get a specific configuration value
 */
async function getConfigValue(cwd: string, key: string): Promise<void> {
  const resolved = await loadResolvedConfig({ cwd });

  let value: unknown;
  let source: string = 'default';

  switch (key) {
    case 'model':
      value = resolved.effectiveModel;
      source = resolved.source.model || 'default';
      break;
    case 'provider':
      value = resolved.effectiveProvider;
      source = resolved.source.provider || 'default';
      break;
    case 'systemPrompt':
      value = resolved.effectiveSystemPrompt;
      source = resolved.source.systemPrompt || 'default';
      break;
    case 'historyEnabled':
      value = resolved.projectConfig?.historyEnabled ?? resolved.globalConfig?.historyEnabled ?? true;
      source = resolved.source.historyEnabled || 'default';
      break;
    case 'todoPersistence':
      value = resolved.projectConfig?.todoPersistence ?? resolved.globalConfig?.todoPersistence ?? true;
      source = resolved.source.todoPersistence || 'default';
      break;
    default:
      // Try to get from project or global config
      if (resolved.projectConfig && key in resolved.projectConfig) {
        value = (resolved.projectConfig as Record<string, unknown>)[key];
        source = 'project';
      } else if (resolved.globalConfig && key in resolved.globalConfig) {
        value = (resolved.globalConfig as Record<string, unknown>)[key];
        source = 'global';
      } else {
        console.log(`Key not found: ${key}`);
        return;
      }
  }

  if (value === undefined) {
    console.log(`${key}: (not set) [${source}]`);
  } else {
    console.log(`${key}: ${JSON.stringify(value)} [${source}]`);
  }
}

/**
 * Set a configuration value
 */
async function setConfigValue(
  cwd: string,
  key: string,
  value: string | undefined,
  global?: boolean
): Promise<void> {
  let parsedValue: unknown = value;

  // Try to parse as JSON for complex values
  if (value !== undefined) {
    try {
      parsedValue = JSON.parse(value);
    } catch {
      // Keep as string
    }
  }

  if (global) {
    // Update global config
    const config = await loadGlobalConfig() || {};
    (config as Record<string, unknown>)[key] = parsedValue;
    await saveGlobalConfig(config);
    console.log(`Set ${key} = ${JSON.stringify(parsedValue)} in global config`);
  } else {
    // Update project config
    const projectRoot = await findProjectRoot(cwd);
    if (!projectRoot) {
      console.error('Error: Not in an OpenAgent project. Run "openagent init" first or use --global.');
      process.exit(1);
    }

    const config = await loadProjectConfig(projectRoot) || {};
    (config as Record<string, unknown>)[key] = parsedValue;
    await saveProjectConfig(projectRoot, config);
    console.log(`Set ${key} = ${JSON.stringify(parsedValue)} in project config`);
  }
}

/**
 * Open config file in editor
 */
async function editConfig(cwd: string, global?: boolean): Promise<void> {
  let configPath: string;

  if (global) {
    configPath = getGlobalConfigPath();
  } else {
    const projectRoot = await findProjectRoot(cwd);
    if (!projectRoot) {
      console.error('Error: Not in an OpenAgent project. Run "openagent init" first or use --global.');
      process.exit(1);
    }
    configPath = getProjectConfigPath(projectRoot);
  }

  // Check if file exists
  try {
    await fs.access(configPath);
  } catch {
    console.error(`Config file not found: ${configPath}`);
    console.error('Run "openagent init" to create it.');
    process.exit(1);
  }

  const editor = process.env.EDITOR || process.env.VISUAL || 'notepad';
  console.log(`Opening ${configPath} in ${editor}...`);

  const { spawn } = await import('child_process');
  const child = spawn(editor, [configPath], { stdio: 'inherit', shell: true });

  child.on('error', (err) => {
    console.error(`Failed to open editor: ${err.message}`);
    console.error(`You can manually edit: ${configPath}`);
  });
}

/**
 * Show config file path
 */
async function showConfigPath(cwd: string, global?: boolean): Promise<void> {
  if (global) {
    console.log(getGlobalConfigPath());
  } else {
    const projectRoot = await findProjectRoot(cwd);
    if (!projectRoot) {
      console.error('Error: Not in an OpenAgent project.');
      process.exit(1);
    }
    console.log(getProjectConfigPath(projectRoot));
  }
}
