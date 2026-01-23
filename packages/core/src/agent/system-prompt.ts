/**
 * System Prompt Utility
 *
 * Generates OS-aware system prompts for the agent.
 * This ensures all LLM providers know the platform they're running on.
 */

export interface SystemPromptOptions {
  /** Current working directory to include in the prompt */
  cwd?: string;
  /** Additional instructions to append to the base prompt */
  additionalInstructions?: string;
}

/**
 * Detect the current platform and return a human-readable name
 */
function getPlatformName(): string {
  switch (process.platform) {
    case 'win32':
      return 'Windows';
    case 'darwin':
      return 'macOS';
    default:
      return 'Linux';
  }
}

/**
 * Get shell information based on the platform
 */
function getShellInfo(): string {
  if (process.platform === 'win32') {
    return 'cmd.exe (Windows Command Prompt). Use Windows commands (dir, type, etc.) NOT Unix commands (ls, cat, find).';
  }
  return 'Bash. Standard Unix commands are available.';
}

/**
 * Generate an OS-aware system prompt with platform-specific instructions.
 *
 * This ensures any LLM provider connected to OpenAgent knows:
 * - The operating system (Windows, macOS, Linux)
 * - The shell environment and which commands to use
 * - That cross-platform tools (Glob, Read, etc.) are preferred
 *
 * @param options - Optional configuration for the prompt
 * @returns A complete system prompt string
 *
 * @example
 * ```typescript
 * // Basic usage - auto-detects OS
 * const prompt = createSystemPrompt();
 *
 * // With working directory
 * const prompt = createSystemPrompt({ cwd: '/home/user/project' });
 *
 * // With custom instructions
 * const prompt = createSystemPrompt({
 *   cwd: process.cwd(),
 *   additionalInstructions: 'Always write tests for new code.'
 * });
 * ```
 */
export function createSystemPrompt(options?: SystemPromptOptions): string {
  const platform = getPlatformName();
  const shellInfo = getShellInfo();

  const cwdInfo = options?.cwd
    ? `\nThe current working directory is: ${options.cwd}`
    : '';

  const additional = options?.additionalInstructions
    ? `\n${options.additionalInstructions}`
    : '';

  return `You are a helpful AI assistant with access to tools for file operations and shell commands.
Use tools when needed to accomplish tasks. Be concise in responses.

IMPORTANT: You are running on ${platform}. The shell is ${shellInfo}
Prefer using the Glob, Grep, Read, Write, and Edit tools over Bash when possible - they work cross-platform.
Only use Bash for operations that require shell commands (git, npm, etc.).${cwdInfo}${additional}`;
}
