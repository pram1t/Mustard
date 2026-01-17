# LLM Abstraction Layer

This document describes the LLM provider abstraction that allows OpenAgent to work with any LLM backend.

## Design Philosophy

The LLM abstraction layer follows these principles:

1. **Provider Agnostic**: Core agent logic never touches provider-specific APIs
2. **Capability Detection**: Adapters declare what features they support
3. **Graceful Degradation**: Missing features handled gracefully
4. **Streaming First**: All responses streamed for real-time UI
5. **Tool Format Normalization**: Tool calls normalized across providers

## Core Interface

```typescript
// packages/llm/src/interface.ts

/**
 * Message role in conversation
 */
type MessageRole = 'system' | 'user' | 'assistant' | 'tool';

/**
 * Content can be text or multi-modal
 */
interface TextContent {
  type: 'text';
  text: string;
}

interface ImageContent {
  type: 'image';
  source: {
    type: 'base64' | 'url';
    media_type?: string;
    data?: string;
    url?: string;
  };
}

type ContentPart = TextContent | ImageContent;

/**
 * A message in the conversation
 */
interface Message {
  role: MessageRole;
  content: string | ContentPart[];
  name?: string;           // For tool messages, the tool name
  tool_call_id?: string;   // For tool result messages
}

/**
 * Tool definition following OpenAI-style schema
 */
interface ToolDefinition {
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
interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

/**
 * Streaming chunk types
 */
interface TextChunk {
  type: 'text';
  content: string;
}

interface ToolCallChunk {
  type: 'tool_call';
  tool_call: ToolCall;
}

interface UsageChunk {
  type: 'usage';
  input_tokens: number;
  output_tokens: number;
}

interface DoneChunk {
  type: 'done';
}

type StreamChunk = TextChunk | ToolCallChunk | UsageChunk | DoneChunk;

/**
 * Parameters for chat completion
 */
interface ChatParams {
  messages: Message[];
  tools?: ToolDefinition[];
  tool_choice?: 'auto' | 'none' | 'required' | { name: string };
  temperature?: number;
  max_tokens?: number;
  stop?: string[];
}

/**
 * Provider capabilities
 */
interface ProviderCapabilities {
  streaming: boolean;
  toolUse: boolean;
  vision: boolean;
  systemMessages: boolean;
  parallelToolCalls: boolean;
  maxContextLength: number;
}

/**
 * The core LLM provider interface
 * All provider adapters must implement this
 */
interface LLMProvider {
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
  validate(): Promise<{ valid: boolean; error?: string }>;
}
```

## Provider Implementations

### OpenAI Adapter

```typescript
// packages/llm/src/adapters/openai.ts

import OpenAI from 'openai';
import type { LLMProvider, ChatParams, StreamChunk, Message } from '../interface';

export class OpenAIProvider implements LLMProvider {
  readonly name = 'openai';
  readonly models = ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo'];

  model: string;
  private client: OpenAI;

  readonly capabilities = {
    streaming: true,
    toolUse: true,
    vision: true,
    systemMessages: true,
    parallelToolCalls: true,
    maxContextLength: 128000, // gpt-4o
  };

  constructor(config: { apiKey: string; model?: string; baseURL?: string }) {
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
    });
    this.model = config.model || 'gpt-4o';
  }

  async *chat(params: ChatParams): AsyncGenerator<StreamChunk> {
    const stream = await this.client.chat.completions.create({
      model: this.model,
      messages: this.formatMessages(params.messages),
      tools: params.tools?.map(this.formatTool),
      tool_choice: params.tool_choice as any,
      temperature: params.temperature,
      max_tokens: params.max_tokens,
      stop: params.stop,
      stream: true,
    });

    let currentToolCall: Partial<ToolCall> | null = null;

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;

      // Text content
      if (delta?.content) {
        yield { type: 'text', content: delta.content };
      }

      // Tool calls
      if (delta?.tool_calls) {
        for (const tc of delta.tool_calls) {
          if (tc.id) {
            // New tool call starting
            if (currentToolCall?.id) {
              yield {
                type: 'tool_call',
                tool_call: this.finalizeToolCall(currentToolCall),
              };
            }
            currentToolCall = {
              id: tc.id,
              name: tc.function?.name || '',
              arguments: {},
            };
          }
          if (tc.function?.name) {
            currentToolCall!.name = tc.function.name;
          }
          if (tc.function?.arguments) {
            // Accumulate argument JSON string
            currentToolCall!._argString =
              (currentToolCall!._argString || '') + tc.function.arguments;
          }
        }
      }

      // Usage info
      if (chunk.usage) {
        yield {
          type: 'usage',
          input_tokens: chunk.usage.prompt_tokens,
          output_tokens: chunk.usage.completion_tokens,
        };
      }
    }

    // Emit final tool call if any
    if (currentToolCall?.id) {
      yield {
        type: 'tool_call',
        tool_call: this.finalizeToolCall(currentToolCall),
      };
    }

    yield { type: 'done' };
  }

  async countTokens(messages: Message[]): Promise<number> {
    // Use tiktoken or estimate
    // For now, rough estimate: 4 chars = 1 token
    const text = messages.map(m =>
      typeof m.content === 'string' ? m.content : JSON.stringify(m.content)
    ).join('');
    return Math.ceil(text.length / 4);
  }

  async validate(): Promise<{ valid: boolean; error?: string }> {
    try {
      await this.client.models.list();
      return { valid: true };
    } catch (error) {
      return { valid: false, error: String(error) };
    }
  }

  private formatMessages(messages: Message[]): OpenAI.ChatCompletionMessageParam[] {
    return messages.map(msg => ({
      role: msg.role as any,
      content: msg.content as any,
      name: msg.name,
      tool_call_id: msg.tool_call_id,
    }));
  }

  private formatTool(tool: ToolDefinition): OpenAI.ChatCompletionTool {
    return {
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters as any,
      },
    };
  }

  private finalizeToolCall(partial: any): ToolCall {
    return {
      id: partial.id,
      name: partial.name,
      arguments: partial._argString ? JSON.parse(partial._argString) : {},
    };
  }
}
```

### Anthropic Adapter

```typescript
// packages/llm/src/adapters/anthropic.ts

import Anthropic from '@anthropic-ai/sdk';
import type { LLMProvider, ChatParams, StreamChunk, Message } from '../interface';

export class AnthropicProvider implements LLMProvider {
  readonly name = 'anthropic';
  readonly models = [
    'claude-opus-4-5-20251101',
    'claude-sonnet-4-5-20251101',
    'claude-haiku-3-5-20241022',
  ];

  model: string;
  private client: Anthropic;

  readonly capabilities = {
    streaming: true,
    toolUse: true,
    vision: true,
    systemMessages: true,
    parallelToolCalls: true,
    maxContextLength: 200000,
  };

  constructor(config: { apiKey: string; model?: string }) {
    this.client = new Anthropic({ apiKey: config.apiKey });
    this.model = config.model || 'claude-sonnet-4-5-20251101';
  }

  async *chat(params: ChatParams): AsyncGenerator<StreamChunk> {
    // Extract system message
    const systemMessage = params.messages.find(m => m.role === 'system');
    const otherMessages = params.messages.filter(m => m.role !== 'system');

    const stream = this.client.messages.stream({
      model: this.model,
      system: systemMessage?.content as string,
      messages: this.formatMessages(otherMessages),
      tools: params.tools?.map(this.formatTool),
      max_tokens: params.max_tokens || 4096,
      temperature: params.temperature,
      stop_sequences: params.stop,
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta') {
        if (event.delta.type === 'text_delta') {
          yield { type: 'text', content: event.delta.text };
        } else if (event.delta.type === 'input_json_delta') {
          // Tool input streaming - accumulate
        }
      } else if (event.type === 'content_block_stop') {
        // Check if this was a tool use block
      } else if (event.type === 'message_delta') {
        if (event.usage) {
          yield {
            type: 'usage',
            input_tokens: event.usage.input_tokens || 0,
            output_tokens: event.usage.output_tokens,
          };
        }
      }
    }

    // Get final message for tool calls
    const finalMessage = await stream.finalMessage();
    for (const block of finalMessage.content) {
      if (block.type === 'tool_use') {
        yield {
          type: 'tool_call',
          tool_call: {
            id: block.id,
            name: block.name,
            arguments: block.input as Record<string, unknown>,
          },
        };
      }
    }

    yield { type: 'done' };
  }

  async countTokens(messages: Message[]): Promise<number> {
    // Anthropic has a token counting API
    // For now, estimate: 4 chars = 1 token
    const text = messages.map(m =>
      typeof m.content === 'string' ? m.content : JSON.stringify(m.content)
    ).join('');
    return Math.ceil(text.length / 4);
  }

  async validate(): Promise<{ valid: boolean; error?: string }> {
    try {
      // Simple validation - try to count tokens
      await this.client.messages.create({
        model: this.model,
        max_tokens: 1,
        messages: [{ role: 'user', content: 'hi' }],
      });
      return { valid: true };
    } catch (error) {
      return { valid: false, error: String(error) };
    }
  }

  private formatMessages(messages: Message[]): Anthropic.MessageParam[] {
    return messages.map(msg => {
      if (msg.role === 'tool') {
        return {
          role: 'user' as const,
          content: [{
            type: 'tool_result' as const,
            tool_use_id: msg.tool_call_id!,
            content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
          }],
        };
      }
      return {
        role: msg.role as 'user' | 'assistant',
        content: msg.content as any,
      };
    });
  }

  private formatTool(tool: ToolDefinition): Anthropic.Tool {
    return {
      name: tool.name,
      description: tool.description,
      input_schema: tool.parameters as any,
    };
  }
}
```

### Gemini Adapter

```typescript
// packages/llm/src/adapters/gemini.ts

import { GoogleGenerativeAI } from '@google/generative-ai';
import type { LLMProvider, ChatParams, StreamChunk, Message } from '../interface';

export class GeminiProvider implements LLMProvider {
  readonly name = 'gemini';
  readonly models = ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-2.0-flash'];

  model: string;
  private client: GoogleGenerativeAI;

  readonly capabilities = {
    streaming: true,
    toolUse: true,
    vision: true,
    systemMessages: true,
    parallelToolCalls: true,
    maxContextLength: 1000000, // 1M context
  };

  constructor(config: { apiKey: string; model?: string }) {
    this.client = new GoogleGenerativeAI(config.apiKey);
    this.model = config.model || 'gemini-1.5-pro';
  }

  async *chat(params: ChatParams): AsyncGenerator<StreamChunk> {
    const model = this.client.getGenerativeModel({
      model: this.model,
      tools: params.tools ? [{ functionDeclarations: params.tools.map(this.formatTool) }] : undefined,
    });

    const chat = model.startChat({
      history: this.formatHistory(params.messages.slice(0, -1)),
    });

    const lastMessage = params.messages[params.messages.length - 1];
    const result = await chat.sendMessageStream(
      typeof lastMessage.content === 'string'
        ? lastMessage.content
        : JSON.stringify(lastMessage.content)
    );

    for await (const chunk of result.stream) {
      const text = chunk.text();
      if (text) {
        yield { type: 'text', content: text };
      }

      // Check for function calls
      const functionCalls = chunk.functionCalls();
      if (functionCalls) {
        for (const fc of functionCalls) {
          yield {
            type: 'tool_call',
            tool_call: {
              id: `fc_${Date.now()}_${Math.random().toString(36).slice(2)}`,
              name: fc.name,
              arguments: fc.args as Record<string, unknown>,
            },
          };
        }
      }
    }

    // Get usage from final response
    const response = await result.response;
    if (response.usageMetadata) {
      yield {
        type: 'usage',
        input_tokens: response.usageMetadata.promptTokenCount || 0,
        output_tokens: response.usageMetadata.candidatesTokenCount || 0,
      };
    }

    yield { type: 'done' };
  }

  async countTokens(messages: Message[]): Promise<number> {
    const model = this.client.getGenerativeModel({ model: this.model });
    const text = messages.map(m =>
      typeof m.content === 'string' ? m.content : JSON.stringify(m.content)
    ).join('');
    const result = await model.countTokens(text);
    return result.totalTokens;
  }

  async validate(): Promise<{ valid: boolean; error?: string }> {
    try {
      const model = this.client.getGenerativeModel({ model: this.model });
      await model.countTokens('test');
      return { valid: true };
    } catch (error) {
      return { valid: false, error: String(error) };
    }
  }

  private formatHistory(messages: Message[]): any[] {
    // Convert to Gemini format
    return messages.map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content) }],
    }));
  }

  private formatTool(tool: ToolDefinition): any {
    return {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    };
  }
}
```

### Ollama Adapter (Local LLMs)

```typescript
// packages/llm/src/adapters/ollama.ts

import type { LLMProvider, ChatParams, StreamChunk, Message } from '../interface';

export class OllamaProvider implements LLMProvider {
  readonly name = 'ollama';
  models: string[] = []; // Populated on init

  model: string;
  private baseURL: string;

  capabilities = {
    streaming: true,
    toolUse: false, // Depends on model
    vision: false,  // Depends on model
    systemMessages: true,
    parallelToolCalls: false,
    maxContextLength: 8192, // Varies by model
  };

  constructor(config: { baseURL?: string; model?: string }) {
    this.baseURL = config.baseURL || 'http://localhost:11434';
    this.model = config.model || 'llama3.1';
  }

  async initialize(): Promise<void> {
    // Fetch available models
    const response = await fetch(`${this.baseURL}/api/tags`);
    const data = await response.json();
    this.models = data.models?.map((m: any) => m.name) || [];

    // Check model capabilities
    const modelInfo = await this.getModelInfo();
    this.capabilities.toolUse = modelInfo.supportsTools || false;
    this.capabilities.vision = modelInfo.supportsVision || false;
    this.capabilities.maxContextLength = modelInfo.contextLength || 8192;
  }

  async *chat(params: ChatParams): AsyncGenerator<StreamChunk> {
    const response = await fetch(`${this.baseURL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        messages: this.formatMessages(params.messages),
        tools: this.capabilities.toolUse ? params.tools?.map(this.formatTool) : undefined,
        stream: true,
        options: {
          temperature: params.temperature,
          num_predict: params.max_tokens,
          stop: params.stop,
        },
      }),
    });

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim()) continue;
        const data = JSON.parse(line);

        if (data.message?.content) {
          yield { type: 'text', content: data.message.content };
        }

        if (data.message?.tool_calls) {
          for (const tc of data.message.tool_calls) {
            yield {
              type: 'tool_call',
              tool_call: {
                id: `ollama_${Date.now()}`,
                name: tc.function.name,
                arguments: tc.function.arguments,
              },
            };
          }
        }

        if (data.done && data.eval_count) {
          yield {
            type: 'usage',
            input_tokens: data.prompt_eval_count || 0,
            output_tokens: data.eval_count,
          };
        }
      }
    }

    yield { type: 'done' };
  }

  async countTokens(messages: Message[]): Promise<number> {
    // Ollama doesn't have a token counting endpoint
    // Estimate: ~4 chars per token
    const text = messages.map(m =>
      typeof m.content === 'string' ? m.content : JSON.stringify(m.content)
    ).join('');
    return Math.ceil(text.length / 4);
  }

  async validate(): Promise<{ valid: boolean; error?: string }> {
    try {
      const response = await fetch(`${this.baseURL}/api/tags`);
      if (!response.ok) throw new Error('Failed to connect');
      return { valid: true };
    } catch (error) {
      return { valid: false, error: String(error) };
    }
  }

  private async getModelInfo(): Promise<any> {
    try {
      const response = await fetch(`${this.baseURL}/api/show`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: this.model }),
      });
      return await response.json();
    } catch {
      return {};
    }
  }

  private formatMessages(messages: Message[]): any[] {
    return messages.map(msg => ({
      role: msg.role,
      content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
    }));
  }

  private formatTool(tool: ToolDefinition): any {
    return {
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    };
  }
}
```

### OpenAI-Compatible Adapter (Fallback)

```typescript
// packages/llm/src/adapters/openai-compatible.ts

import type { LLMProvider, ChatParams, StreamChunk, Message } from '../interface';

/**
 * Generic adapter for any OpenAI-compatible API
 * Works with: LM Studio, vLLM, LocalAI, Together.ai, Groq, etc.
 */
export class OpenAICompatibleProvider implements LLMProvider {
  readonly name: string;
  models: string[];

  model: string;
  private baseURL: string;
  private apiKey: string;

  capabilities = {
    streaming: true,
    toolUse: true,  // Assume yes, will fail gracefully if not
    vision: false,
    systemMessages: true,
    parallelToolCalls: false,
    maxContextLength: 8192,
  };

  constructor(config: {
    name?: string;
    baseURL: string;
    apiKey?: string;
    model: string;
    models?: string[];
    capabilities?: Partial<typeof this.capabilities>;
  }) {
    this.name = config.name || 'openai-compatible';
    this.baseURL = config.baseURL;
    this.apiKey = config.apiKey || 'not-needed';
    this.model = config.model;
    this.models = config.models || [config.model];

    if (config.capabilities) {
      this.capabilities = { ...this.capabilities, ...config.capabilities };
    }
  }

  async *chat(params: ChatParams): AsyncGenerator<StreamChunk> {
    const response = await fetch(`${this.baseURL}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: params.messages,
        tools: this.capabilities.toolUse ? params.tools : undefined,
        tool_choice: params.tool_choice,
        temperature: params.temperature,
        max_tokens: params.max_tokens,
        stop: params.stop,
        stream: true,
      }),
    });

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6);
        if (data === '[DONE]') continue;

        try {
          const parsed = JSON.parse(data);
          const delta = parsed.choices?.[0]?.delta;

          if (delta?.content) {
            yield { type: 'text', content: delta.content };
          }

          if (delta?.tool_calls) {
            for (const tc of delta.tool_calls) {
              if (tc.id && tc.function?.name) {
                yield {
                  type: 'tool_call',
                  tool_call: {
                    id: tc.id,
                    name: tc.function.name,
                    arguments: tc.function.arguments
                      ? JSON.parse(tc.function.arguments)
                      : {},
                  },
                };
              }
            }
          }

          if (parsed.usage) {
            yield {
              type: 'usage',
              input_tokens: parsed.usage.prompt_tokens || 0,
              output_tokens: parsed.usage.completion_tokens || 0,
            };
          }
        } catch {
          // Skip malformed chunks
        }
      }
    }

    yield { type: 'done' };
  }

  async countTokens(messages: Message[]): Promise<number> {
    // Generic estimate
    const text = messages.map(m =>
      typeof m.content === 'string' ? m.content : JSON.stringify(m.content)
    ).join('');
    return Math.ceil(text.length / 4);
  }

  async validate(): Promise<{ valid: boolean; error?: string }> {
    try {
      const response = await fetch(`${this.baseURL}/v1/models`, {
        headers: { 'Authorization': `Bearer ${this.apiKey}` },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return { valid: true };
    } catch (error) {
      return { valid: false, error: String(error) };
    }
  }
}
```

## LLM Router

```typescript
// packages/llm/src/router.ts

import type { LLMProvider, ChatParams, StreamChunk } from './interface';

interface RouterConfig {
  primary: string;
  fallback?: string[];
  retryAttempts?: number;
  retryDelay?: number;
}

export class LLMRouter {
  private providers: Map<string, LLMProvider> = new Map();
  private config: RouterConfig;

  constructor(config: RouterConfig) {
    this.config = {
      retryAttempts: 3,
      retryDelay: 1000,
      ...config,
    };
  }

  registerProvider(provider: LLMProvider): void {
    this.providers.set(provider.name, provider);
  }

  getProvider(name?: string): LLMProvider {
    const providerName = name || this.config.primary;
    const provider = this.providers.get(providerName);
    if (!provider) {
      throw new Error(`Provider '${providerName}' not registered`);
    }
    return provider;
  }

  async *chat(params: ChatParams): AsyncGenerator<StreamChunk> {
    const providerOrder = [
      this.config.primary,
      ...(this.config.fallback || []),
    ];

    let lastError: Error | null = null;

    for (const providerName of providerOrder) {
      const provider = this.providers.get(providerName);
      if (!provider) continue;

      for (let attempt = 0; attempt < this.config.retryAttempts!; attempt++) {
        try {
          yield* provider.chat(params);
          return; // Success
        } catch (error) {
          lastError = error as Error;

          // Check if error is retryable
          if (this.isRetryable(error)) {
            await this.delay(this.config.retryDelay! * Math.pow(2, attempt));
            continue;
          }

          // Non-retryable error, try next provider
          break;
        }
      }
    }

    throw lastError || new Error('All providers failed');
  }

  private isRetryable(error: any): boolean {
    // Rate limits, temporary failures
    if (error?.status === 429) return true;
    if (error?.status === 503) return true;
    if (error?.code === 'ECONNRESET') return true;
    if (error?.code === 'ETIMEDOUT') return true;
    return false;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

## Adding a New Provider

To add support for a new LLM provider:

1. Create a new file in `packages/llm/src/adapters/`
2. Implement the `LLMProvider` interface
3. Handle provider-specific message formats
4. Handle provider-specific tool call formats
5. Register the provider with the router

See [templates/llm-adapter-template.ts](../templates/llm-adapter-template.ts) for a starter template.

## Configuration

Provider configuration in `~/.openagent/config.json`:

```json
{
  "llm": {
    "provider": "openai",
    "fallback": ["anthropic", "ollama"],

    "openai": {
      "apiKey": "sk-...",
      "model": "gpt-4o",
      "baseURL": null
    },

    "anthropic": {
      "apiKey": "sk-ant-...",
      "model": "claude-sonnet-4-5-20251101"
    },

    "gemini": {
      "apiKey": "...",
      "model": "gemini-1.5-pro"
    },

    "ollama": {
      "baseURL": "http://localhost:11434",
      "model": "llama3.1"
    },

    "custom": {
      "name": "my-provider",
      "baseURL": "http://my-llm-server:8000",
      "apiKey": "...",
      "model": "my-model"
    }
  }
}
```

## Next Steps

- See [TOOL-SYSTEM.md](TOOL-SYSTEM.md) for how tools integrate with LLM
- See [AGENT-LOOP.md](AGENT-LOOP.md) for the orchestration using LLM
- See [specs/llm-provider-interface.ts](../specs/llm-provider-interface.ts) for type definitions
