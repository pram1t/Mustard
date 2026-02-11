/**
 * Config Service
 *
 * Wraps @openagent/config as a thin delegation layer.
 * Critical: API keys are NEVER exposed to the renderer.
 * API key storage is delegated to CredentialService.
 */

import { getConfig } from '@openagent/config';
import type { LLMProvider as LLMProviderType } from '@openagent/config';
import type { LLMRouter } from '@openagent/llm';
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
        console.warn('[ConfigService] Attempted to set API key via IPC — blocked');
        delete updates.apiKey;
      }

      const { saveGlobalConfig, ensureGlobalConfig } = await import('@openagent/config');
      await ensureGlobalConfig();
      await saveGlobalConfig({
        ...(updates.provider !== undefined ? { provider: updates.provider as LLMProviderType } : {}),
        ...(updates.model !== undefined ? { model: updates.model as string } : {}),
      });

      return { success: true };
    } catch (error) {
      console.error('[ConfigService] Config set failed:', error);
      return { success: false };
    }
  }

  /**
   * Gets available LLM providers.
   */
  getProviders(): ProviderInfo[] {
    try {
      const names = this.router.listProviders();
      return names.map((name) => ({
        id: name,
        name: name.charAt(0).toUpperCase() + name.slice(1),
        requiresApiKey: name !== 'ollama',
        hasApiKey: this.checkHasApiKey(name),
      }));
    } catch {
      return [];
    }
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
   * Also sets the environment variable for immediate use.
   */
  async setApiKey(provider: string, apiKey: string): Promise<{ success: boolean }> {
    try {
      await this.credentials.store('api_key', provider, apiKey, `API key for ${provider}`);

      const envVar = ENV_KEY_MAP[provider];
      if (envVar) {
        process.env[envVar] = apiKey;
      }
      return { success: true };
    } catch (error) {
      console.error('[ConfigService] setApiKey failed:', error);
      return { success: false };
    }
  }

  /**
   * Removes a stored API key and clears the environment variable.
   */
  async removeApiKey(provider: string): Promise<{ success: boolean }> {
    try {
      await this.credentials.delete('api_key', provider);

      const envVar = ENV_KEY_MAP[provider];
      if (envVar) {
        delete process.env[envVar];
      }
      return { success: true };
    } catch (error) {
      console.error('[ConfigService] removeApiKey failed:', error);
      return { success: false };
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
