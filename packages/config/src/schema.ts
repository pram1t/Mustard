/**
 * Configuration Schema
 *
 * Defines the configuration structure using Zod for validation.
 */

import { z } from 'zod';

/**
 * Log level schema
 */
export const LogLevelSchema = z.enum([
  'trace',
  'debug',
  'info',
  'warn',
  'error',
  'fatal',
  'silent',
]);

/**
 * Log format schema
 */
export const LogFormatSchema = z.enum(['json', 'pretty']);

/**
 * LLM Provider schema
 */
export const LLMProviderSchema = z.enum([
  'openai',
  'anthropic',
  'gemini',
  'ollama',
]);

/**
 * Logging configuration
 */
export const LoggingConfigSchema = z.object({
  level: LogLevelSchema.default('info'),
  format: LogFormatSchema.optional(),
});

/**
 * LLM configuration
 */
export const LLMConfigSchema = z.object({
  provider: LLMProviderSchema.default('openai'),
  model: z.string().optional(),
  apiKey: z.string().optional(),
  baseUrl: z.string().url().optional(),
  retryAttempts: z.number().int().min(0).max(10).default(3),
  retryDelay: z.number().int().min(0).max(60000).default(1000),
});

/**
 * Tool configuration
 */
export const ToolConfigSchema = z.object({
  bash: z.object({
    maxTimeout: z.number().int().min(1000).max(600000).default(120000),
    maxOutputSize: z.number().int().min(1000).max(1000000).default(30000),
    allowedEnvVars: z.array(z.string()).optional(),
  }).default({}),
  maxOutputSize: z.number().int().min(1000).max(1000000).default(100000),
});

/**
 * Security configuration
 */
export const SecurityConfigSchema = z.object({
  auditLogging: z.boolean().default(false),
  sanitizeInputs: z.boolean().default(true),
});

/**
 * Full application configuration
 */
export const ConfigSchema = z.object({
  logging: LoggingConfigSchema.default({}),
  llm: LLMConfigSchema.default({}),
  tools: ToolConfigSchema.default({}),
  security: SecurityConfigSchema.default({}),
});

/**
 * Type definitions derived from schema
 */
export type LogLevel = z.infer<typeof LogLevelSchema>;
export type LogFormat = z.infer<typeof LogFormatSchema>;
export type LLMProvider = z.infer<typeof LLMProviderSchema>;
export type LoggingConfig = z.infer<typeof LoggingConfigSchema>;
export type LLMConfig = z.infer<typeof LLMConfigSchema>;
export type ToolConfig = z.infer<typeof ToolConfigSchema>;
export type SecurityConfig = z.infer<typeof SecurityConfigSchema>;
export type Config = z.infer<typeof ConfigSchema>;
