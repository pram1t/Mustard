/**
 * Environment Variable Filter
 *
 * Provides secure environment filtering to prevent credential leakage
 * when spawning child processes (Bash, MCP servers, hooks, etc.).
 */

import { getLogger } from './factory.js';

/**
 * Default safe environment variables that are always allowed.
 * These are necessary for basic shell operation but don't contain secrets.
 */
export const DEFAULT_SAFE_ENV_VARS = [
  // System paths and shell
  'PATH', 'HOME', 'USER', 'SHELL', 'TERM', 'PWD',
  // Locale settings
  'LANG', 'LC_ALL', 'LC_CTYPE', 'LC_MESSAGES', 'LANGUAGE',
  // Timezone
  'TZ',
  // Node.js environment (for npm/node commands)
  'NODE_ENV', 'NODE_PATH', 'NODE_OPTIONS',
  // npm configuration (safe subset)
  'npm_config_prefix', 'npm_config_registry',
  // Common development tools
  'EDITOR', 'VISUAL', 'PAGER',
  // Git (safe subset - no credentials)
  'GIT_AUTHOR_NAME', 'GIT_AUTHOR_EMAIL', 'GIT_COMMITTER_NAME', 'GIT_COMMITTER_EMAIL',
  // Windows-specific
  'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'TEMP', 'TMP', 'SYSTEMROOT', 'WINDIR',
  'HOMEDRIVE', 'HOMEPATH', 'COMPUTERNAME', 'USERNAME', 'OS', 'PATHEXT',
  'PROGRAMFILES', 'PROGRAMFILES(X86)', 'PROGRAMDATA', 'COMMONPROGRAMFILES',
  // Unix-specific
  'TMPDIR', 'XDG_RUNTIME_DIR', 'XDG_CONFIG_HOME', 'XDG_DATA_HOME', 'XDG_CACHE_HOME',
  // Terminal
  'COLORTERM', 'TERM_PROGRAM', 'TERM_PROGRAM_VERSION',
];

/**
 * Environment variables that should NEVER be passed through.
 * These typically contain secrets or sensitive credentials.
 * Uses partial matching (contains) for flexibility.
 */
export const BLOCKED_ENV_VARS = [
  // API keys and tokens
  'OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'GOOGLE_API_KEY', 'AZURE_API_KEY',
  'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_SESSION_TOKEN',
  'GITHUB_TOKEN', 'GITLAB_TOKEN', 'NPM_TOKEN', 'PYPI_TOKEN',
  'HUGGINGFACE_TOKEN', 'HF_TOKEN', 'REPLICATE_API_TOKEN',
  // Database credentials
  'DATABASE_URL', 'DATABASE_PASSWORD', 'DB_PASSWORD', 'POSTGRES_PASSWORD',
  'MYSQL_PASSWORD', 'REDIS_PASSWORD', 'MONGODB_PASSWORD', 'MONGODB_URI',
  // OAuth/Auth secrets
  'CLIENT_SECRET', 'JWT_SECRET', 'SESSION_SECRET', 'AUTH_SECRET',
  'COOKIE_SECRET', 'ENCRYPTION_KEY', 'SIGNING_KEY',
  // Cloud provider credentials
  'GOOGLE_APPLICATION_CREDENTIALS', 'AZURE_CLIENT_SECRET', 'AZURE_TENANT_ID',
  'AZURE_SUBSCRIPTION_ID', 'DIGITALOCEAN_TOKEN', 'LINODE_TOKEN',
  // Private keys
  'PRIVATE_KEY', 'SSH_PRIVATE_KEY', 'SSL_KEY', 'RSA_PRIVATE_KEY',
  // Generic patterns (matched with includes)
  'API_KEY', 'SECRET', 'TOKEN', 'PASSWORD', 'CREDENTIAL',
  '_KEY', '_SECRET', '_TOKEN', '_PASSWORD',
];

/**
 * Options for filtering environment variables
 */
export interface FilterEnvOptions {
  /** Additional variables to allow (beyond defaults) */
  additionalAllowed?: string[];
  /** Additional variables to block (beyond defaults) */
  additionalBlocked?: string[];
  /** Whether to log blocked variables (default: true in debug) */
  logBlocked?: boolean;
}

/**
 * Filter environment variables to only include safe ones.
 * Never passes API keys, passwords, or other secrets to child processes.
 *
 * @param options - Filtering options
 * @returns Filtered environment variables safe for child processes
 */
export function filterEnvVars(options: FilterEnvOptions = {}): Record<string, string> {
  const logger = getLogger();
  const {
    additionalAllowed = [],
    additionalBlocked = [],
    logBlocked = true,
  } = options;

  // Combine safe vars
  const safeVars = new Set([
    ...DEFAULT_SAFE_ENV_VARS,
    ...additionalAllowed,
  ]);

  // Combine blocked vars
  const blockedPatterns = [
    ...BLOCKED_ENV_VARS,
    ...additionalBlocked,
  ];

  const filteredEnv: Record<string, string> = {};

  for (const [key, value] of Object.entries(process.env)) {
    if (value === undefined) continue;

    // Check if explicitly blocked (exact match or contains pattern)
    const isBlocked = blockedPatterns.some((blocked) => {
      const upperKey = key.toUpperCase();
      const upperBlocked = blocked.toUpperCase();
      return upperKey === upperBlocked || upperKey.includes(upperBlocked);
    });

    if (isBlocked) {
      if (logBlocked) {
        logger.debug('Blocked env var from child process', { envVar: key });
      }
      continue;
    }

    // Check if in safe list (case-insensitive)
    const isSafe = Array.from(safeVars).some(
      (safe) => key.toUpperCase() === safe.toUpperCase()
    );

    if (isSafe) {
      filteredEnv[key] = value;
    }
  }

  return filteredEnv;
}
