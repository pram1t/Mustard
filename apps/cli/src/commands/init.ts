/**
 * Init Command
 *
 * Initialize .mustard/ folder in a project or globally.
 */

import { initProjectConfig, ensureGlobalConfig } from '@pram1t/mustard-config';

export interface InitOptions {
  global?: boolean;
  model?: string;
  provider?: string;
}

/**
 * Execute the init command
 */
export async function initCommand(cwd: string, options: InitOptions): Promise<void> {
  if (options.global) {
    // Initialize global config
    await ensureGlobalConfig();
    console.log('Global configuration initialized at ~/.mustard/');
    console.log('');
    console.log('Created:');
    console.log('  ~/.mustard/config.json    - Global settings');
    console.log('  ~/.mustard/plans/         - Plans storage');
    console.log('  ~/.mustard/skills/        - Custom skills');
  } else {
    // Initialize project config
    const initialConfig: Record<string, unknown> = {};

    if (options.model) {
      initialConfig.model = options.model;
    }
    if (options.provider) {
      initialConfig.provider = options.provider;
    }

    await initProjectConfig(cwd, initialConfig);
    console.log('Project configuration initialized at .mustard/');
    console.log('');
    console.log('Created:');
    console.log('  .mustard/config.json    - Project settings');
    console.log('  .mustard/plans/         - Plans storage');
    console.log('  .mustard/skills/        - Custom skills');
    console.log('  .mustard/.gitignore     - Git ignore patterns');
    console.log('');
    console.log('You can now customize your project settings in .mustard/config.json');
  }
}
