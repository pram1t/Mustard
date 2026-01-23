/**
 * OpenAI-Compatible Provider Adapter
 *
 * Extends the OpenAI adapter for use with OpenAI-compatible APIs.
 * Works with LM Studio, vLLM, LocalAI, Groq, Together, and other compatible services.
 */

import { OpenAIProvider } from './openai.js';
import type { OpenAIConfig } from './openai.js';
import type { ValidationResult } from '../types.js';

/**
 * OpenAI-compatible provider configuration
 */
export interface OpenAICompatibleConfig {
  baseURL: string; // Required for compatible APIs
  apiKey?: string; // Optional - some local APIs don't require keys
  model?: string;
}

/**
 * OpenAI-Compatible LLM Provider
 *
 * Use this for:
 * - LM Studio: http://localhost:1234/v1
 * - vLLM: http://localhost:8000/v1
 * - LocalAI: http://localhost:8080/v1
 * - Groq: https://api.groq.com/openai/v1
 * - Together: https://api.together.xyz/v1
 * - Any other OpenAI-compatible API
 */
export class OpenAICompatibleProvider extends OpenAIProvider {
  override readonly name: string = 'openai-compatible';
  private compatBaseURL: string;

  constructor(config: OpenAICompatibleConfig) {
    // Use a placeholder API key if none provided (some local APIs don't need one)
    super({
      apiKey: config.apiKey || 'not-required',
      baseURL: config.baseURL,
      model: config.model || 'gpt-3.5-turbo',
    });
    this.compatBaseURL = config.baseURL;
  }

  /**
   * Override validation to be more lenient for compatible APIs
   * Some APIs don't support the /models endpoint
   */
  override async validate(): Promise<ValidationResult> {
    try {
      // First try the standard OpenAI validation
      const result = await super.validate();
      if (result.valid) {
        return result;
      }

      // If that fails, just check if we can reach the endpoint
      const response = await fetch(`${this.compatBaseURL}/models`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${(this as any).client?.apiKey || 'not-required'}`,
        },
      });

      // Accept 200 OK or 401 (means the server is there, just auth issues)
      if (response.ok || response.status === 401) {
        return { valid: true };
      }

      return { valid: false, error: `Server returned ${response.status}` };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);

      // Check for connection errors
      if (errorMsg.includes('ECONNREFUSED') || errorMsg.includes('fetch failed')) {
        return {
          valid: false,
          error: `Cannot connect to ${this.compatBaseURL}. Is the server running?`,
        };
      }

      return { valid: false, error: errorMsg };
    }
  }
}
