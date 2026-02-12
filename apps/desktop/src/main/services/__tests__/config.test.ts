import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock config package
vi.mock('@openagent/config', () => ({
  getConfig: vi.fn(() => ({
    llm: {
      provider: 'openai',
      model: 'gpt-4o',
      apiKey: 'sk-secret-test-key-12345',
      baseUrl: undefined,
      retryAttempts: 3,
      retryDelay: 1000,
    },
    logging: { level: 'info', format: 'pretty' },
    tools: { bash: true, maxOutputSize: 10000 },
    security: { auditLogging: false, sanitizeInputs: true },
  })),
  saveGlobalConfig: vi.fn(async () => ({})),
  ensureGlobalConfig: vi.fn(async () => {}),
}));

import { ConfigService } from '../config';
import type { LLMRouter, LLMProvider } from '@openagent/llm';
import type { CredentialService } from '../credentials';

describe('ConfigService', () => {
  let service: ConfigService;
  let mockRouter: LLMRouter;
  let mockCredentials: CredentialService;

  beforeEach(() => {
    vi.clearAllMocks();

    mockRouter = {
      listProviders: vi.fn(() => ['openai', 'anthropic']),
      getProvider: vi.fn((name: string) => ({
        name,
        models: ['model-a', 'model-b'],
        capabilities: {
          streaming: true,
          toolUse: true,
          vision: false,
          systemMessages: true,
          parallelToolCalls: false,
          maxContextLength: 128000,
        },
      })),
    } as unknown as LLMRouter;

    mockCredentials = {
      store: vi.fn(async () => {}),
      retrieve: vi.fn(async () => null),
      delete: vi.fn(async () => {}),
      has: vi.fn(() => false),
      list: vi.fn(() => []),
      initialize: vi.fn(async () => {}),
      isSecureStorageAvailable: vi.fn(() => true),
      getStorageBackend: vi.fn(() => ({ backend: 'Test', secure: true })),
    } as unknown as CredentialService;

    service = new ConfigService(mockRouter, mockCredentials);
  });

  it('get() returns SafeConfig with hasApiKey but no actual key', () => {
    const config = service.get();

    expect(config.hasApiKey).toBe(true);
    expect(config.provider).toBe('openai');
    expect(config.model).toBe('gpt-4o');
    // Must NEVER contain actual API key
    expect(config).not.toHaveProperty('apiKey');
    expect(JSON.stringify(config)).not.toContain('sk-secret');
  });

  it('get() returns theme and UI config', () => {
    const config = service.get();
    expect(config.theme).toBe('system');
    expect(config.shortcuts).toBeDefined();
    expect(config.ui).toBeDefined();
  });

  it('getProviders() returns all known providers regardless of registration', () => {
    const providers = service.getProviders();
    expect(providers).toHaveLength(4);
    expect(providers[0]).toMatchObject({ id: 'openai', name: 'OpenAI', requiresApiKey: true });
    expect(providers[1]).toMatchObject({ id: 'anthropic', name: 'Anthropic', requiresApiKey: true });
    expect(providers[2]).toMatchObject({ id: 'gemini', name: 'Gemini', requiresApiKey: true });
    expect(providers[3]).toMatchObject({ id: 'ollama', name: 'Ollama', requiresApiKey: false });
  });

  it('getModels() returns models for a provider', () => {
    const models = service.getModels('openai');
    expect(models).toHaveLength(2);
    expect(models[0]).toMatchObject({
      id: 'model-a',
      name: 'model-a',
      contextWindow: 128000,
    });
  });

  it('getModels() returns empty for unknown provider', () => {
    (mockRouter.getProvider as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error('Provider not found');
    });
    const models = service.getModels('nonexistent');
    expect(models).toEqual([]);
  });

  it('set() blocks apiKey field', async () => {
    const result = await service.set({ apiKey: 'sk-new-key', model: 'gpt-4' });
    expect(result).toEqual({ success: true });

    const { saveGlobalConfig } = await import('@openagent/config');
    expect(saveGlobalConfig).toHaveBeenCalledWith(
      expect.not.objectContaining({ apiKey: 'sk-new-key' }),
    );
  });
});
