/**
 * @openagent/llm
 *
 * LLM abstraction layer for OpenAgent.
 * Provides a provider-agnostic interface for interacting with any LLM backend.
 */

export const version = '0.0.0';

// ============================================================================
// Type Exports
// ============================================================================

export type {
  // Message types
  MessageRole,
  TextContent,
  ImageContent,
  ContentPart,
  Message,

  // Tool types
  JSONSchema,
  ToolDefinition,
  ToolCall,

  // Streaming types
  TextChunk,
  ToolCallChunk,
  UsageChunk,
  DoneChunk,
  ErrorChunk,
  StreamChunk,

  // Chat parameters
  ToolChoice,
  ChatParams,

  // Provider interface
  ProviderCapabilities,
  ProviderConfig,
  ValidationResult,
  LLMProvider,

  // Router types
  RouterConfig,
} from './types';

// ============================================================================
// Provider Adapters
// ============================================================================

export { OpenAIProvider } from './adapters/openai';
export type { OpenAIConfig } from './adapters/openai';

// ============================================================================
// Router
// ============================================================================

export { LLMRouter, createRouter } from './router';
