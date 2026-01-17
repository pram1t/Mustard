/**
 * LLM Abstraction Layer Types
 *
 * Provider-agnostic types for interacting with any LLM backend.
 * All provider adapters must normalize their responses to these types.
 */

// ============================================================================
// Message Types
// ============================================================================

/**
 * Message role in conversation
 */
export type MessageRole = 'system' | 'user' | 'assistant' | 'tool';

/**
 * Text content block
 */
export interface TextContent {
  type: 'text';
  text: string;
}

/**
 * Image content block for multi-modal messages
 */
export interface ImageContent {
  type: 'image';
  source: {
    type: 'base64' | 'url';
    media_type?: string;
    data?: string;
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
  role: MessageRole;
  content: string | ContentPart[];
  name?: string;           // For tool messages, the tool name
  tool_call_id?: string;   // For tool result messages
}

// ============================================================================
// Tool Types
// ============================================================================

/**
 * JSON Schema type for tool parameters
 */
export interface JSONSchema {
  type: string;
  description?: string;
  properties?: Record<string, JSONSchema>;
  required?: string[];
  items?: JSONSchema;
  enum?: unknown[];
  default?: unknown;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  format?: string;
  additionalProperties?: boolean | JSONSchema;
}

/**
 * Tool definition following OpenAI-style schema
 */
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, JSONSchema>;
    required?: string[];
  };
}

/**
 * Parsed tool call from LLM response
 */
export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

// ============================================================================
// Streaming Types
// ============================================================================

/**
 * Text content chunk during streaming
 */
export interface TextChunk {
  type: 'text';
  content: string;
}

/**
 * Tool call chunk - emitted when tool call is complete
 */
export interface ToolCallChunk {
  type: 'tool_call';
  tool_call: ToolCall;
}

/**
 * Usage information chunk - typically at end of response
 */
export interface UsageChunk {
  type: 'usage';
  input_tokens: number;
  output_tokens: number;
}

/**
 * Done chunk - signals end of stream
 */
export interface DoneChunk {
  type: 'done';
}

/**
 * Error chunk - signals an error during streaming
 */
export interface ErrorChunk {
  type: 'error';
  error: string;
}

/**
 * Union type for all streaming chunks
 */
export type StreamChunk = TextChunk | ToolCallChunk | UsageChunk | DoneChunk | ErrorChunk;

// ============================================================================
// Chat Parameters
// ============================================================================

/**
 * Tool choice options
 */
export type ToolChoice = 'auto' | 'none' | 'required' | { name: string };

/**
 * Parameters for chat completion
 */
export interface ChatParams {
  messages: Message[];
  tools?: ToolDefinition[];
  tool_choice?: ToolChoice;
  temperature?: number;
  max_tokens?: number;
  stop?: string[];
}

// ============================================================================
// Provider Interface
// ============================================================================

/**
 * Provider capabilities declaration
 */
export interface ProviderCapabilities {
  streaming: boolean;
  toolUse: boolean;
  vision: boolean;
  systemMessages: boolean;
  parallelToolCalls: boolean;
  maxContextLength: number;
}

/**
 * Provider configuration base
 */
export interface ProviderConfig {
  apiKey?: string;
  model?: string;
  baseURL?: string;
}

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * The core LLM provider interface
 * All provider adapters must implement this
 */
export interface LLMProvider {
  /** Provider identifier */
  readonly name: string;

  /** Available models for this provider */
  readonly models: string[];

  /** Current model being used */
  model: string;

  /** Provider capabilities */
  readonly capabilities: ProviderCapabilities;

  /**
   * Send messages and stream response
   * This is the primary method for LLM interaction
   */
  chat(params: ChatParams): AsyncGenerator<StreamChunk>;

  /**
   * Count tokens in messages
   * Used for context management
   */
  countTokens(messages: Message[]): Promise<number>;

  /**
   * Validate that the provider is configured correctly
   * Checks API key, connectivity, etc.
   */
  validate(): Promise<ValidationResult>;
}

// ============================================================================
// Router Types
// ============================================================================

/**
 * Router configuration
 */
export interface RouterConfig {
  primary: string;
  fallback?: string[];
  retryAttempts?: number;
  retryDelay?: number;
}
