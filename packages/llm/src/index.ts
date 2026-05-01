/**
 * @pram1t/mustard-llm
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
} from './types.js';

// ============================================================================
// Provider Adapters
// ============================================================================

export { OpenAIProvider } from './adapters/openai.js';
export type { OpenAIConfig } from './adapters/openai.js';

export { AnthropicProvider } from './adapters/anthropic.js';
export type { AnthropicConfig } from './adapters/anthropic.js';

export { GeminiProvider } from './adapters/gemini.js';
export type { GeminiConfig } from './adapters/gemini.js';

export { OllamaProvider } from './adapters/ollama.js';
export type { OllamaConfig } from './adapters/ollama.js';

export { OpenAICompatibleProvider } from './adapters/openai-compatible.js';
export type { OpenAICompatibleConfig } from './adapters/openai-compatible.js';

// ============================================================================
// Router
// ============================================================================

export { LLMRouter, createRouter } from './router.js';
