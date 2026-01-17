/**
 * LLM Provider Interface Specification
 *
 * This file defines the core types and interfaces for the LLM abstraction layer.
 * All LLM provider adapters must implement these interfaces.
 */

// ============================================================================
// MESSAGE TYPES
// ============================================================================

/**
 * Role of a message in the conversation
 */
export type MessageRole = 'system' | 'user' | 'assistant' | 'tool';

/**
 * Text content part
 */
export interface TextContent {
  type: 'text';
  text: string;
}

/**
 * Image content part (for vision models)
 */
export interface ImageContent {
  type: 'image';
  source: {
    type: 'base64' | 'url';
    media_type?: string; // e.g., 'image/png'
    data?: string; // Base64 encoded
    url?: string;
  };
}

/**
 * Content can be text or multi-modal
 */
export type ContentPart = TextContent | ImageContent;

/**
 * A message in the conversation
 */
export interface Message {
  /** Role of the message sender */
  role: MessageRole;

  /** Content of the message (string or array of content parts) */
  content: string | ContentPart[];

  /** Name of the tool (for tool role messages) */
  name?: string;

  /** ID linking tool result to tool call */
  tool_call_id?: string;

  /** Timestamp of message (for ordering) */
  timestamp?: number;

  /** Cached token count (for context management) */
  tokenCount?: number;
}

// ============================================================================
// TOOL TYPES
// ============================================================================

/**
 * JSON Schema type (simplified)
 */
export interface JSONSchema {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'null';
  description?: string;
  enum?: unknown[];
  items?: JSONSchema;
  properties?: Record<string, JSONSchema>;
  required?: string[];
  default?: unknown;
  [key: string]: unknown;
}

/**
 * Tool definition for the LLM
 */
export interface ToolDefinition {
  /** Unique tool name */
  name: string;

  /** Description for the LLM to understand when to use */
  description: string;

  /** JSON Schema defining parameters */
  parameters: {
    type: 'object';
    properties: Record<string, JSONSchema>;
    required?: string[];
    additionalProperties?: boolean;
  };
}

/**
 * Parsed tool call from LLM response
 */
export interface ToolCall {
  /** Unique ID for this tool call */
  id: string;

  /** Name of the tool to call */
  name: string;

  /** Arguments parsed from LLM response */
  arguments: Record<string, unknown>;
}

// ============================================================================
// STREAMING TYPES
// ============================================================================

/**
 * Text chunk from streaming response
 */
export interface TextChunk {
  type: 'text';
  content: string;
}

/**
 * Tool call chunk from streaming response
 */
export interface ToolCallChunk {
  type: 'tool_call';
  tool_call: ToolCall;
}

/**
 * Usage information chunk
 */
export interface UsageChunk {
  type: 'usage';
  input_tokens: number;
  output_tokens: number;
}

/**
 * Completion signal
 */
export interface DoneChunk {
  type: 'done';
}

/**
 * Error chunk
 */
export interface ErrorChunk {
  type: 'error';
  error: string;
}

/**
 * All possible stream chunk types
 */
export type StreamChunk =
  | TextChunk
  | ToolCallChunk
  | UsageChunk
  | DoneChunk
  | ErrorChunk;

// ============================================================================
// CHAT PARAMETERS
// ============================================================================

/**
 * Tool choice options
 */
export type ToolChoice =
  | 'auto' // LLM decides
  | 'none' // No tools
  | 'required' // Must use a tool
  | { name: string }; // Specific tool

/**
 * Parameters for chat completion
 */
export interface ChatParams {
  /** Conversation messages */
  messages: Message[];

  /** Available tools */
  tools?: ToolDefinition[];

  /** How to handle tool selection */
  tool_choice?: ToolChoice;

  /** Sampling temperature (0-2) */
  temperature?: number;

  /** Maximum tokens to generate */
  max_tokens?: number;

  /** Stop sequences */
  stop?: string[];

  /** Top-p sampling */
  top_p?: number;

  /** Frequency penalty */
  frequency_penalty?: number;

  /** Presence penalty */
  presence_penalty?: number;
}

// ============================================================================
// PROVIDER CAPABILITIES
// ============================================================================

/**
 * Capabilities that a provider may support
 */
export interface ProviderCapabilities {
  /** Supports streaming responses */
  streaming: boolean;

  /** Supports tool/function calling */
  toolUse: boolean;

  /** Supports vision/image inputs */
  vision: boolean;

  /** Supports system messages */
  systemMessages: boolean;

  /** Supports parallel tool calls in single response */
  parallelToolCalls: boolean;

  /** Maximum context length in tokens */
  maxContextLength: number;
}

// ============================================================================
// PROVIDER INTERFACE
// ============================================================================

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Core LLM provider interface
 *
 * All provider adapters must implement this interface.
 */
export interface LLMProvider {
  /** Provider identifier (e.g., 'openai', 'anthropic') */
  readonly name: string;

  /** Available models for this provider */
  readonly models: string[];

  /** Currently selected model */
  model: string;

  /** Provider capabilities */
  readonly capabilities: ProviderCapabilities;

  /**
   * Send messages and stream response
   *
   * This is the primary method for LLM interaction.
   * Returns an async generator that yields stream chunks.
   *
   * @param params - Chat completion parameters
   * @returns Async generator of stream chunks
   */
  chat(params: ChatParams): AsyncGenerator<StreamChunk>;

  /**
   * Count tokens in messages
   *
   * Used for context window management.
   *
   * @param messages - Messages to count tokens for
   * @returns Approximate token count
   */
  countTokens(messages: Message[]): Promise<number>;

  /**
   * Validate provider configuration
   *
   * Checks API key, connectivity, etc.
   *
   * @returns Validation result
   */
  validate(): Promise<ValidationResult>;
}

// ============================================================================
// ROUTER TYPES
// ============================================================================

/**
 * Router configuration
 */
export interface RouterConfig {
  /** Primary provider to use */
  primary: string;

  /** Fallback providers in order */
  fallback?: string[];

  /** Maximum retry attempts per provider */
  retryAttempts?: number;

  /** Base delay for retry backoff (ms) */
  retryDelay?: number;

  /** Maximum delay for retry backoff (ms) */
  maxRetryDelay?: number;
}

/**
 * LLM Router interface
 */
export interface LLMRouter {
  /**
   * Register a provider
   */
  registerProvider(provider: LLMProvider): void;

  /**
   * Get a provider by name
   */
  getProvider(name?: string): LLMProvider;

  /**
   * Send messages with automatic routing and fallback
   */
  chat(params: ChatParams): AsyncGenerator<StreamChunk>;
}
