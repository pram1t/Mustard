/**
 * Mock utilities for LLM testing
 */

import type {
  Message,
  StreamChunk,
  LLMProvider,
  ChatParams,
  ProviderCapabilities,
  ValidationResult,
} from '../types';

// ============================================================================
// Mock LLM Provider
// ============================================================================

interface MockResponse {
  content?: string;
  toolCalls?: Array<{ id: string; name: string; arguments: Record<string, unknown> }>;
  finishReason?: 'stop' | 'tool_calls' | 'length';
  error?: Error;
}

/**
 * Mock LLM Provider for testing
 */
export class MockLLMProvider implements LLMProvider {
  name = 'mock';
  models = ['mock-model'];
  model = 'mock-model';

  capabilities: ProviderCapabilities = {
    streaming: true,
    toolUse: true,
    vision: false,
    systemMessages: true,
    parallelToolCalls: true,
    maxContextLength: 128000,
  };

  private responses: MockResponse[] = [];
  private callHistory: Array<{ params: ChatParams }> = [];
  private validateResult: ValidationResult = { valid: true };

  /**
   * Queue a response
   */
  queueResponse(response: {
    content?: string;
    toolCalls?: Array<{ id: string; name: string; arguments: Record<string, unknown> }>;
    finishReason?: 'stop' | 'tool_calls' | 'length';
  }): void {
    this.responses.push(response);
  }

  /**
   * Queue an error
   */
  queueError(error: Error): void {
    this.responses.push({ error });
  }

  /**
   * Set validation result
   */
  setValidateResult(result: ValidationResult): void {
    this.validateResult = result;
  }

  /**
   * Get call history
   */
  getCallHistory(): Array<{ params: ChatParams }> {
    return this.callHistory;
  }

  /**
   * Clear state
   */
  reset(): void {
    this.responses = [];
    this.callHistory = [];
    this.validateResult = { valid: true };
  }

  async *chat(params: ChatParams): AsyncGenerator<StreamChunk> {
    this.callHistory.push({ params });

    const response = this.responses.shift();
    if (!response) {
      throw new Error('No mock response queued');
    }

    if (response.error) {
      throw response.error;
    }

    // Stream content
    if (response.content) {
      const words = response.content.split(' ');
      for (let i = 0; i < words.length; i++) {
        yield {
          type: 'text',
          content: words[i] + (i < words.length - 1 ? ' ' : ''),
        };
      }
    }

    // Yield tool calls
    if (response.toolCalls) {
      for (const tc of response.toolCalls) {
        yield {
          type: 'tool_call',
          tool_call: {
            id: tc.id,
            name: tc.name,
            arguments: tc.arguments,
          },
        };
      }
    }

    // Usage
    yield {
      type: 'usage',
      input_tokens: 100,
      output_tokens: 50,
    };

    // Done
    yield {
      type: 'done',
    };
  }

  async countTokens(messages: Message[]): Promise<number> {
    // Simple approximation: ~4 chars per token
    let total = 0;
    for (const msg of messages) {
      const content = typeof msg.content === 'string'
        ? msg.content
        : msg.content.map((c) => (c.type === 'text' ? c.text : '')).join('');
      total += Math.ceil(content.length / 4);
    }
    return total;
  }

  async validate(): Promise<ValidationResult> {
    return this.validateResult;
  }
}

// ============================================================================
// Mock OpenAI Responses (for testing OpenAI adapter)
// ============================================================================

export interface MockChatCompletion {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: 'assistant';
      content: string | null;
      tool_calls?: Array<{
        id: string;
        type: 'function';
        function: {
          name: string;
          arguments: string;
        };
      }>;
    };
    finish_reason: 'stop' | 'tool_calls' | 'length';
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface MockChatCompletionChunk {
  id: string;
  object: 'chat.completion.chunk';
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: {
      role?: 'assistant';
      content?: string;
      tool_calls?: Array<{
        index: number;
        id?: string;
        type?: 'function';
        function?: {
          name?: string;
          arguments?: string;
        };
      }>;
    };
    finish_reason: 'stop' | 'tool_calls' | 'length' | null;
  }>;
}

/**
 * Create a mock chat completion response
 */
export function createMockCompletion(options: {
  content?: string;
  toolCalls?: Array<{ id: string; name: string; arguments: Record<string, unknown> }>;
  finishReason?: 'stop' | 'tool_calls' | 'length';
  model?: string;
  promptTokens?: number;
  completionTokens?: number;
}): MockChatCompletion {
  return {
    id: `chatcmpl-${Date.now()}`,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: options.model || 'gpt-4',
    choices: [
      {
        index: 0,
        message: {
          role: 'assistant',
          content: options.content || null,
          tool_calls: options.toolCalls?.map((tc) => ({
            id: tc.id,
            type: 'function' as const,
            function: {
              name: tc.name,
              arguments: JSON.stringify(tc.arguments),
            },
          })),
        },
        finish_reason: options.finishReason || 'stop',
      },
    ],
    usage: {
      prompt_tokens: options.promptTokens || 100,
      completion_tokens: options.completionTokens || 50,
      total_tokens: (options.promptTokens || 100) + (options.completionTokens || 50),
    },
  };
}

/**
 * Create mock streaming chunks
 */
export function createMockChunks(options: {
  content?: string;
  toolCalls?: Array<{ id: string; name: string; arguments: Record<string, unknown> }>;
  finishReason?: 'stop' | 'tool_calls' | 'length';
  model?: string;
}): MockChatCompletionChunk[] {
  const chunks: MockChatCompletionChunk[] = [];
  const baseChunk = {
    id: `chatcmpl-${Date.now()}`,
    object: 'chat.completion.chunk' as const,
    created: Math.floor(Date.now() / 1000),
    model: options.model || 'gpt-4',
  };

  // Initial chunk with role
  chunks.push({
    ...baseChunk,
    choices: [{ index: 0, delta: { role: 'assistant' }, finish_reason: null }],
  });

  // Content chunks
  if (options.content) {
    const words = options.content.split(' ');
    for (let i = 0; i < words.length; i++) {
      chunks.push({
        ...baseChunk,
        choices: [
          {
            index: 0,
            delta: { content: words[i] + (i < words.length - 1 ? ' ' : '') },
            finish_reason: null,
          },
        ],
      });
    }
  }

  // Tool call chunks
  if (options.toolCalls) {
    for (let i = 0; i < options.toolCalls.length; i++) {
      const tc = options.toolCalls[i];
      const args = JSON.stringify(tc.arguments);

      // First chunk with tool call start
      chunks.push({
        ...baseChunk,
        choices: [
          {
            index: 0,
            delta: {
              tool_calls: [
                {
                  index: i,
                  id: tc.id,
                  type: 'function',
                  function: { name: tc.name, arguments: '' },
                },
              ],
            },
            finish_reason: null,
          },
        ],
      });

      // Arguments in parts
      const chunkSize = 20;
      for (let j = 0; j < args.length; j += chunkSize) {
        chunks.push({
          ...baseChunk,
          choices: [
            {
              index: 0,
              delta: {
                tool_calls: [
                  {
                    index: i,
                    function: { arguments: args.slice(j, j + chunkSize) },
                  },
                ],
              },
              finish_reason: null,
            },
          ],
        });
      }
    }
  }

  // Final chunk with finish reason
  chunks.push({
    ...baseChunk,
    choices: [
      {
        index: 0,
        delta: {},
        finish_reason: options.finishReason || (options.toolCalls ? 'tool_calls' : 'stop'),
      },
    ],
  });

  return chunks;
}
