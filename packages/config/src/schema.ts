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
  auditLogging: z.boolean().default(true),  // Enabled by default for security
  sanitizeInputs: z.boolean().default(true),
});

/**
 * Hook matcher configuration
 */
export const HookMatcherSchema = z.object({
  tool: z.string().optional(),
  toolPattern: z.string().optional(),
});

/**
 * Individual hook configuration
 */
export const HookConfigSchema = z.object({
  command: z.string(),
  timeout: z.number().int().min(100).max(300000).default(10000),
  matcher: HookMatcherSchema.optional(),
  env: z.record(z.string()).optional(),
  cwd: z.string().optional(),
});

/**
 * Hooks configuration by event type
 */
export const HooksConfigSchema = z.object({
  session_start: z.array(HookConfigSchema).default([]),
  user_prompt_submit: z.array(HookConfigSchema).default([]),
  pre_tool_use: z.array(HookConfigSchema).default([]),
  post_tool_use: z.array(HookConfigSchema).default([]),
  stop: z.array(HookConfigSchema).default([]),
});

/**
 * Full application configuration
 */
export const ConfigSchema = z.object({
  logging: LoggingConfigSchema.default({}),
  llm: LLMConfigSchema.default({}),
  tools: ToolConfigSchema.default({}),
  security: SecurityConfigSchema.default({}),
  hooks: HooksConfigSchema.default({}),
});

// ============================================================================
// Project Configuration Schema (Phase 11.5)
// ============================================================================

/**
 * Permission configuration for project
 */
export const PermissionsConfigSchema = z.object({
  allowedTools: z.array(z.string()).optional(),
  blockedTools: z.array(z.string()).optional(),
  allowedPaths: z.array(z.string()).optional(),
  blockedPaths: z.array(z.string()).optional(),
});

/**
 * MCP server configuration reference
 */
export const MCPServerRefSchema = z.object({
  command: z.string().optional(),
  args: z.array(z.string()).optional(),
  url: z.string().url().optional(),
  env: z.record(z.string()).optional(),
});

/**
 * History settings
 */
export const HistoryConfigSchema = z.object({
  enabled: z.boolean().default(true),
  maxSizeBytes: z.number().int().min(0).optional(),
  maxAgeDays: z.number().int().min(0).optional(),
});

/**
 * Project-specific configuration
 * Stored in .openagent/config.json or ~/.openagent/config.json
 */
export const ProjectConfigSchema = z.object({
  // Model defaults
  model: z.string().optional(),
  provider: LLMProviderSchema.optional(),

  // Permissions
  permissions: PermissionsConfigSchema.optional(),

  // MCP servers for this project
  mcpServers: z.record(MCPServerRefSchema).optional(),

  // Custom system prompt addition
  systemPrompt: z.string().optional(),

  // Session settings
  historyEnabled: z.boolean().default(true),
  todoPersistence: z.boolean().default(true),
  history: HistoryConfigSchema.optional(),

  // Hooks (can be project-specific)
  hooks: HooksConfigSchema.optional(),
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
export type HookMatcher = z.infer<typeof HookMatcherSchema>;
export type HookConfig = z.infer<typeof HookConfigSchema>;
export type HooksConfig = z.infer<typeof HooksConfigSchema>;
export type Config = z.infer<typeof ConfigSchema>;

// Project config types (Phase 11.5)
export type PermissionsConfig = z.infer<typeof PermissionsConfigSchema>;
export type MCPServerRef = z.infer<typeof MCPServerRefSchema>;
export type HistoryConfig = z.infer<typeof HistoryConfigSchema>;
export type ProjectConfig = z.infer<typeof ProjectConfigSchema>;
