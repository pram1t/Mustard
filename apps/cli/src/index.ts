#!/usr/bin/env node

/**
 * OpenAgent CLI
 *
 * Command-line interface for interacting with OpenAgent.
 * Connects the agent loop with LLM providers and tools.
 */

import {
  OpenAIProvider,
  AnthropicProvider,
  GeminiProvider,
  OllamaProvider,
  OpenAICompatibleProvider,
  createRouter,
  type LLMProvider,
} from '@openagent/llm';
import { createDefaultRegistry } from '@openagent/tools';
import { AgentLoop } from '@openagent/core';
import { createLogger, setDefaultLogger } from '@openagent/logger';
import { loadConfig, validateStartup } from '@openagent/config';

const VERSION = '0.0.0';

/**
 * Supported providers
 */
type ProviderName = 'openai' | 'anthropic' | 'gemini' | 'ollama' | 'openai-compatible';

/**
 * Parse command line arguments
 */
function parseArgs(): {
  help: boolean;
  version: boolean;
  model: string;
  provider: ProviderName;
  baseUrl: string;
  prompt: string;
  verbose: boolean;
} {
  const args = process.argv.slice(2);
  let help = false;
  let version = false;
  let model = '';
  let provider: ProviderName = 'openai';
  let baseUrl = '';
  let verbose = false;
  const promptParts: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--help' || arg === '-h') {
      help = true;
    } else if (arg === '--version' || arg === '-v') {
      version = true;
    } else if (arg === '--verbose' || arg === '-V') {
      verbose = true;
    } else if (arg === '--model' || arg === '-m') {
      model = args[++i] || model;
    } else if (arg === '--provider' || arg === '-p') {
      provider = (args[++i] || 'openai') as ProviderName;
    } else if (arg === '--base-url') {
      baseUrl = args[++i] || '';
    } else if (!arg.startsWith('-')) {
      promptParts.push(arg);
    }
  }

  return {
    help,
    version,
    model,
    provider,
    baseUrl,
    prompt: promptParts.join(' '),
    verbose,
  };
}

/**
 * Print help message
 */
function printHelp(): void {
  console.log(`
OpenAgent CLI v${VERSION}

Usage: openagent [options] <prompt>

Options:
  -h, --help        Show this help message
  -v, --version     Show version number
  -m, --model       Model to use (provider-specific defaults)
  -p, --provider    LLM provider: openai, anthropic, gemini, ollama, openai-compatible
  --base-url        Base URL for ollama or openai-compatible providers
  -V, --verbose     Enable verbose output

Providers:
  openai            OpenAI GPT models (default: gpt-4o)
  anthropic         Anthropic Claude models (default: claude-sonnet-4-20250514)
  gemini            Google Gemini models (default: gemini-1.5-pro)
  ollama            Local Ollama models (default: qwen2.5-coder:7b)
  openai-compatible Any OpenAI-compatible API (requires --base-url)

Environment Variables:
  OPENAI_API_KEY     For openai and openai-compatible providers
  ANTHROPIC_API_KEY  For anthropic provider
  GOOGLE_API_KEY     For gemini provider
  LOG_LEVEL          Logging level (trace, debug, info, warn, error)

Examples:
  openagent "Hello, who are you?"
  openagent --provider anthropic "Explain this code"
  openagent --provider gemini -m gemini-1.5-flash "Hello"
  openagent --provider ollama --model llama3.2 "Hello"
  openagent --provider openai-compatible --base-url http://localhost:1234/v1 "Hi"
`);
}

/**
 * Create LLM provider based on configuration
 */
function createProvider(
  providerName: ProviderName,
  model: string,
  baseUrl: string
): LLMProvider {
  switch (providerName) {
    case 'openai': {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        throw new Error('OPENAI_API_KEY environment variable is required for openai provider.');
      }
      return new OpenAIProvider({
        apiKey,
        model: model || 'gpt-4o',
      });
    }

    case 'anthropic': {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        throw new Error('ANTHROPIC_API_KEY environment variable is required for anthropic provider.');
      }
      return new AnthropicProvider({
        apiKey,
        model: model || 'claude-sonnet-4-20250514',
      });
    }

    case 'gemini': {
      const apiKey = process.env.GOOGLE_API_KEY;
      if (!apiKey) {
        throw new Error('GOOGLE_API_KEY environment variable is required for gemini provider.');
      }
      return new GeminiProvider({
        apiKey,
        model: model || 'gemini-1.5-pro',
      });
    }

    case 'ollama': {
      return new OllamaProvider({
        baseURL: baseUrl || 'http://localhost:11434',
        model: model || 'qwen2.5-coder:7b',
      });
    }

    case 'openai-compatible': {
      if (!baseUrl) {
        throw new Error('--base-url is required for openai-compatible provider.');
      }
      return new OpenAICompatibleProvider({
        baseURL: baseUrl,
        apiKey: process.env.OPENAI_API_KEY,
        model: model || 'gpt-3.5-turbo',
      });
    }

    default:
      throw new Error(`Unknown provider: ${providerName}. Use --help to see available providers.`);
  }
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  const args = parseArgs();

  // Handle help and version flags
  if (args.help) {
    printHelp();
    process.exit(0);
  }

  if (args.version) {
    console.log(`OpenAgent CLI v${VERSION}`);
    process.exit(0);
  }

  // Require a prompt
  if (!args.prompt) {
    console.error('Error: No prompt provided. Use --help for usage information.');
    process.exit(1);
  }

  // Initialize configuration
  const config = loadConfig();

  // Initialize logger
  const logLevel = args.verbose ? 'debug' : config.logging.level;
  const logFormat = config.logging.format || 'pretty';
  const logger = createLogger({ level: logLevel, format: logFormat });
  setDefaultLogger(logger);

  // Validate required configuration (skip provider-specific checks since we handle them)
  try {
    // Don't call validateStartup since it checks for provider API keys
    // We handle that in createProvider
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('Configuration error:', errorMsg);
    process.exit(1);
  }

  logger.debug('Starting OpenAgent CLI', {
    provider: args.provider,
    model: args.model || '(default)',
    promptLength: args.prompt.length,
  });

  try {
    // Create provider
    const provider = createProvider(args.provider, args.model, args.baseUrl);

    logger.debug('Provider created', {
      name: provider.name,
      model: provider.model,
      capabilities: provider.capabilities,
    });

    // Create router
    const router = createRouter(provider);

    // Create tool registry
    const tools = createDefaultRegistry();

    logger.debug('Tools registered', { count: tools.count, tools: tools.getNames() });

    // Create agent - system prompt is auto-generated with OS awareness by @openagent/core
    const agent = new AgentLoop(router, {
      tools,
      cwd: process.cwd(),
      // systemPrompt is automatically generated with:
      // - OS detection (Windows/macOS/Linux)
      // - Shell information (cmd.exe vs Bash)
      // - Working directory
      // - Cross-platform tool preferences
    });

    // Run the agent and stream output
    for await (const event of agent.run(args.prompt)) {
      switch (event.type) {
        case 'text':
          process.stdout.write(event.content);
          break;

        case 'thinking':
          if (args.verbose && event.iteration > 1) {
            console.log(`\n[Iteration ${event.iteration}]`);
          }
          break;

        case 'tool_call':
          console.log(`\n[Calling ${event.tool_call.name}...]`);
          if (args.verbose) {
            console.log(`  Args: ${JSON.stringify(event.tool_call.arguments)}`);
          }
          break;

        case 'tool_result':
          const status = event.result.success ? 'OK' : 'FAILED';
          if (args.verbose || !event.result.success) {
            console.log(`[${event.tool_name}: ${status}]`);
            if (!event.result.success) {
              console.log(`  ${event.result.error}`);
            }
          } else {
            console.log(`[${event.tool_name}: ${status}]`);
          }
          break;

        case 'error':
          console.error(`\nError: ${event.error}`);
          if (!event.recoverable) {
            process.exit(1);
          }
          break;

        case 'compaction':
          if (args.verbose) {
            console.log(`\n[Context compacted: ${event.messagesRemoved} messages removed]`);
          }
          break;

        case 'done':
          // Ensure output ends with newline
          console.log('');
          if (args.verbose) {
            console.log(`[Done: ${event.totalIterations} iterations, ${event.totalToolCalls} tool calls]`);
          }
          break;
      }
    }

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error('CLI error', { error: errorMsg });
    console.error(`\nError: ${errorMsg}`);
    process.exit(1);
  }
}

// Run main
main().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
