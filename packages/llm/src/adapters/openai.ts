/**
 * OpenAI Provider Adapter
 *
 * Implements the LLMProvider interface for OpenAI's API.
 * Supports GPT-4o, GPT-4, GPT-3.5-turbo and compatible models.
 */

import OpenAI from 'openai';
import { encoding_for_model, type TiktokenModel } from 'tiktoken';
import type {
  LLMProvider,
  ChatParams,
  StreamChunk,
  Message,
  ToolDefinition,
  ToolCall,
  ProviderCapabilities,
  ValidationResult,
} from '../types';

/**
 * OpenAI provider configuration
 */
export interface OpenAIConfig {
  apiKey: string;
  model?: string;
  baseURL?: string;
}

/**
 * Internal type for accumulating tool call data during streaming
 */
interface PartialToolCall {
  id: string;
  name: string;
  _argString: string;
}

/**
 * OpenAI LLM Provider
 */
export class OpenAIProvider implements LLMProvider {
  readonly name = 'openai';
  readonly models = [
    'gpt-4o',
    'gpt-4o-mini',
    'gpt-4-turbo',
    'gpt-4',
    'gpt-3.5-turbo',
    'o1',
    'o1-mini',
    'o1-preview',
  ];

  model: string;
  private client: OpenAI;

  readonly capabilities: ProviderCapabilities = {
    streaming: true,
    toolUse: true,
    vision: true,
    systemMessages: true,
    parallelToolCalls: true,
    maxContextLength: 128000, // gpt-4o default
  };

  constructor(config: OpenAIConfig) {
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
    });
    this.model = config.model || 'gpt-4o';

    // Adjust context length based on model
    if (this.model.includes('gpt-3.5')) {
      (this.capabilities as any).maxContextLength = 16385;
    } else if (this.model.includes('gpt-4-turbo') || this.model.includes('gpt-4o')) {
      (this.capabilities as any).maxContextLength = 128000;
    } else if (this.model.includes('gpt-4')) {
      (this.capabilities as any).maxContextLength = 8192;
    }
  }

  /**
   * Send messages and stream response
   */
  async *chat(params: ChatParams): AsyncGenerator<StreamChunk> {
    try {
      const stream = await this.client.chat.completions.create({
        model: this.model,
        messages: this.formatMessages(params.messages),
        tools: params.tools?.length ? params.tools.map(t => this.formatTool(t)) : undefined,
        tool_choice: this.formatToolChoice(params.tool_choice),
        temperature: params.temperature,
        max_tokens: params.max_tokens,
        stop: params.stop,
        stream: true,
        stream_options: { include_usage: true },
      });

      // Track tool calls being accumulated
      const toolCalls: Map<number, PartialToolCall> = new Map();

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta;

        // Text content
        if (delta?.content) {
          yield { type: 'text', content: delta.content };
        }

        // Tool calls - accumulate across chunks
        if (delta?.tool_calls) {
          for (const tc of delta.tool_calls) {
            const index = tc.index;

            if (!toolCalls.has(index)) {
              // New tool call starting
              toolCalls.set(index, {
                id: tc.id || '',
                name: tc.function?.name || '',
                _argString: '',
              });
            }

            const partial = toolCalls.get(index)!;

            // Update ID if provided
            if (tc.id) {
              partial.id = tc.id;
            }

            // Update function name if provided
            if (tc.function?.name) {
              partial.name = tc.function.name;
            }

            // Accumulate argument JSON string
            if (tc.function?.arguments) {
              partial._argString += tc.function.arguments;
            }
          }
        }

        // Usage info (typically at the end)
        if (chunk.usage) {
          yield {
            type: 'usage',
            input_tokens: chunk.usage.prompt_tokens,
            output_tokens: chunk.usage.completion_tokens,
          };
        }
      }

      // Emit completed tool calls
      for (const partial of toolCalls.values()) {
        if (partial.id && partial.name) {
          yield {
            type: 'tool_call',
            tool_call: this.finalizeToolCall(partial),
          };
        }
      }

      yield { type: 'done' };
    } catch (error) {
      yield { type: 'error', error: String(error) };
      yield { type: 'done' };
    }
  }

  /**
   * Count tokens in messages using tiktoken
   */
  async countTokens(messages: Message[]): Promise<number> {
    try {
      // Map model to tiktoken encoding
      let tiktokenModel: TiktokenModel = 'gpt-4o';
      if (this.model.includes('gpt-3.5')) {
        tiktokenModel = 'gpt-3.5-turbo';
      } else if (this.model.includes('gpt-4')) {
        tiktokenModel = 'gpt-4';
      }

      const enc = encoding_for_model(tiktokenModel);
      let tokenCount = 0;

      for (const message of messages) {
        // Each message has overhead tokens
        tokenCount += 4; // <|start|>role/name\n content<|end|>

        // Count content tokens
        const content = typeof message.content === 'string'
          ? message.content
          : message.content.map(c => c.type === 'text' ? c.text : '[image]').join('');

        tokenCount += enc.encode(content).length;

        // Add role token
        tokenCount += enc.encode(message.role).length;

        // Add name token if present
        if (message.name) {
          tokenCount += enc.encode(message.name).length;
          tokenCount += 1; // name separator
        }
      }

      // Add priming tokens
      tokenCount += 2;

      enc.free();
      return tokenCount;
    } catch {
      // Fallback: estimate ~4 chars per token
      const text = messages
        .map(m => typeof m.content === 'string' ? m.content : JSON.stringify(m.content))
        .join('');
      return Math.ceil(text.length / 4);
    }
  }

  /**
   * Validate API key and connectivity
   */
  async validate(): Promise<ValidationResult> {
    try {
      await this.client.models.list();
      return { valid: true };
    } catch (error) {
      return { valid: false, error: String(error) };
    }
  }

  /**
   * Convert messages to OpenAI format
   */
  private formatMessages(messages: Message[]): OpenAI.ChatCompletionMessageParam[] {
    return messages.map((msg): OpenAI.ChatCompletionMessageParam => {
      if (msg.role === 'tool') {
        return {
          role: 'tool',
          content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
          tool_call_id: msg.tool_call_id!,
        };
      }

      if (msg.role === 'system') {
        return {
          role: 'system',
          content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
        };
      }

      if (msg.role === 'assistant') {
        // Handle multi-modal content for assistant
        if (Array.isArray(msg.content)) {
          return {
            role: 'assistant',
            content: msg.content.map(part => {
              if (part.type === 'text') {
                return { type: 'text' as const, text: part.text };
              }
              return { type: 'text' as const, text: '[image]' };
            }),
          };
        }
        return {
          role: 'assistant',
          content: msg.content,
        };
      }

      // User message - can have multi-modal content
      if (Array.isArray(msg.content)) {
        const parts: OpenAI.ChatCompletionContentPart[] = msg.content.map(part => {
          if (part.type === 'text') {
            return { type: 'text' as const, text: part.text };
          } else {
            // Image content
            return {
              type: 'image_url' as const,
              image_url: {
                url: part.source.type === 'url'
                  ? part.source.url!
                  : `data:${part.source.media_type};base64,${part.source.data}`,
              },
            };
          }
        });

        return {
          role: 'user',
          content: parts,
        };
      }

      return {
        role: 'user',
        content: msg.content,
      };
    });
  }

  /**
   * Convert tool definition to OpenAI format
   */
  private formatTool(tool: ToolDefinition): OpenAI.ChatCompletionTool {
    return {
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters as OpenAI.FunctionParameters,
      },
    };
  }

  /**
   * Convert tool choice to OpenAI format
   */
  private formatToolChoice(
    choice?: 'auto' | 'none' | 'required' | { name: string }
  ): OpenAI.ChatCompletionToolChoiceOption | undefined {
    if (!choice) return undefined;
    if (typeof choice === 'string') return choice;
    return {
      type: 'function',
      function: { name: choice.name },
    };
  }

  /**
   * Finalize a partial tool call into a complete ToolCall
   */
  private finalizeToolCall(partial: PartialToolCall): ToolCall {
    let args: Record<string, unknown> = {};
    try {
      if (partial._argString) {
        args = JSON.parse(partial._argString);
      }
    } catch {
      // If JSON parsing fails, try to preserve what we can
      args = { _raw: partial._argString };
    }

    return {
      id: partial.id,
      name: partial.name,
      arguments: args,
    };
  }
}
