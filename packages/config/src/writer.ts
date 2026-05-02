/**
 * Configuration Writer
 *
 * Creates and updates configuration files for projects and global settings.
 * Handles directory structure creation and .gitignore generation.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { ProjectConfigSchema, type ProjectConfig } from './schema.js';
import {
  CONFIG_DIR_NAME,
  CONFIG_FILE_NAME,
  getGlobalConfigDir,
  getGlobalConfigPath,
  getProjectConfigDir,
  getProjectConfigPath,
} from './project.js';

/**
 * Default .gitignore content for .openagent/ folder
 */
const DEFAULT_GITIGNORE = `# OpenAgent - ignore session data
todos.json
history/
*.log

# Keep config and skills
!config.json
!skills/
`;

/**
 * Default skills README content
 */
const SKILLS_README = `# OpenAgent Skills

Place custom skills in this folder. Each skill should be in its own subfolder with a SKILL.md file.

## Example Structure

\`\`\`
skills/
└── my-skill/
    ├── SKILL.md       # Skill definition (required)
    ├── template.txt   # Optional templates
    └── examples/      # Optional examples
\`\`\`

## SKILL.md Format

\`\`\`markdown
---
name: my-skill
description: Does something useful
allowed-tools: [Read, Write, Edit]
context: main
user-invocable: true
---

# My Skill

Instructions for the AI...
\`\`\`

> **Note:** Skills system is coming in a future update.
`;

/**
 * Ensure a directory exists, creating it if necessary
 */
async function ensureDir(dirPath: string): Promise<void> {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code !== 'EEXIST') {
      throw error;
    }
  }
}

/**
 * Write JSON file with pretty formatting
 */
async function writeJsonFile(filePath: string, data: unknown): Promise<void> {
  const content = JSON.stringify(data, null, 2) + '\n';
  await fs.writeFile(filePath, content, 'utf-8');
}

/**
 * Read and parse JSON file, returning null if not found
 */
async function readJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

/**
 * Initialize project configuration folder
 * Creates .openagent/ with config.json, plans/, skills/, history/, and .gitignore
 */
export async function initProjectConfig(
  projectPath: string,
  config: Partial<ProjectConfig> = {}
): Promise<void> {
  const configDir = getProjectConfigDir(projectPath);
  const configPath = getProjectConfigPath(projectPath);

  // Create directories
  await ensureDir(configDir);
  await ensureDir(path.join(configDir, 'plans'));
  await ensureDir(path.join(configDir, 'skills'));
  await ensureDir(path.join(configDir, 'history'));

  // Create config file with defaults
  const defaultConfig: ProjectConfig = ProjectConfigSchema.parse({
    historyEnabled: true,
    todoPersistence: true,
    ...config,
  });
  await writeJsonFile(configPath, defaultConfig);

  // Create .gitignore
  const gitignorePath = path.join(configDir, '.gitignore');
  await fs.writeFile(gitignorePath, DEFAULT_GITIGNORE, 'utf-8');

  // Create skills README
  const skillsReadmePath = path.join(configDir, 'skills', 'README.md');
  await fs.writeFile(skillsReadmePath, SKILLS_README, 'utf-8');
}

/**
 * Ensure global configuration directory exists
 * Creates ~/.mustard/ with necessary subdirectories
 */
export async function ensureGlobalConfig(): Promise<void> {
  const configDir = getGlobalConfigDir();

  // Create directories
  await ensureDir(configDir);
  await ensureDir(path.join(configDir, 'plans'));
  await ensureDir(path.join(configDir, 'skills'));
  await ensureDir(path.join(configDir, 'history'));

  // Create config file if it doesn't exist
  const configPath = getGlobalConfigPath();
  const existing = await readJsonFile(configPath);

  if (existing === null) {
    const defaultConfig: ProjectConfig = ProjectConfigSchema.parse({
      historyEnabled: true,
      todoPersistence: true,
    });
    await writeJsonFile(configPath, defaultConfig);
  }

  // Create skills README if it doesn't exist
  const skillsReadmePath = path.join(configDir, 'skills', 'README.md');
  try {
    await fs.access(skillsReadmePath);
  } catch {
    await fs.writeFile(skillsReadmePath, SKILLS_README, 'utf-8');
  }
}

/**
 * Save project configuration
 * Merges with existing config to preserve unset fields
 */
export async function saveProjectConfig(
  projectPath: string,
  config: Partial<ProjectConfig>
): Promise<ProjectConfig> {
  const configPath = getProjectConfigPath(projectPath);

  // Load existing config
  const existing = await readJsonFile<ProjectConfig>(configPath) ?? {};

  // Merge with new values
  const merged = { ...existing, ...config };

  // Validate and save
  const validated = ProjectConfigSchema.parse(merged);
  await writeJsonFile(configPath, validated);

  return validated;
}

/**
 * Save global user configuration
 * Merges with existing config to preserve unset fields
 */
export async function saveGlobalConfig(
  config: Partial<ProjectConfig>
): Promise<ProjectConfig> {
  const configPath = getGlobalConfigPath();

  // Ensure directory exists
  await ensureGlobalConfig();

  // Load existing config
  const existing = await readJsonFile<ProjectConfig>(configPath) ?? {};

  // Merge with new values
  const merged = { ...existing, ...config };

  // Validate and save
  const validated = ProjectConfigSchema.parse(merged);
  await writeJsonFile(configPath, validated);

  return validated;
}

/**
 * Update a single config value in project config
 */
export async function setProjectConfigValue(
  projectPath: string,
  key: keyof ProjectConfig,
  value: unknown
): Promise<ProjectConfig> {
  return saveProjectConfig(projectPath, { [key]: value } as Partial<ProjectConfig>);
}

/**
 * Update a single config value in global config
 */
export async function setGlobalConfigValue(
  key: keyof ProjectConfig,
  value: unknown
): Promise<ProjectConfig> {
  return saveGlobalConfig({ [key]: value } as Partial<ProjectConfig>);
}

/**
 * Delete project configuration
 * Removes the entire .openagent/ folder
 */
export async function deleteProjectConfig(projectPath: string): Promise<void> {
  const configDir = getProjectConfigDir(projectPath);
  await fs.rm(configDir, { recursive: true, force: true });
}

/**
 * Check if project config exists
 */
export async function projectConfigExists(projectPath: string): Promise<boolean> {
  const configPath = getProjectConfigPath(projectPath);
  try {
    await fs.access(configPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if global config exists
 */
export async function globalConfigExists(): Promise<boolean> {
  const configPath = getGlobalConfigPath();
  try {
    await fs.access(configPath);
    return true;
  } catch {
    return false;
  }
}
