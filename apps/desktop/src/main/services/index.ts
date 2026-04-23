/**
 * Service Layer — Initialization & Singleton Access
 *
 * Creates LLMRouter, ToolRegistry, MCPRegistry, CredentialService, and the three services.
 * Must be called before IPC handlers are registered.
 */

import { AgentService } from './agent';
import { ConfigService, ENV_KEY_MAP } from './config';
import { MCPService } from './mcp';
import { CredentialService } from './credentials';
import { UpdateService } from './updater';
import { getConfig } from '@openagent/config';
import {
  LLMRouter,
  OpenAIProvider,
  AnthropicProvider,
  GeminiProvider,
  OllamaProvider,
} from '@openagent/llm';
import { MCPRegistry } from '@openagent/mcp';
import { createDefaultRegistry } from '@openagent/tools';

// ── Singleton instances ──────────────────────────────────────────────────────

let agentService: AgentService | null = null;
let configService: ConfigService | null = null;
let mcpService: MCPService | null = null;
let credentialService: CredentialService | null = null;
let updateService: UpdateService | null = null;

// ── Getter functions (throw if not initialized) ──────────────────────────────

export function getAgentService(): AgentService {
  if (!agentService) throw new Error('AgentService not initialized');
  return agentService;
}

export function getConfigService(): ConfigService {
  if (!configService) throw new Error('ConfigService not initialized');
  return configService;
}

export function getMCPService(): MCPService {
  if (!mcpService) throw new Error('MCPService not initialized');
  return mcpService;
}

export function getCredentialService(): CredentialService {
  if (!credentialService) throw new Error('CredentialService not initialized');
  return credentialService;
}

export function getUpdateService(): UpdateService {
  if (!updateService) throw new Error('UpdateService not initialized');
  return updateService;
}

// ── Initialization ───────────────────────────────────────────────────────────

export async function initializeServices(): Promise<void> {
  console.log('[Services] Initializing...');

  // 0. Initialize credential store and load saved API keys
  credentialService = new CredentialService();
  await credentialService.initialize();
  await loadSavedApiKeys(credentialService);

  const config = getConfig();

  // 1. Create LLM Router
  const router = createRouterFromConfig(config);

  // 2. Create Tool Registry
  const tools = createDefaultRegistry({
    includeTaskTool: false,
    includeInteractiveTools: false,
  });

  // 3. Create MCP Registry
  const mcpRegistry = new MCPRegistry();

  // 4. Create services
  agentService = new AgentService(router, tools);
  configService = new ConfigService(router, credentialService);
  mcpService = new MCPService(mcpRegistry);
  updateService = new UpdateService();

  const backend = credentialService.getStorageBackend();
  console.log('[Services] Initialized', {
    provider: config.llm.provider,
    model: config.llm.model,
    hasApiKey: !!config.llm.apiKey,
    credentialBackend: backend.backend,
    secureStorage: backend.secure,
  });
}

// ── Cleanup ──────────────────────────────────────────────────────────────────

export function disposeServices(): void {
  agentService?.dispose();
  agentService = null;
  configService = null;
  mcpService = null;
  credentialService = null;
  updateService = null;
  console.log('[Services] Disposed');
}

// ── Router Factory ───────────────────────────────────────────────────────────

function createRouterFromConfig(config: ReturnType<typeof getConfig>): LLMRouter {
  const router = new LLMRouter({ primary: config.llm.provider });

  const provider = config.llm.provider;
  const apiKey = config.llm.apiKey;

  // Register the configured provider
  try {
    if (provider === 'openai') {
      const key = apiKey || process.env.OPENAI_API_KEY;
      if (key) {
        router.registerProvider(new OpenAIProvider({
          apiKey: key,
          model: config.llm.model,
          baseURL: config.llm.baseUrl,
        }));
      }
    } else if (provider === 'anthropic') {
      const key = apiKey || process.env.ANTHROPIC_API_KEY;
      if (key) {
        router.registerProvider(new AnthropicProvider({
          apiKey: key,
          model: config.llm.model,
        }));
      }
    } else if (provider === 'gemini') {
      const key = apiKey || process.env.GEMINI_API_KEY;
      if (key) {
        router.registerProvider(new GeminiProvider({
          apiKey: key,
          model: config.llm.model,
        }));
      }
    } else if (provider === 'ollama') {
      router.registerProvider(new OllamaProvider({
        baseURL: config.llm.baseUrl,
        model: config.llm.model,
      }));
    }
  } catch (error) {
    console.error(`[Services] Failed to register provider '${provider}':`, error);
  }

  // Register additional providers from environment (not the primary)
  if (provider !== 'openai' && process.env.OPENAI_API_KEY) {
    try {
      router.registerProvider(new OpenAIProvider({ apiKey: process.env.OPENAI_API_KEY }));
    } catch { /* already registered or SDK issue */ }
  }
  if (provider !== 'anthropic' && process.env.ANTHROPIC_API_KEY) {
    try {
      router.registerProvider(new AnthropicProvider({ apiKey: process.env.ANTHROPIC_API_KEY }));
    } catch { /* already registered or SDK issue */ }
  }
  if (provider !== 'gemini' && process.env.GEMINI_API_KEY) {
    try {
      router.registerProvider(new GeminiProvider({ apiKey: process.env.GEMINI_API_KEY }));
    } catch { /* already registered or SDK issue */ }
  }

  return router;
}

// ── Boot-time API Key Loading ────────────────────────────────────────────────

async function loadSavedApiKeys(credentials: CredentialService): Promise<void> {
  const storedKeys = credentials.list('api_key');
  if (storedKeys.length === 0) {
    console.log('[Services] No saved API keys found');
    return;
  }

  for (const meta of storedKeys) {
    const envVar = ENV_KEY_MAP[meta.id];
    if (!envVar || process.env[envVar]) continue; // Skip if env already set

    try {
      const apiKey = await credentials.retrieve('api_key', meta.id);
      if (apiKey) {
        process.env[envVar] = apiKey;
        console.log(`[Services] Loaded saved API key for ${meta.id}`);
      }
    } catch (error) {
      console.error(`[Services] Failed to load API key for ${meta.id}:`, error);
    }
  }
}
