/**
 * Anthropic Provider Adapter
 *
 * Implements the LLMProvider interface for Anthropic's Claude API.
 * Supports Claude 4 (Sonnet, Opus) and Claude 3.5 models.
 */

import Anthropic from '@anthropic-ai/sdk';
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
 * Anthropic provider configuration
 */
export interface AnthropicConfig {
  apiKey: string;
  model?: string;
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
 * Anthropic LLM Provider
 */
export class AnthropicProvider implements LLMProvider {
  readonly name = 'anthropic';
  readonly models = [
    'claude-sonnet-4-20250514',
    'claude-opus-4-20250514',
    'claude-3-5-sonnet-20241022',
    'claude-3-5-haiku-20241022',
    'claude-3-opus-20240229',
    'claude-3-sonnet-20240229',
    'claude-3-haiku-20240307',
  ];

  model: string;
  private client: Anthropic;

  readonly capabilities: ProviderCapabilities = {
    streaming: true,
    toolUse: true,
    vision: true,
    systemMessages: true,
    parallelToolCalls: true,
    maxContextLength: 200000,
  };

  constructor(config: AnthropicConfig) {
    this.client = new Anthropic({
      apiKey: config.apiKey,
    });
    this.model = config.model || 'claude-sonnet-4-20250514';

    // Adjust context length based on model
    if (this.model.includes('haiku')) {
      (this.capabilities as any).maxContextLength = 200000;
    } else if (this.model.includes('opus') || this.model.includes('sonnet')) {
      (this.capabilities as any).maxContextLength = 200000;
    }
  }

  /**
   * Send messages and stream response
   */
  async *chat(params: ChatParams): AsyncGenerator<StreamChunk> {
    try {
      // Extract system message from messages array
      const { systemMessage, otherMessages } = this.extractSystemMessage(params.messages);

      const stream = await this.client.messages.stream({
        model: this.model,
        max_tokens: params.max_tokens || 4096,
        system: systemMessage,
        messages: this.formatMessages(otherMessages),
        tools: params.tools?.length ? params.tools.map(t => this.formatTool(t)) : undefined,
        temperature: params.temperature,
        stop_sequences: params.stop,
      });

      // Track tool calls being accumulated
      const toolCalls: Map<number, PartialToolCall> = new Map();
      let currentBlockIndex = 0;
      let currentBlockType: 'text' | 'tool_use' | null = null;

      for await (const event of stream) {
        if (event.type === 'content_block_start') {
          currentBlockIndex = event.index;
          if (event.content_block.type === 'tool_use') {
            currentBlockType = 'tool_use';
            toolCalls.set(currentBlockIndex, {
              id: event.content_block.id,
              name: event.content_block.name,
              _argString: '',
            });
          } else {
            currentBlockType = 'text';
          }
        }

        if (event.type === 'content_block_delta') {
          if (event.delta.type === 'text_delta') {
            yield { type: 'text', content: event.delta.text };
          } else if (event.delta.type === 'input_json_delta') {
            // Accumulate tool call arguments
            const partial = toolCalls.get(currentBlockIndex);
            if (partial) {
              partial._argString += event.delta.partial_json;
            }
          }
        }

        if (event.type === 'message_delta') {
          // Usage info at the end
          if (event.usage) {
            yield {
              type: 'usage',
              input_tokens: 0, // Anthropic provides output_tokens in message_delta
              output_tokens: event.usage.output_tokens,
            };
          }
        }

        if (event.type === 'message_start' && event.message.usage) {
          // Input tokens at start
          yield {
            type: 'usage',
            input_tokens: event.message.usage.input_tokens,
            output_tokens: 0,
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
   * Count tokens in messages
   * Anthropic doesn't have a public tokenizer, so we estimate
   */
  async countTokens(messages: Message[]): Promise<number> {
    // Anthropic uses roughly ~4 characters per token for English
    // This is an approximation
    let totalChars = 0;

    for (const message of messages) {
      const content = typeof message.content === 'string'
        ? message.content
        : message.content.map(c => c.type === 'text' ? c.text : '[image]').join('');

      totalChars += content.length;
      totalChars += message.role.length;
      if (message.name) {
        totalChars += message.name.length;
      }
    }

    // Add overhead for message formatting
    totalChars += messages.length * 10;

    return Math.ceil(totalChars / 4);
  }

  /**
   * Validate API key and connectivity
   */
  async validate(): Promise<ValidationResult> {
    try {
      // Make a minimal request to validate the API key
      await this.client.messages.create({
        model: this.model,
        max_tokens: 1,
        messages: [{ role: 'user', content: 'Hi' }],
      });
      return { valid: true };
    } catch (error) {
      return { valid: false, error: String(error) };
    }
  }

  /**
   * Extract system message from messages array
   * Anthropic requires system message as separate parameter
   */
  private extractSystemMessage(messages: Message[]): {
    systemMessage: string | undefined;
    otherMessages: Message[];
  } {
    const systemMsg = messages.find(m => m.role === 'system');
    const otherMessages = messages.filter(m => m.role !== 'system');

    return {
      systemMessage: systemMsg
        ? (typeof systemMsg.content === 'string'
          ? systemMsg.content
          : systemMsg.content.map(c => c.type === 'text' ? c.text : '').join(''))
        : undefined,
      otherMessages,
    };
  }

  /**
   * Convert messages to Anthropic format
   */
  private formatMessages(messages: Message[]): Anthropic.MessageParam[] {
    const result: Anthropic.MessageParam[] = [];

    for (const msg of messages) {
      if (msg.role === 'user') {
        result.push({
          role: 'user',
          content: this.formatContent(msg),
        });
      } else if (msg.role === 'assistant') {
        // Check if assistant message has tool_calls
        if (msg.tool_calls && msg.tool_calls.length > 0) {
          // Build content array with text (if any) and tool_use blocks
          const contentBlocks: Anthropic.ContentBlockParam[] = [];

          // Add text content if present
          const textContent = typeof msg.content === 'string' ? msg.content :
            (Array.isArray(msg.content) ? msg.content.filter(c => c.type === 'text').map(c => (c as any).text).join('') : '');
          if (textContent) {
            contentBlocks.push({ type: 'text', text: textContent });
          }

          // Add tool_use blocks for each tool call
          for (const tc of msg.tool_calls) {
            contentBlocks.push({
              type: 'tool_use',
              id: tc.id,
              name: tc.name,
              input: tc.arguments,
            });
          }

          result.push({
            role: 'assistant',
            content: contentBlocks,
          });
        } else {
          result.push({
            role: 'assistant',
            content: this.formatContent(msg),
          });
        }
      } else if (msg.role === 'tool') {
        // Tool results in Anthropic are sent as user messages with tool_result content
        result.push({
          role: 'user',
          content: [{
            type: 'tool_result',
            tool_use_id: msg.tool_call_id!,
            content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
          }],
        });
      }
    }

    return result;
  }

  /**
   * Format message content for Anthropic
   */
  private formatContent(msg: Message): string | Anthropic.ContentBlockParam[] {
    if (typeof msg.content === 'string') {
      return msg.content;
    }

    // Multi-modal content
    return msg.content.map((part): Anthropic.ContentBlockParam => {
      if (part.type === 'text') {
        return { type: 'text', text: part.text };
      } else {
        // Image content
        if (part.source.type === 'base64') {
          return {
            type: 'image',
            source: {
              type: 'base64',
              media_type: (part.source.media_type || 'image/png') as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
              data: part.source.data!,
            },
          };
        } else {
          return {
            type: 'image',
            source: {
              type: 'url',
              url: part.source.url!,
            },
          };
        }
      }
    });
  }

  /**
   * Convert tool definition to Anthropic format
   */
  private formatTool(tool: ToolDefinition): Anthropic.Tool {
    return {
      name: tool.name,
      description: tool.description,
      input_schema: tool.parameters as Anthropic.Tool.InputSchema,
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
