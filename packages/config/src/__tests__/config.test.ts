/**
 * Config Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  ConfigSchema,
  validateConfig,
  loadConfig,
  getConfig,
  resetConfig,
  ConfigError,
} from '../index';

describe('Config', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    resetConfig();
    // Reset env to clean state
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    resetConfig();
  });

  describe('ConfigSchema', () => {
    it('should accept empty config and apply defaults', () => {
      const result = ConfigSchema.parse({});

      expect(result.logging.level).toBe('info');
      expect(result.llm.provider).toBe('openai');
      expect(result.llm.retryAttempts).toBe(3);
      expect(result.llm.retryDelay).toBe(1000);
      expect(result.tools.bash.maxTimeout).toBe(120000);
      expect(result.tools.bash.maxOutputSize).toBe(30000);
      expect(result.tools.maxOutputSize).toBe(100000);
      expect(result.security.auditLogging).toBe(true);  // Default changed for security
      expect(result.security.sanitizeInputs).toBe(true);
    });

    it('should accept valid log levels', () => {
      const levels = ['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent'];

      for (const level of levels) {
        const result = ConfigSchema.parse({ logging: { level } });
        expect(result.logging.level).toBe(level);
      }
    });

    it('should reject invalid log level', () => {
      expect(() => ConfigSchema.parse({ logging: { level: 'invalid' } })).toThrow();
    });

    it('should accept valid providers', () => {
      const providers = ['openai', 'anthropic', 'gemini', 'ollama'];

      for (const provider of providers) {
        const result = ConfigSchema.parse({ llm: { provider } });
        expect(result.llm.provider).toBe(provider);
      }
    });

    it('should validate retry attempts range', () => {
      expect(() => ConfigSchema.parse({ llm: { retryAttempts: -1 } })).toThrow();
      expect(() => ConfigSchema.parse({ llm: { retryAttempts: 11 } })).toThrow();

      const valid = ConfigSchema.parse({ llm: { retryAttempts: 5 } });
      expect(valid.llm.retryAttempts).toBe(5);
    });

    it('should validate bash timeout range', () => {
      expect(() => ConfigSchema.parse({ tools: { bash: { maxTimeout: 500 } } })).toThrow();
      expect(() => ConfigSchema.parse({ tools: { bash: { maxTimeout: 700000 } } })).toThrow();

      const valid = ConfigSchema.parse({ tools: { bash: { maxTimeout: 60000 } } });
      expect(valid.tools.bash.maxTimeout).toBe(60000);
    });
  });

  describe('validateConfig', () => {
    it('should validate and return config', () => {
      const config = validateConfig({ logging: { level: 'debug' } });
      expect(config.logging.level).toBe('debug');
    });

    it('should throw ConfigError on invalid config', () => {
      expect(() => validateConfig({ logging: { level: 'invalid' } })).toThrow(ConfigError);
    });

    it('should include error details', () => {
      try {
        validateConfig({ logging: { level: 'invalid' } });
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ConfigError);
        expect((error as ConfigError).errors).toBeDefined();
        expect((error as ConfigError).errors!.length).toBeGreaterThan(0);
      }
    });
  });

  describe('loadConfig', () => {
    it('should load config from environment', () => {
      process.env.LOG_LEVEL = 'warn';
      process.env.OPENAGENT_PROVIDER = 'anthropic';
      process.env.BASH_TIMEOUT = '60000';

      const config = loadConfig();

      expect(config.logging.level).toBe('warn');
      expect(config.llm.provider).toBe('anthropic');
      expect(config.tools.bash.maxTimeout).toBe(60000);
    });

    it('should handle missing env vars with defaults', () => {
      delete process.env.LOG_LEVEL;
      delete process.env.OPENAGENT_PROVIDER;

      const config = loadConfig();

      expect(config.logging.level).toBe('info');
      expect(config.llm.provider).toBe('openai');
    });

    it('should parse boolean env vars', () => {
      process.env.AUDIT_LOGGING = 'true';
      process.env.SANITIZE_INPUTS = 'false';

      const config = loadConfig();

      expect(config.security.auditLogging).toBe(true);
      expect(config.security.sanitizeInputs).toBe(false);
    });

    it('should parse comma-separated allowed env vars', () => {
      process.env.BASH_ALLOWED_ENV_VARS = 'CUSTOM_VAR, ANOTHER_VAR';

      const config = loadConfig();

      expect(config.tools.bash.allowedEnvVars).toEqual(['CUSTOM_VAR', 'ANOTHER_VAR']);
    });
  });

  describe('getConfig', () => {
    it('should cache config', () => {
      process.env.LOG_LEVEL = 'debug';
      const config1 = getConfig();

      process.env.LOG_LEVEL = 'error';
      const config2 = getConfig();

      // Should return cached value
      expect(config1).toBe(config2);
      expect(config1.logging.level).toBe('debug');
    });

    it('should reload after reset', () => {
      process.env.LOG_LEVEL = 'debug';
      const config1 = getConfig();

      resetConfig();
      process.env.LOG_LEVEL = 'error';
      const config2 = getConfig();

      expect(config1).not.toBe(config2);
      expect(config2.logging.level).toBe('error');
    });
  });
});
