/**
 * Ollama Provider Adapter
 *
 * Implements the LLMProvider interface for Ollama's local LLM API.
 * Supports any model available in Ollama via HTTP API.
 */

import type {
  LLMProvider,
  ChatParams,
  StreamChunk,
  Message,
  ToolDefinition,
  ToolCall,
  ProviderCapabilities,
  ValidationResult,
} from '../types.js';

/**
 * Ollama provider configuration
 */
export interface OllamaConfig {
  baseURL?: string;
  model?: string;
}

/**
 * Ollama chat request format
 */
interface OllamaChatRequest {
  model: string;
  messages: OllamaMessage[];
  stream?: boolean;
  tools?: OllamaTool[];
  options?: {
    temperature?: number;
    stop?: string[];
  };
}

/**
 * Ollama message format
 */
interface OllamaMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  images?: string[];
  tool_calls?: OllamaToolCall[];
  tool_call_id?: string;
}

/**
 * Ollama tool format
 */
interface OllamaTool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

/**
 * Ollama tool call format
 */
interface OllamaToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: Record<string, unknown>;
  };
}

/**
 * Ollama streaming response chunk
 */
interface OllamaStreamChunk {
  model: string;
  created_at: string;
  message?: {
    role: string;
    content: string;
    tool_calls?: OllamaToolCall[];
  };
  done: boolean;
  done_reason?: string;
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

/**
 * Ollama model list response
 */
interface OllamaModelList {
  models: Array<{
    name: string;
    model: string;
    size: number;
    digest: string;
    modified_at: string;
  }>;
}

/**
 * Ollama LLM Provider
 */
export class OllamaProvider implements LLMProvider {
  readonly name = 'ollama';
  models: string[] = [];

  model: string;
  private baseURL: string;

  readonly capabilities: ProviderCapabilities = {
    streaming: true,
    toolUse: true, // Some models support it
    vision: false, // Model-dependent
    systemMessages: true,
    parallelToolCalls: false,
    maxContextLength: 32000, // Model-dependent
  };

  constructor(config: OllamaConfig) {
    this.baseURL = config.baseURL || 'http://localhost:11434';
    this.model = config.model || 'qwen2.5-coder:7b';
  }

  /**
   * Send messages and stream response
   */
  async *chat(params: ChatParams): AsyncGenerator<StreamChunk> {
    try {
      const body: OllamaChatRequest = {
        model: this.model,
        messages: this.formatMessages(params.messages),
        stream: true,
        options: {
          temperature: params.temperature,
          stop: params.stop,
        },
      };

      // Add tools if provided
      if (params.tools?.length) {
        body.tools = params.tools.map(t => this.formatTool(t));
      }

      const response = await fetch(`${this.baseURL}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text();
        yield { type: 'error', error: `Ollama API error: ${response.status} ${errorText}` };
        yield { type: 'done' };
        return;
      }

      if (!response.body) {
        yield { type: 'error', error: 'No response body from Ollama' };
        yield { type: 'done' };
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let inputTokens = 0;
      let outputTokens = 0;
      const toolCalls: ToolCall[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;

          try {
            const chunk: OllamaStreamChunk = JSON.parse(line);

            // Text content
            if (chunk.message?.content) {
              yield { type: 'text', content: chunk.message.content };
            }

            // Tool calls
            if (chunk.message?.tool_calls) {
              for (const tc of chunk.message.tool_calls) {
                toolCalls.push({
                  id: tc.id || `call_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
                  name: tc.function.name,
                  arguments: tc.function.arguments,
                });
              }
            }

            // Usage info (at the end when done=true)
            if (chunk.done) {
              if (chunk.prompt_eval_count) {
                inputTokens = chunk.prompt_eval_count;
              }
              if (chunk.eval_count) {
                outputTokens = chunk.eval_count;
              }
            }
          } catch {
            // Ignore JSON parse errors for malformed chunks
          }
        }
      }

      // Process any remaining buffer
      if (buffer.trim()) {
        try {
          const chunk: OllamaStreamChunk = JSON.parse(buffer);
          if (chunk.message?.content) {
            yield { type: 'text', content: chunk.message.content };
          }
          if (chunk.prompt_eval_count) {
            inputTokens = chunk.prompt_eval_count;
          }
          if (chunk.eval_count) {
            outputTokens = chunk.eval_count;
          }
        } catch {
          // Ignore
        }
      }

      // Emit tool calls
      for (const toolCall of toolCalls) {
        yield { type: 'tool_call', tool_call: toolCall };
      }

      // Emit usage info
      if (inputTokens > 0 || outputTokens > 0) {
        yield {
          type: 'usage',
          input_tokens: inputTokens,
          output_tokens: outputTokens,
        };
      }

      yield { type: 'done' };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);

      // Check for connection errors
      if (errorMsg.includes('ECONNREFUSED') || errorMsg.includes('fetch failed')) {
        yield {
          type: 'error',
          error: `Cannot connect to Ollama at ${this.baseURL}. Is Ollama running? Start with: ollama serve`,
        };
      } else {
        yield { type: 'error', error: errorMsg };
      }
      yield { type: 'done' };
    }
  }

  /**
   * Count tokens in messages
   * Ollama doesn't have a public tokenizer, so we estimate
   */
  async countTokens(messages: Message[]): Promise<number> {
    // Rough estimate: ~4 characters per token
    let totalChars = 0;

    for (const message of messages) {
      const content = typeof message.content === 'string'
        ? message.content
        : message.content.map(c => c.type === 'text' ? c.text : '[image]').join('');

      totalChars += content.length;
      totalChars += message.role.length;
    }

    // Add overhead for message formatting
    totalChars += messages.length * 10;

    return Math.ceil(totalChars / 4);
  }

  /**
   * Validate connectivity to Ollama
   */
  async validate(): Promise<ValidationResult> {
    try {
      const response = await fetch(`${this.baseURL}/api/tags`);
      if (!response.ok) {
        return { valid: false, error: `Ollama returned status ${response.status}` };
      }
      return { valid: true };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      if (errorMsg.includes('ECONNREFUSED') || errorMsg.includes('fetch failed')) {
        return {
          valid: false,
          error: `Cannot connect to Ollama at ${this.baseURL}. Is Ollama running? Start with: ollama serve`,
        };
      }
      return { valid: false, error: errorMsg };
    }
  }

  /**
   * List available models from Ollama
   */
  async listModels(): Promise<string[]> {
    try {
      const response = await fetch(`${this.baseURL}/api/tags`);
      if (!response.ok) {
        return [];
      }
      const data = await response.json() as OllamaModelList;
      this.models = data.models.map(m => m.name);
      return this.models;
    } catch {
      return [];
    }
  }

  /**
   * Convert messages to Ollama format
   */
  private formatMessages(messages: Message[]): OllamaMessage[] {
    return messages.map((msg): OllamaMessage => {
      const content = typeof msg.content === 'string'
        ? msg.content
        : msg.content.map(c => c.type === 'text' ? c.text : '').join('');

      // Handle images for vision models
      const images: string[] = [];
      if (Array.isArray(msg.content)) {
        for (const part of msg.content) {
          if (part.type === 'image' && part.source.type === 'base64' && part.source.data) {
            images.push(part.source.data);
          }
        }
      }

      const ollamaMsg: OllamaMessage = {
        role: msg.role as OllamaMessage['role'],
        content,
      };

      if (images.length > 0) {
        ollamaMsg.images = images;
      }

      if (msg.tool_call_id) {
        ollamaMsg.tool_call_id = msg.tool_call_id;
      }

      return ollamaMsg;
    });
  }

  /**
   * Convert tool definition to Ollama format
   */
  private formatTool(tool: ToolDefinition): OllamaTool {
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
