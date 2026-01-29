#!/usr/bin/env node

/**
 * OpenAgent CLI
 *
 * Command-line interface for interacting with OpenAgent.
 * Connects the agent loop with LLM providers and tools.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as readline from 'readline';
import {
  OpenAIProvider,
  AnthropicProvider,
  GeminiProvider,
  OllamaProvider,
  OpenAICompatibleProvider,
  createRouter,
  type LLMProvider,
} from '@openagent/llm';
import { createDefaultRegistry, type ToolRegistry } from '@openagent/tools';
import {
  AgentLoop,
  PermissionManager,
  type PermissionMode,
  type ApprovalCallback,
} from '@openagent/core';
import { createLogger, setDefaultLogger } from '@openagent/logger';
import { loadConfig, validateStartup, type HooksConfig } from '@openagent/config';
import { createHookExecutor, type HookExecutor } from '@openagent/hooks';
import {
  MCPRegistry,
  createRegistry,
  type ServerConfig,
  type StdioServerConfig,
  type HttpServerConfig,
  type AggregatedTool,
  type CallToolResult,
  type ContentItem,
} from '@openagent/mcp';
import type { Tool, ToolParameters, ToolResult, ExecutionContext } from '@openagent/tools';

const VERSION = '0.0.0';

/**
 * MCP config file location
 */
const MCP_CONFIG_DIR = path.join(os.homedir(), '.openagent');
const MCP_CONFIG_FILE = path.join(MCP_CONFIG_DIR, 'mcp.json');

/**
 * MCP configuration format
 */
interface MCPConfig {
  servers: Record<string, ServerConfig>;
}

/**
 * Load MCP configuration from file
 */
function loadMCPConfig(): MCPConfig {
  try {
    if (fs.existsSync(MCP_CONFIG_FILE)) {
      const content = fs.readFileSync(MCP_CONFIG_FILE, 'utf-8');
      return JSON.parse(content) as MCPConfig;
    }
  } catch {
    // Ignore errors, return empty config
  }
  return { servers: {} };
}

/**
 * Save MCP configuration to file
 */
function saveMCPConfig(config: MCPConfig): void {
  if (!fs.existsSync(MCP_CONFIG_DIR)) {
    fs.mkdirSync(MCP_CONFIG_DIR, { recursive: true });
  }
  fs.writeFileSync(MCP_CONFIG_FILE, JSON.stringify(config, null, 2));
}

/**
 * Supported providers
 */
type ProviderName = 'openai' | 'anthropic' | 'gemini' | 'ollama' | 'openai-compatible';

/**
 * MCP subcommand arguments
 */
interface MCPSubcommand {
  action: 'add' | 'remove' | 'list';
  name?: string;
  type?: 'stdio' | 'http';
  command?: string;
  url?: string;
  args?: string[];
  env?: Record<string, string>;
}

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
  mcpSubcommand?: MCPSubcommand;
  permissionMode: PermissionMode;
  allowTools: string[];
  denyTools: string[];
} {
  const args = process.argv.slice(2);
  let help = false;
  let version = false;
  let model = '';
  let provider: ProviderName = 'openai';
  let baseUrl = '';
  let verbose = false;
  const promptParts: string[] = [];
  let mcpSubcommand: MCPSubcommand | undefined;
  let permissionMode: PermissionMode = 'default';
  const allowTools: string[] = [];
  const denyTools: string[] = [];

  // Check for MCP subcommand
  if (args[0] === 'mcp') {
    const mcpAction = args[1];
    if (mcpAction === 'list') {
      mcpSubcommand = { action: 'list' };
    } else if (mcpAction === 'add' && args[2]) {
      const name = args[2];
      let type: 'stdio' | 'http' = 'stdio';
      let command = '';
      let url = '';
      const serverArgs: string[] = [];
      const env: Record<string, string> = {};

      for (let i = 3; i < args.length; i++) {
        if (args[i] === '--type' || args[i] === '-t') {
          type = args[++i] as 'stdio' | 'http';
        } else if (args[i] === '--command' || args[i] === '-c') {
          command = args[++i] || '';
        } else if (args[i] === '--url' || args[i] === '-u') {
          url = args[++i] || '';
        } else if (args[i] === '--arg') {
          serverArgs.push(args[++i] || '');
        } else if (args[i] === '--env') {
          const envPair = args[++i] || '';
          const [key, value] = envPair.split('=');
          if (key && value) {
            env[key] = value;
          }
        }
      }

      mcpSubcommand = { action: 'add', name, type, command, url, args: serverArgs, env };
    } else if (mcpAction === 'remove' && args[2]) {
      mcpSubcommand = { action: 'remove', name: args[2] };
    } else {
      // Show MCP help
      help = true;
    }

    return { help, version, model, provider, baseUrl, prompt: '', verbose, mcpSubcommand, permissionMode, allowTools, denyTools };
  }

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
    } else if (arg === '--permission-mode' || arg === '-P') {
      const mode = args[++i] || 'default';
      if (['permissive', 'default', 'strict'].includes(mode)) {
        permissionMode = mode as PermissionMode;
      }
    } else if (arg === '--allow-tool') {
      const tool = args[++i];
      if (tool) allowTools.push(tool);
    } else if (arg === '--deny-tool') {
      const tool = args[++i];
      if (tool) denyTools.push(tool);
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
    mcpSubcommand,
    permissionMode,
    allowTools,
    denyTools,
  };
}

/**
 * Print help message
 */
function printHelp(): void {
  console.log(`
OpenAgent CLI v${VERSION}

Usage: openagent [options] <prompt>
       openagent mcp <subcommand> [options]

Options:
  -h, --help                    Show this help message
  -v, --version                 Show version number
  -m, --model                   Model to use (provider-specific defaults)
  -p, --provider                LLM provider: openai, anthropic, gemini, ollama, openai-compatible
  --base-url                    Base URL for ollama or openai-compatible providers
  -V, --verbose                 Enable verbose output
  -P, --permission-mode <mode>  Permission mode: permissive, default, strict
  --allow-tool <name>           Always allow a tool (repeatable)
  --deny-tool <name>            Always deny a tool (repeatable)

Providers:
  openai            OpenAI GPT models (default: gpt-4o)
  anthropic         Anthropic Claude models (default: claude-sonnet-4-20250514)
  gemini            Google Gemini models (default: gemini-1.5-pro)
  ollama            Local Ollama models (default: qwen2.5-coder:7b)
  openai-compatible Any OpenAI-compatible API (requires --base-url)

Permission Modes:
  permissive        Allow everything not explicitly denied
  default           Allow safe tools (Read, Glob, Grep), ask for others
  strict            Ask for everything not explicitly allowed

MCP Subcommands:
  mcp list                              List configured MCP servers
  mcp add <name> [options]              Add an MCP server
    --type, -t <stdio|http>             Server type (default: stdio)
    --command, -c <command>             Command for stdio servers
    --url, -u <url>                     URL for http servers
    --arg <value>                       Additional argument (can repeat)
    --env <KEY=VALUE>                   Environment variable (can repeat)
  mcp remove <name>                     Remove an MCP server

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
  openagent --permission-mode strict "read package.json"
  openagent --allow-tool Write --allow-tool Edit "Create a new file"

MCP Examples:
  openagent mcp add filesystem --type stdio --command "npx @modelcontextprotocol/server-filesystem"
  openagent mcp add api-server --type http --url http://localhost:3000
  openagent mcp list
  openagent mcp remove filesystem
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
 * Handle MCP subcommands
 */
async function handleMCPSubcommand(subcommand: MCPSubcommand): Promise<void> {
  const mcpConfig = loadMCPConfig();

  switch (subcommand.action) {
    case 'list': {
      const servers = Object.entries(mcpConfig.servers);
      if (servers.length === 0) {
        console.log('No MCP servers configured.');
        console.log('Use "openagent mcp add <name> ..." to add a server.');
      } else {
        console.log('Configured MCP servers:\n');
        for (const [name, config] of servers) {
          if (config.type === 'stdio') {
            const stdioConfig = config as StdioServerConfig;
            console.log(`  ${name} (stdio)`);
            console.log(`    Command: ${stdioConfig.command}`);
            if (stdioConfig.args?.length) {
              console.log(`    Args: ${stdioConfig.args.join(' ')}`);
            }
            if (stdioConfig.env && Object.keys(stdioConfig.env).length) {
              console.log(`    Env: ${Object.keys(stdioConfig.env).join(', ')}`);
            }
          } else {
            const httpConfig = config as HttpServerConfig;
            console.log(`  ${name} (http)`);
            console.log(`    URL: ${httpConfig.url}`);
          }
          console.log('');
        }
      }
      break;
    }

    case 'add': {
      if (!subcommand.name) {
        console.error('Error: Server name is required.');
        process.exit(1);
      }

      if (mcpConfig.servers[subcommand.name]) {
        console.error(`Error: Server '${subcommand.name}' already exists. Remove it first.`);
        process.exit(1);
      }

      let config: ServerConfig;
      if (subcommand.type === 'http') {
        if (!subcommand.url) {
          console.error('Error: --url is required for http servers.');
          process.exit(1);
        }
        config = {
          type: 'http',
          url: subcommand.url,
        } as HttpServerConfig;
      } else {
        if (!subcommand.command) {
          console.error('Error: --command is required for stdio servers.');
          process.exit(1);
        }
        config = {
          type: 'stdio',
          command: subcommand.command,
          args: subcommand.args?.length ? subcommand.args : undefined,
          env: subcommand.env && Object.keys(subcommand.env).length ? subcommand.env : undefined,
        } as StdioServerConfig;
      }

      mcpConfig.servers[subcommand.name] = config;
      saveMCPConfig(mcpConfig);
      console.log(`Added MCP server '${subcommand.name}'.`);
      break;
    }

    case 'remove': {
      if (!subcommand.name) {
        console.error('Error: Server name is required.');
        process.exit(1);
      }

      if (!mcpConfig.servers[subcommand.name]) {
        console.error(`Error: Server '${subcommand.name}' not found.`);
        process.exit(1);
      }

      delete mcpConfig.servers[subcommand.name];
      saveMCPConfig(mcpConfig);
      console.log(`Removed MCP server '${subcommand.name}'.`);
      break;
    }
  }
}

/**
 * Wrapper class for MCP tools to work with ToolRegistry
 */
class MCPToolWrapper implements Tool {
  readonly name: string;
  readonly description: string;
  readonly parameters: ToolParameters;

  constructor(
    private mcpTool: AggregatedTool,
    private registry: MCPRegistry
  ) {
    this.name = mcpTool.name;
    this.description = mcpTool.description;
    this.parameters = mcpTool.parameters as ToolParameters;
  }

  async execute(params: Record<string, unknown>, _context: ExecutionContext): Promise<ToolResult> {
    try {
      const result: CallToolResult = await this.registry.callTool(this.name, params);

      // Convert MCP content to string output
      const output = result.content
        .map((item: ContentItem) => {
          if (item.type === 'text') {
            return item.text;
          } else if (item.type === 'image') {
            return `[Image: ${item.mimeType}]`;
          } else if (item.type === 'resource') {
            return item.resource.text || `[Resource: ${item.resource.uri}]`;
          }
          return '';
        })
        .join('\n');

      return {
        success: !result.isError,
        output,
        error: result.isError ? output : undefined,
      };
    } catch (error) {
      return {
        success: false,
        output: '',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

/**
 * Create MCP registry and connect to servers
 */
async function createMCPRegistry(verbose: boolean): Promise<MCPRegistry | null> {
  const mcpConfig = loadMCPConfig();

  if (Object.keys(mcpConfig.servers).length === 0) {
    return null;
  }

  const registry = createRegistry(mcpConfig.servers);

  if (verbose) {
    console.log(`[MCP] Connecting to ${Object.keys(mcpConfig.servers).length} server(s)...`);
  }

  await registry.connectAll();

  const tools = registry.getAllTools();
  if (verbose && tools.length > 0) {
    console.log(`[MCP] Loaded ${tools.length} tool(s) from MCP servers`);
  }

  return registry;
}

/**
 * Get wrapped MCP tools as Tool instances
 */
function getMCPTools(registry: MCPRegistry): Tool[] {
  return registry.getAllTools().map((tool) => new MCPToolWrapper(tool, registry));
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

  // Handle MCP subcommands
  if (args.mcpSubcommand) {
    await handleMCPSubcommand(args.mcpSubcommand);
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

    logger.debug('Built-in tools registered', { count: tools.count, tools: tools.getNames() });

    // Load MCP tools
    let mcpRegistry: MCPRegistry | null = null;
    try {
      mcpRegistry = await createMCPRegistry(args.verbose);
      if (mcpRegistry) {
        const mcpTools = getMCPTools(mcpRegistry);
        tools.registerAll(mcpTools);
        logger.debug('MCP tools registered', {
          count: mcpTools.length,
          tools: mcpTools.map((t) => t.name),
        });
      }
    } catch (error) {
      logger.warn('Failed to load MCP tools', {
        error: error instanceof Error ? error.message : String(error),
      });
      if (args.verbose) {
        console.warn(`[MCP] Warning: Failed to load MCP tools: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    // Create hook executor if hooks are configured
    let hookExecutor: HookExecutor | undefined;
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    if (config.hooks && Object.values(config.hooks).some(arr => arr && arr.length > 0)) {
      hookExecutor = createHookExecutor(config.hooks, {
        sessionId,
        cwd: process.cwd(),
      });

      const hookCount = Object.values(config.hooks).reduce((sum, arr) => sum + (arr?.length || 0), 0);
      logger.debug('Hooks loaded', { count: hookCount });
      if (args.verbose) {
        console.log(`[Hooks] Loaded ${hookCount} hook(s)`);
      }
    }

    // Create permission manager
    const permissions = new PermissionManager({
      mode: args.permissionMode,
    });

    // Add custom allow rules
    for (const tool of args.allowTools) {
      permissions.addAllowRule({ tool, reason: `Allowed via --allow-tool ${tool}` });
    }

    // Add custom deny rules
    for (const tool of args.denyTools) {
      permissions.addDenyRule({ tool, reason: `Denied via --deny-tool ${tool}` });
    }

    // Set up approval callback for interactive prompts
    const approvalCallback: ApprovalCallback = async (tool, params, reason) => {
      return new Promise((resolve) => {
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout,
        });

        console.log(`\n[Permission Required]`);
        console.log(`  Tool: ${tool}`);
        console.log(`  Reason: ${reason}`);
        if (args.verbose) {
          console.log(`  Params: ${JSON.stringify(params).slice(0, 200)}`);
        }

        rl.question('  Allow? (y/N): ', (answer) => {
          rl.close();
          resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
        });
      });
    };

    permissions.setApprovalCallback(approvalCallback);

    logger.debug('Permission manager created', {
      mode: args.permissionMode,
      allowTools: args.allowTools,
      denyTools: args.denyTools,
    });

    if (args.verbose) {
      console.log(`[Permissions] Mode: ${args.permissionMode}`);
      if (args.allowTools.length) {
        console.log(`[Permissions] Allowed: ${args.allowTools.join(', ')}`);
      }
      if (args.denyTools.length) {
        console.log(`[Permissions] Denied: ${args.denyTools.join(', ')}`);
      }
    }

    // Create agent - system prompt is auto-generated with OS awareness by @openagent/core
    const agent = new AgentLoop(router, {
      tools,
      cwd: process.cwd(),
      sessionId,
      hooks: hookExecutor,
      permissions,
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

        case 'hook_triggered':
          if (args.verbose) {
            console.log(`\n[Hook: ${event.event} (${event.hookCount} hook(s))]`);
          }
          break;

        case 'hook_blocked':
          console.log(`\n[Hook blocked: ${event.event}]`);
          if (event.reason) {
            console.log(`  Reason: ${event.reason}`);
          }
          break;

        case 'hook_output':
          if (args.verbose && event.output) {
            console.log(`[Hook output: ${event.output}]`);
          }
          break;

        case 'permission_denied':
          console.log(`\n[Permission Denied] ${event.tool}: ${event.reason}`);
          break;

        case 'permission_ask':
          if (args.verbose) {
            const status = event.approved ? 'Approved' : 'Denied';
            console.log(`[Permission ${status}] ${event.tool}: ${event.reason}`);
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

    // Cleanup MCP connections
    if (mcpRegistry) {
      await mcpRegistry.disconnectAll();
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
