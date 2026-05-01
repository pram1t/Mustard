/**
 * Config Service
 *
 * Wraps @pram1t/mustard-config as a thin delegation layer.
 * Critical: API keys are NEVER exposed to the renderer.
 * API key storage is delegated to CredentialService.
 */

import { getConfig } from '@pram1t/mustard-config';
import type { LLMProvider as LLMProviderType } from '@pram1t/mustard-config';
import {
  type LLMRouter,
  OpenAIProvider,
  AnthropicProvider,
  GeminiProvider,
  OllamaProvider,
} from '@pram1t/mustard-llm';
import type {
  SafeConfig,
  ProviderInfo,
  ModelInfo,
} from '../../shared/preload-api';
import type { CredentialService } from './credentials';

export const ENV_KEY_MAP: Record<string, string> = {
  openai: 'OPENAI_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
  gemini: 'GEMINI_API_KEY',
  ollama: '',
};

/**
 * All known providers — shown in the Settings dropdown regardless of API key status.
 */
const ALL_PROVIDERS: Array<{ id: string; name: string; requiresApiKey: boolean }> = [
  { id: 'openai', name: 'OpenAI', requiresApiKey: true },
  { id: 'anthropic', name: 'Anthropic', requiresApiKey: true },
  { id: 'gemini', name: 'Gemini', requiresApiKey: true },
  { id: 'ollama', name: 'Ollama', requiresApiKey: false },
];

export class ConfigService {
  private router: LLMRouter;
  private credentials: CredentialService;

  constructor(router: LLMRouter, credentials: CredentialService) {
    this.router = router;
    this.credentials = credentials;
  }

  /**
   * Gets configuration sanitized for the renderer.
   * API keys are replaced with a boolean flag.
   */
  get(): SafeConfig {
    const config = getConfig();

    return {
      provider: config.llm.provider,
      model: config.llm.model || '',
      hasApiKey: !!config.llm.apiKey,
      theme: 'system',
      shortcuts: {
        focusChat: 'Ctrl+L',
        sendMessage: 'Enter',
        stopAgent: 'Escape',
        openSettings: 'Ctrl+,',
      },
      ui: {
        fontSize: 'medium',
        expandToolCalls: false,
        soundEnabled: true,
      },
    };
  }

  /**
   * Updates configuration.
   * API keys are blocked from being set via IPC.
   */
  async set(updates: Record<string, unknown>): Promise<{ success: boolean }> {
    try {
      // Block API key from being set via IPC
      if ('apiKey' in updates) {
        delete updates.apiKey;
      }

      const { saveGlobalConfig, ensureGlobalConfig } = await import('@pram1t/mustard-config');
      await ensureGlobalConfig();
      await saveGlobalConfig({
        ...(updates.provider !== undefined ? { provider: updates.provider as LLMProviderType } : {}),
        ...(updates.model !== undefined ? { model: updates.model as string } : {}),
      });

      // If provider changed, update router primary (if that provider is registered)
      if (updates.provider && typeof updates.provider === 'string') {
        if (this.router.hasProvider(updates.provider)) {
          this.router.setPrimary(updates.provider);
        }
      }

      return { success: true };
    } catch (error) {
      console.error('[ConfigService] Config set failed:', error);
      return { success: false };
    }
  }

  /**
   * Gets available LLM providers.
   * Returns ALL known providers regardless of API key status.
   */
  getProviders(): ProviderInfo[] {
    return ALL_PROVIDERS.map((p) => ({
      id: p.id,
      name: p.name,
      requiresApiKey: p.requiresApiKey,
      hasApiKey: this.checkHasApiKey(p.id),
    }));
  }

  /**
   * Gets available models for a provider.
   */
  getModels(providerId: string): ModelInfo[] {
    try {
      const provider = this.router.getProvider(providerId);
      return provider.models.map((modelId) => ({
        id: modelId,
        name: modelId,
        contextWindow: provider.capabilities.maxContextLength,
        maxOutput: 4096,
        capabilities: {
          tools: provider.capabilities.toolUse,
          vision: provider.capabilities.vision,
          thinking: false,
        },
      }));
    } catch {
      return [];
    }
  }

  /**
   * Stores an API key via CredentialService.
   * Also sets the environment variable and registers the provider in the router.
   */
  async setApiKey(provider: string, apiKey: string): Promise<{ success: boolean }> {
    try {
      await this.credentials.store('api_key', provider, apiKey, `API key for ${provider}`);

      const envVar = ENV_KEY_MAP[provider];
      if (envVar) {
        process.env[envVar] = apiKey;
      }

      // Register the provider in the router so it's available immediately
      this.registerProviderInRouter(provider, apiKey);

      return { success: true };
    } catch (error) {
      console.error('[ConfigService] setApiKey failed:', error);
      return { success: false };
    }
  }

  /**
   * Removes a stored API key, clears the environment variable, and unregisters the provider.
   */
  async removeApiKey(provider: string): Promise<{ success: boolean }> {
    try {
      await this.credentials.delete('api_key', provider);

      const envVar = ENV_KEY_MAP[provider];
      if (envVar) {
        delete process.env[envVar];
      }

      // Unregister provider from router since key is gone
      this.router.unregisterProvider(provider);

      return { success: true };
    } catch (error) {
      console.error('[ConfigService] removeApiKey failed:', error);
      return { success: false };
    }
  }

  /**
   * Registers a provider in the router with the given API key.
   * If the provider is already registered, it re-registers with the new key.
   */
  private registerProviderInRouter(provider: string, apiKey: string): void {
    try {
      const config = getConfig();

      // Unregister first if already exists (to update credentials)
      if (this.router.hasProvider(provider)) {
        this.router.unregisterProvider(provider);
      }

      if (provider === 'openai') {
        this.router.registerProvider(new OpenAIProvider({
          apiKey,
          model: config.llm.model,
          baseURL: config.llm.baseUrl,
        }));
      } else if (provider === 'anthropic') {
        this.router.registerProvider(new AnthropicProvider({
          apiKey,
          model: config.llm.model,
        }));
      } else if (provider === 'gemini') {
        this.router.registerProvider(new GeminiProvider({
          apiKey,
          model: config.llm.model,
        }));
      } else if (provider === 'ollama') {
        this.router.registerProvider(new OllamaProvider({
          baseURL: config.llm.baseUrl,
          model: config.llm.model,
        }));
      }

      // Also set as primary so the router uses this provider for chat
      this.router.setPrimary(provider);
    } catch {
      // Silently fail — Electron has no stdout for logging
    }
  }

  private checkHasApiKey(providerName: string): boolean {
    const config = getConfig();
    if (providerName === config.llm.provider && config.llm.apiKey) {
      return true;
    }
    // Check credential store
    if (this.credentials.has('api_key', providerName)) {
      return true;
    }
    // Check environment
    const envVar = ENV_KEY_MAP[providerName];
    if (!envVar) return providerName === 'ollama';
    return !!process.env[envVar];
  }
}
