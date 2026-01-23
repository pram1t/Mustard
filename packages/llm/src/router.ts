/**
 * LLM Router
 *
 * Manages multiple LLM providers and handles:
 * - Provider registration and selection
 * - Automatic fallback on failures
 * - Retry logic with exponential backoff
 */

import type {
  LLMProvider,
  ChatParams,
  StreamChunk,
  RouterConfig,
  Message,
  ValidationResult,
} from './types.js';
import { getLogger } from '@openagent/logger';

/**
 * Default router configuration
 */
const DEFAULT_CONFIG: Required<Omit<RouterConfig, 'primary'>> = {
  fallback: [],
  retryAttempts: 3,
  retryDelay: 1000,
};

/**
 * LLM Router for managing multiple providers
 */
export class LLMRouter {
  private providers: Map<string, LLMProvider> = new Map();
  private config: Required<RouterConfig>;
  private logger = getLogger();

  constructor(config: RouterConfig) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
    };
  }

  /**
   * Register a provider with the router
   */
  registerProvider(provider: LLMProvider): void {
    this.providers.set(provider.name, provider);
  }

  /**
   * Unregister a provider
   */
  unregisterProvider(name: string): boolean {
    return this.providers.delete(name);
  }

  /**
   * Get a specific provider by name
   */
  getProvider(name?: string): LLMProvider {
    const providerName = name || this.config.primary;
    const provider = this.providers.get(providerName);
    if (!provider) {
      throw new Error(`Provider '${providerName}' not registered. Available: ${Array.from(this.providers.keys()).join(', ')}`);
    }
    return provider;
  }

  /**
   * Get the primary provider
   */
  getPrimaryProvider(): LLMProvider {
    return this.getProvider(this.config.primary);
  }

  /**
   * List all registered provider names
   */
  listProviders(): string[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Check if a provider is registered
   */
  hasProvider(name: string): boolean {
    return this.providers.has(name);
  }

  /**
   * Set the primary provider
   */
  setPrimary(name: string): void {
    if (!this.providers.has(name)) {
      throw new Error(`Provider '${name}' not registered`);
    }
    this.config.primary = name;
  }

  /**
   * Send chat completion with automatic fallback
   */
  async *chat(params: ChatParams): AsyncGenerator<StreamChunk> {
    const providerOrder = [
      this.config.primary,
      ...this.config.fallback,
    ];

    let lastError: Error | null = null;

    for (const providerName of providerOrder) {
      const provider = this.providers.get(providerName);
      if (!provider) {
        this.logger.warn(`Provider '${providerName}' not registered, skipping`, { providerName });
        continue;
      }

      for (let attempt = 0; attempt < this.config.retryAttempts; attempt++) {
        try {
          // Attempt to stream from this provider
          const stream = provider.chat(params);

          // Yield all chunks from the stream
          for await (const chunk of stream) {
            // Check for error chunks
            if (chunk.type === 'error') {
              throw new Error(chunk.error);
            }
            yield chunk;
          }

          // If we get here, success! Return without trying fallbacks
          return;
        } catch (error) {
          lastError = error as Error;
          this.logger.warn(
            `Provider '${providerName}' attempt ${attempt + 1}/${this.config.retryAttempts} failed`,
            { providerName, attempt: attempt + 1, maxAttempts: this.config.retryAttempts, error: String(error) }
          );

          // Check if error is retryable
          if (this.isRetryable(error)) {
            // Wait before retry with exponential backoff
            const delay = this.config.retryDelay * Math.pow(2, attempt);
            await this.delay(delay);
            continue;
          }

          // Non-retryable error, move to next provider
          break;
        }
      }
    }

    // All providers failed
    throw lastError || new Error('All providers failed');
  }

  /**
   * Count tokens using the primary provider
   */
  async countTokens(messages: Message[]): Promise<number> {
    const provider = this.getPrimaryProvider();
    return provider.countTokens(messages);
  }

  /**
   * Validate all registered providers
   */
  async validateAll(): Promise<Map<string, ValidationResult>> {
    const results = new Map<string, ValidationResult>();

    for (const [name, provider] of this.providers) {
      try {
        const result = await provider.validate();
        results.set(name, result);
      } catch (error) {
        results.set(name, { valid: false, error: String(error) });
      }
    }

    return results;
  }

  /**
   * Validate a specific provider
   */
  async validateProvider(name: string): Promise<ValidationResult> {
    const provider = this.getProvider(name);
    return provider.validate();
  }

  /**
   * Check if an error is retryable
   */
  private isRetryable(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false;

    const err = error as Record<string, unknown>;

    // HTTP status codes that are retryable
    if (err.status === 429) return true;  // Rate limit
    if (err.status === 503) return true;  // Service unavailable
    if (err.status === 502) return true;  // Bad gateway
    if (err.status === 504) return true;  // Gateway timeout

    // Network errors that are retryable
    if (err.code === 'ECONNRESET') return true;
    if (err.code === 'ETIMEDOUT') return true;
    if (err.code === 'ECONNREFUSED') return true;
    if (err.code === 'ENOTFOUND') return true;

    // Error message patterns
    const message = String(err.message || '').toLowerCase();
    if (message.includes('rate limit')) return true;
    if (message.includes('timeout')) return true;
    if (message.includes('temporarily')) return true;
    if (message.includes('overloaded')) return true;

    return false;
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Create a router with a single provider (convenience function)
 */
export function createRouter(provider: LLMProvider): LLMRouter {
  const router = new LLMRouter({ primary: provider.name });
  router.registerProvider(provider);
  return router;
}
