/**
 * LLM Adapter Template
 *
 * Use this template to create a new LLM provider adapter.
 * Copy this file and implement all methods.
 */

import type {
  LLMProvider,
  ProviderCapabilities,
  ChatParams,
  StreamChunk,
  Message,
  ToolDefinition,
  ToolCall,
  ValidationResult,
} from '../specs/llm-provider-interface';

/**
 * Configuration for your provider
 */
interface MyProviderConfig {
  apiKey: string;
  model?: string;
  baseURL?: string;
  // Add any provider-specific options
}

/**
 * Your LLM Provider Implementation
 *
 * Replace "MyProvider" with your provider name (e.g., "TogetherAI", "Groq", etc.)
 */
export class MyProvider implements LLMProvider {
  readonly name = 'my-provider'; // Change to your provider name

  readonly models = [
    'model-1',
    'model-2',
    // List available models
  ];

  model: string;

  readonly capabilities: ProviderCapabilities = {
    streaming: true,
    toolUse: true,        // Set to false if provider doesn't support tools
    vision: false,        // Set to true if provider supports images
    systemMessages: true,
    parallelToolCalls: false,
    maxContextLength: 8192, // Adjust for your provider
  };

  // Provider-specific client/configuration
  private apiKey: string;
  private baseURL: string;

  constructor(config: MyProviderConfig) {
    this.apiKey = config.apiKey;
    this.model = config.model || this.models[0];
    this.baseURL = config.baseURL || 'https://api.my-provider.com';
  }

  /**
   * Main chat method - implement streaming response
   */
  async *chat(params: ChatParams): AsyncGenerator<StreamChunk> {
    // 1. Format messages for your provider's API
    const formattedMessages = this.formatMessages(params.messages);

    // 2. Format tools if supported
    const formattedTools = this.capabilities.toolUse && params.tools
      ? params.tools.map(t => this.formatTool(t))
      : undefined;

    // 3. Make API request
    const response = await fetch(`${this.baseURL}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
        // Add any provider-specific headers
      },
      body: JSON.stringify({
        model: this.model,
        messages: formattedMessages,
        tools: formattedTools,
        stream: true,
        // Add other parameters
        temperature: params.temperature,
        max_tokens: params.max_tokens,
        stop: params.stop,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API error: ${response.status} - ${error}`);
    }

    // 4. Stream and parse response
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    // Track accumulated tool calls (if streaming tool calls)
    const toolCallAccumulator: Map<string, { name: string; arguments: string }> = new Map();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        // Skip empty lines or comments
        if (!line.trim() || line.startsWith(':')) continue;

        // Handle SSE format
        if (line.startsWith('data: ')) {
          const data = line.slice(6);

          // Handle end of stream
          if (data === '[DONE]') {
            break;
          }

          try {
            const parsed = JSON.parse(data);

            // Extract delta from response (adjust for your provider's format)
            const delta = parsed.choices?.[0]?.delta;

            // Yield text content
            if (delta?.content) {
              yield { type: 'text', content: delta.content };
            }

            // Handle tool calls (adjust for your provider's format)
            if (delta?.tool_calls) {
              for (const tc of delta.tool_calls) {
                // Accumulate tool call data
                if (tc.id) {
                  toolCallAccumulator.set(tc.id, {
                    name: tc.function?.name || '',
                    arguments: tc.function?.arguments || '',
                  });
                } else if (tc.index !== undefined) {
                  // Some providers use index-based streaming
                  const key = `index_${tc.index}`;
                  const existing = toolCallAccumulator.get(key) || { name: '', arguments: '' };
                  if (tc.function?.name) existing.name = tc.function.name;
                  if (tc.function?.arguments) existing.arguments += tc.function.arguments;
                  toolCallAccumulator.set(key, existing);
                }
              }
            }

            // Handle usage information
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
    }

    // Yield accumulated tool calls
    for (const [id, tc] of toolCallAccumulator) {
      if (tc.name) {
        try {
          yield {
            type: 'tool_call',
            tool_call: {
              id,
              name: tc.name,
              arguments: tc.arguments ? JSON.parse(tc.arguments) : {},
            },
          };
        } catch {
          // Skip tool calls with invalid JSON arguments
        }
      }
    }

    yield { type: 'done' };
  }

  /**
   * Count tokens in messages
   */
  async countTokens(messages: Message[]): Promise<number> {
    // Option 1: Use provider's token counting API if available
    // Option 2: Use tiktoken for OpenAI-compatible tokenization
    // Option 3: Estimate (4 chars ≈ 1 token)

    const text = messages
      .map(m => typeof m.content === 'string' ? m.content : JSON.stringify(m.content))
      .join('');

    return Math.ceil(text.length / 4);
  }

  /**
   * Validate provider configuration
   */
  async validate(): Promise<ValidationResult> {
    try {
      // Try a simple API call to verify credentials
      const response = await fetch(`${this.baseURL}/v1/models`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
      });

      if (!response.ok) {
        return {
          valid: false,
          error: `API returned ${response.status}: ${await response.text()}`,
        };
      }

      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        error: `Connection failed: ${error}`,
      };
    }
  }

  // ==========================================================================
  // HELPER METHODS - Customize for your provider
  // ==========================================================================

  /**
   * Format messages for your provider's API
   */
  private formatMessages(messages: Message[]): any[] {
    return messages.map(msg => {
      // Handle tool messages specially if needed
      if (msg.role === 'tool') {
        return {
          role: 'tool',
          tool_call_id: msg.tool_call_id,
          content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
        };
      }

      // Standard message format
      return {
        role: msg.role,
        content: msg.content,
        // Add name if present
        ...(msg.name && { name: msg.name }),
      };
    });
  }

  /**
   * Format tool definition for your provider's API
   */
  private formatTool(tool: ToolDefinition): any {
    // OpenAI-style format (most common)
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

// =============================================================================
// USAGE EXAMPLE
// =============================================================================

/*
import { MyProvider } from './my-provider';

const provider = new MyProvider({
  apiKey: process.env.MY_PROVIDER_API_KEY!,
  model: 'model-1',
});

// Validate configuration
const validation = await provider.validate();
if (!validation.valid) {
  console.error('Invalid configuration:', validation.error);
  process.exit(1);
}

// Chat with streaming
for await (const chunk of provider.chat({
  messages: [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'Hello!' },
  ],
})) {
  if (chunk.type === 'text') {
    process.stdout.write(chunk.content);
  } else if (chunk.type === 'tool_call') {
    console.log('Tool call:', chunk.tool_call);
  } else if (chunk.type === 'done') {
    console.log('\nDone!');
  }
}
*/
