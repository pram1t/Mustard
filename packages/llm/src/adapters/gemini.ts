/**
 * Gemini Provider Adapter
 *
 * Implements the LLMProvider interface for Google's Gemini API.
 * Supports Gemini 1.5 Pro, Flash, and 2.0 models.
 */

import {
  GoogleGenerativeAI,
  type GenerativeModel,
  type Content,
  type Part,
  type FunctionDeclaration,
  type Tool as GeminiTool,
  type FunctionCallingMode,
} from '@google/generative-ai';
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
 * Gemini provider configuration
 */
export interface GeminiConfig {
  apiKey: string;
  model?: string;
}

/**
 * Gemini LLM Provider
 */
export class GeminiProvider implements LLMProvider {
  readonly name = 'gemini';
  readonly models = [
    'gemini-1.5-pro',
    'gemini-1.5-flash',
    'gemini-1.5-flash-8b',
    'gemini-2.0-flash-exp',
    'gemini-pro',
  ];

  model: string;
  private client: GoogleGenerativeAI;
  private generativeModel: GenerativeModel;

  readonly capabilities: ProviderCapabilities = {
    streaming: true,
    toolUse: true,
    vision: true,
    systemMessages: true,
    parallelToolCalls: true,
    maxContextLength: 1000000, // Gemini has huge context
  };

  constructor(config: GeminiConfig) {
    this.client = new GoogleGenerativeAI(config.apiKey);
    this.model = config.model || 'gemini-1.5-pro';
    this.generativeModel = this.client.getGenerativeModel({ model: this.model });

    // Adjust context length based on model
    if (this.model.includes('flash-8b')) {
      (this.capabilities as any).maxContextLength = 1000000;
    } else if (this.model.includes('flash')) {
      (this.capabilities as any).maxContextLength = 1000000;
    } else if (this.model.includes('pro')) {
      (this.capabilities as any).maxContextLength = 2000000;
    }
  }

  /**
   * Send messages and stream response
   */
  async *chat(params: ChatParams): AsyncGenerator<StreamChunk> {
    try {
      // Extract system message
      const { systemInstruction, contents } = this.formatMessages(params.messages);

      // Build tools if provided
      const tools: GeminiTool[] | undefined = params.tools?.length
        ? [{ functionDeclarations: params.tools.map(t => this.formatTool(t)) }]
        : undefined;

      // Create a new model instance with system instruction if provided
      const modelConfig: { model: string; systemInstruction?: string; tools?: GeminiTool[] } = {
        model: this.model,
      };

      if (systemInstruction) {
        modelConfig.systemInstruction = systemInstruction;
      }

      if (tools) {
        modelConfig.tools = tools;
      }

      const model = this.client.getGenerativeModel(modelConfig);

      // Start chat with history
      const chat = model.startChat({
        history: contents.slice(0, -1), // All messages except the last one
      });

      // Get the last user message
      const lastContent = contents[contents.length - 1];
      if (!lastContent) {
        yield { type: 'error', error: 'No messages to send' };
        yield { type: 'done' };
        return;
      }

      // Stream the response
      const result = await chat.sendMessageStream(lastContent.parts);

      let inputTokens = 0;
      let outputTokens = 0;
      const toolCalls: ToolCall[] = [];

      for await (const chunk of result.stream) {
        const text = chunk.text();
        if (text) {
          yield { type: 'text', content: text };
        }

        // Check for function calls
        const candidates = chunk.candidates;
        if (candidates) {
          for (const candidate of candidates) {
            if (candidate.content?.parts) {
              for (const part of candidate.content.parts) {
                if ('functionCall' in part && part.functionCall) {
                  const fc = part.functionCall;
                  toolCalls.push({
                    id: `call_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
                    name: fc.name,
                    arguments: fc.args as Record<string, unknown>,
                  });
                }
              }
            }
          }
        }

        // Get usage metadata if available
        if (chunk.usageMetadata) {
          inputTokens = chunk.usageMetadata.promptTokenCount || 0;
          outputTokens = chunk.usageMetadata.candidatesTokenCount || 0;
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
      yield { type: 'error', error: String(error) };
      yield { type: 'done' };
    }
  }

  /**
   * Count tokens in messages using Gemini's count tokens API
   */
  async countTokens(messages: Message[]): Promise<number> {
    try {
      const { contents } = this.formatMessages(messages);
      const result = await this.generativeModel.countTokens({ contents });
      return result.totalTokens;
    } catch {
      // Fallback: estimate ~4 characters per token
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
      // Make a minimal request to validate
      await this.generativeModel.countTokens({ contents: [{ role: 'user', parts: [{ text: 'Hi' }] }] });
      return { valid: true };
    } catch (error) {
      return { valid: false, error: String(error) };
    }
  }

  /**
   * Convert messages to Gemini format
   */
  private formatMessages(messages: Message[]): {
    systemInstruction: string | undefined;
    contents: Content[];
  } {
    let systemInstruction: string | undefined;
    const contents: Content[] = [];

    for (const msg of messages) {
      if (msg.role === 'system') {
        // Extract system message
        systemInstruction = typeof msg.content === 'string'
          ? msg.content
          : msg.content.map(c => c.type === 'text' ? c.text : '').join('');
        continue;
      }

      // Gemini uses 'model' instead of 'assistant'
      const role = msg.role === 'assistant' ? 'model' : 'user';

      // Handle tool results - they go as function responses
      if (msg.role === 'tool') {
        contents.push({
          role: 'function',
          parts: [{
            functionResponse: {
              name: msg.name || 'unknown',
              response: {
                result: typeof msg.content === 'string' ? msg.content : msg.content,
              },
            },
          }],
        });
        continue;
      }

      contents.push({
        role,
        parts: this.formatParts(msg),
      });
    }

    return { systemInstruction, contents };
  }

  /**
   * Format message content as Gemini parts
   */
  private formatParts(msg: Message): Part[] {
    if (typeof msg.content === 'string') {
      return [{ text: msg.content }];
    }

    return msg.content.map((part): Part => {
      if (part.type === 'text') {
        return { text: part.text };
      } else {
        // Image content
        if (part.source.type === 'base64') {
          return {
            inlineData: {
              mimeType: part.source.media_type || 'image/png',
              data: part.source.data!,
            },
          };
        } else {
          // URL-based images - Gemini supports file URIs
          return {
            fileData: {
              mimeType: part.source.media_type || 'image/png',
              fileUri: part.source.url!,
            },
          };
        }
      }
    });
  }

  /**
   * Convert tool definition to Gemini function declaration format
   */
  private formatTool(tool: ToolDefinition): FunctionDeclaration {
    return {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters as FunctionDeclaration['parameters'],
    };
  }
}
