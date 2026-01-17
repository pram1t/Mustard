/**
 * Configuration Loader
 *
 * Loads configuration from environment variables and validates it.
 */

import { config as loadDotenv } from 'dotenv';
import { ConfigSchema, Config, LogLevel, LogFormat, LLMProvider } from './schema';
import { ZodError } from 'zod';

/**
 * Configuration errors
 */
export class ConfigError extends Error {
  constructor(
    message: string,
    public readonly errors?: string[]
  ) {
    super(message);
    this.name = 'ConfigError';
  }
}

/**
 * Load configuration from environment variables
 */
function loadFromEnv(): Record<string, unknown> {
  // Load .env file if present
  loadDotenv();

  return {
    logging: {
      level: process.env.LOG_LEVEL as LogLevel | undefined,
      format: process.env.LOG_FORMAT as LogFormat | undefined,
    },
    llm: {
      provider: process.env.OPENAGENT_PROVIDER as LLMProvider | undefined,
      model: process.env.OPENAGENT_MODEL,
      apiKey: process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY,
      baseUrl: process.env.OPENAI_BASE_URL,
      retryAttempts: process.env.LLM_RETRY_ATTEMPTS
        ? parseInt(process.env.LLM_RETRY_ATTEMPTS, 10)
        : undefined,
      retryDelay: process.env.LLM_RETRY_DELAY
        ? parseInt(process.env.LLM_RETRY_DELAY, 10)
        : undefined,
    },
    tools: {
      bash: {
        maxTimeout: process.env.BASH_TIMEOUT
          ? parseInt(process.env.BASH_TIMEOUT, 10)
          : undefined,
        maxOutputSize: process.env.BASH_MAX_OUTPUT
          ? parseInt(process.env.BASH_MAX_OUTPUT, 10)
          : undefined,
        allowedEnvVars: process.env.BASH_ALLOWED_ENV_VARS
          ? process.env.BASH_ALLOWED_ENV_VARS.split(',').map((v) => v.trim())
          : undefined,
      },
      maxOutputSize: process.env.MAX_OUTPUT_SIZE
        ? parseInt(process.env.MAX_OUTPUT_SIZE, 10)
        : undefined,
    },
    security: {
      auditLogging: process.env.AUDIT_LOGGING === 'true',
      sanitizeInputs: process.env.SANITIZE_INPUTS !== 'false',
    },
  };
}

/**
 * Clean undefined values from object (Zod handles defaults better without them)
 */
function cleanUndefined(obj: Record<string, unknown>): Record<string, unknown> {
  const cleaned: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) {
      continue;
    }
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const cleanedNested = cleanUndefined(value as Record<string, unknown>);
      if (Object.keys(cleanedNested).length > 0) {
        cleaned[key] = cleanedNested;
      }
    } else {
      cleaned[key] = value;
    }
  }

  return cleaned;
}

/**
 * Validate and load configuration
 */
export function loadConfig(): Config {
  const rawConfig = loadFromEnv();
  const cleanedConfig = cleanUndefined(rawConfig);

  try {
    return ConfigSchema.parse(cleanedConfig);
  } catch (error) {
    if (error instanceof ZodError) {
      const messages = error.errors.map(
        (e) => `${e.path.join('.')}: ${e.message}`
      );
      throw new ConfigError('Configuration validation failed', messages);
    }
    throw error;
  }
}

/**
 * Validate configuration without loading
 */
export function validateConfig(config: unknown): Config {
  try {
    return ConfigSchema.parse(config);
  } catch (error) {
    if (error instanceof ZodError) {
      const messages = error.errors.map(
        (e) => `${e.path.join('.')}: ${e.message}`
      );
      throw new ConfigError('Configuration validation failed', messages);
    }
    throw error;
  }
}

/**
 * Check for required configuration at startup
 */
export function validateStartup(config: Config): void {
  const warnings: string[] = [];
  const errors: string[] = [];

  // Check for API key based on provider
  if (config.llm.provider === 'openai' && !config.llm.apiKey) {
    if (process.env.OPENAI_API_KEY) {
      // Key exists but wasn't loaded into config, that's fine
    } else {
      errors.push(
        'OPENAI_API_KEY is required when using OpenAI provider. ' +
        'Set it in your environment or .env file.'
      );
    }
  }

  if (config.llm.provider === 'anthropic' && !config.llm.apiKey) {
    if (!process.env.ANTHROPIC_API_KEY) {
      errors.push(
        'ANTHROPIC_API_KEY is required when using Anthropic provider. ' +
        'Set it in your environment or .env file.'
      );
    }
  }

  // Warnings for optional but recommended settings
  if (config.logging.level === 'debug' && !process.env.NODE_ENV) {
    warnings.push(
      'Running in debug mode. Set NODE_ENV=production for production use.'
    );
  }

  // Log warnings
  if (warnings.length > 0) {
    console.warn('[Config Warning]', warnings.join('\n'));
  }

  // Throw on errors
  if (errors.length > 0) {
    throw new ConfigError(
      'Missing required configuration',
      errors
    );
  }
}

/**
 * Cached configuration instance
 */
let cachedConfig: Config | null = null;

/**
 * Get configuration (loads once, then cached)
 */
export function getConfig(): Config {
  if (!cachedConfig) {
    cachedConfig = loadConfig();
  }
  return cachedConfig;
}

/**
 * Reset configuration cache (mainly for testing)
 */
export function resetConfig(): void {
  cachedConfig = null;
}

/**
 * Get a specific configuration value
 */
export function getConfigValue<K extends keyof Config>(key: K): Config[K] {
  return getConfig()[key];
}
