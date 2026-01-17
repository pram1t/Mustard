/**
 * LLM Router Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LLMRouter, createRouter } from '../router';
import { MockLLMProvider } from './mocks';
import type { Message, ChatParams } from '../types';

describe('LLMRouter', () => {
  let mockProvider1: MockLLMProvider;
  let mockProvider2: MockLLMProvider;

  beforeEach(() => {
    mockProvider1 = new MockLLMProvider();
    // Assign a unique name for fallback testing
    (mockProvider1 as { name: string }).name = 'mock1';

    mockProvider2 = new MockLLMProvider();
    (mockProvider2 as { name: string }).name = 'mock2';

    // Suppress console.warn during tests
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  describe('constructor', () => {
    it('should create router with config', () => {
      const router = new LLMRouter({ primary: 'mock1' });
      router.registerProvider(mockProvider1);

      expect(router).toBeDefined();
    });
  });

  describe('registerProvider', () => {
    it('should register a provider', () => {
      const router = new LLMRouter({ primary: 'mock1' });
      router.registerProvider(mockProvider1);

      expect(router.hasProvider('mock1')).toBe(true);
    });

    it('should list all providers', () => {
      const router = new LLMRouter({ primary: 'mock1' });
      router.registerProvider(mockProvider1);
      router.registerProvider(mockProvider2);

      const providers = router.listProviders();
      expect(providers).toContain('mock1');
      expect(providers).toContain('mock2');
    });

    it('should unregister a provider', () => {
      const router = new LLMRouter({ primary: 'mock1' });
      router.registerProvider(mockProvider1);

      expect(router.hasProvider('mock1')).toBe(true);
      router.unregisterProvider('mock1');
      expect(router.hasProvider('mock1')).toBe(false);
    });
  });

  describe('getProvider', () => {
    it('should return registered provider', () => {
      const router = new LLMRouter({ primary: 'mock1' });
      router.registerProvider(mockProvider1);

      const provider = router.getProvider('mock1');
      expect(provider).toBe(mockProvider1);
    });

    it('should throw for unregistered provider', () => {
      const router = new LLMRouter({ primary: 'mock1' });

      expect(() => router.getProvider('nonexistent')).toThrow();
    });

    it('should return primary provider by default', () => {
      const router = new LLMRouter({ primary: 'mock1' });
      router.registerProvider(mockProvider1);

      const provider = router.getProvider();
      expect(provider).toBe(mockProvider1);
    });
  });

  describe('chat', () => {
    it('should stream response from provider', async () => {
      const router = new LLMRouter({ primary: 'mock1' });
      router.registerProvider(mockProvider1);

      mockProvider1.queueResponse({
        content: 'Hello, world!',
      });

      const messages: Message[] = [{ role: 'user', content: 'Hi' }];
      const params: ChatParams = { messages };
      const chunks: string[] = [];

      for await (const chunk of router.chat(params)) {
        if (chunk.type === 'text' && chunk.content) {
          chunks.push(chunk.content);
        }
      }

      expect(chunks.join('')).toBe('Hello, world!');
    });

    it('should handle tool calls', async () => {
      const router = new LLMRouter({ primary: 'mock1' });
      router.registerProvider(mockProvider1);

      mockProvider1.queueResponse({
        toolCalls: [
          { id: 'call_1', name: 'read_file', arguments: { path: '/test.txt' } },
        ],
        finishReason: 'tool_calls',
      });

      const messages: Message[] = [{ role: 'user', content: 'Read the file' }];
      const params: ChatParams = { messages };
      const toolCalls: Array<{ id: string; name: string }> = [];

      for await (const chunk of router.chat(params)) {
        if (chunk.type === 'tool_call' && chunk.tool_call) {
          toolCalls.push({
            id: chunk.tool_call.id,
            name: chunk.tool_call.name,
          });
        }
      }

      expect(toolCalls).toHaveLength(1);
      expect(toolCalls[0].name).toBe('read_file');
    });
  });

  describe('fallback', () => {
    it('should fallback to second provider on error', async () => {
      const router = new LLMRouter({
        primary: 'mock1',
        fallback: ['mock2'],
        retryAttempts: 1, // Only 1 attempt so we quickly move to fallback
      });
      router.registerProvider(mockProvider1);
      router.registerProvider(mockProvider2);

      mockProvider1.queueError(new Error('Provider 1 failed'));
      mockProvider2.queueResponse({ content: 'Fallback response' });

      const messages: Message[] = [{ role: 'user', content: 'Test' }];
      const params: ChatParams = { messages };
      const chunks: string[] = [];

      for await (const chunk of router.chat(params)) {
        if (chunk.type === 'text' && chunk.content) {
          chunks.push(chunk.content);
        }
      }

      expect(chunks.join('')).toBe('Fallback response');
    });

    it('should throw if all providers fail', async () => {
      const router = new LLMRouter({
        primary: 'mock1',
        fallback: ['mock2'],
        retryAttempts: 1,
      });
      router.registerProvider(mockProvider1);
      router.registerProvider(mockProvider2);

      mockProvider1.queueError(new Error('Provider 1 failed'));
      mockProvider2.queueError(new Error('Provider 2 failed'));

      const messages: Message[] = [{ role: 'user', content: 'Test' }];
      const params: ChatParams = { messages };

      await expect(async () => {
        for await (const _chunk of router.chat(params)) {
          // Consume stream
        }
      }).rejects.toThrow();
    });
  });

  describe('retry', () => {
    it('should retry on transient errors', async () => {
      const router = new LLMRouter({
        primary: 'mock1',
        retryAttempts: 3,
        retryDelay: 10, // Short delay for testing
      });
      router.registerProvider(mockProvider1);

      // Create a rate limit error
      const rateLimitError = new Error('Rate limit exceeded');
      (rateLimitError as Error & { status: number }).status = 429;

      // First call fails with retryable error, second succeeds
      mockProvider1.queueError(rateLimitError);
      mockProvider1.queueResponse({ content: 'Success after retry' });

      const messages: Message[] = [{ role: 'user', content: 'Test' }];
      const params: ChatParams = { messages };
      const chunks: string[] = [];

      for await (const chunk of router.chat(params)) {
        if (chunk.type === 'text' && chunk.content) {
          chunks.push(chunk.content);
        }
      }

      expect(chunks.join('')).toBe('Success after retry');
    });

    it('should exhaust retries before falling back', async () => {
      const router = new LLMRouter({
        primary: 'mock1',
        fallback: ['mock2'],
        retryAttempts: 2,
        retryDelay: 10,
      });
      router.registerProvider(mockProvider1);
      router.registerProvider(mockProvider2);

      // Create rate limit errors
      const rateLimitError1 = new Error('Rate limit 1');
      (rateLimitError1 as Error & { status: number }).status = 429;
      const rateLimitError2 = new Error('Rate limit 2');
      (rateLimitError2 as Error & { status: number }).status = 429;

      // Primary fails all retries
      mockProvider1.queueError(rateLimitError1);
      mockProvider1.queueError(rateLimitError2);
      // Fallback succeeds
      mockProvider2.queueResponse({ content: 'From fallback' });

      const messages: Message[] = [{ role: 'user', content: 'Test' }];
      const params: ChatParams = { messages };
      const chunks: string[] = [];

      for await (const chunk of router.chat(params)) {
        if (chunk.type === 'text' && chunk.content) {
          chunks.push(chunk.content);
        }
      }

      expect(chunks.join('')).toBe('From fallback');
    });
  });

  describe('countTokens', () => {
    it('should count tokens using primary provider', async () => {
      const router = new LLMRouter({ primary: 'mock1' });
      router.registerProvider(mockProvider1);

      const messages: Message[] = [{ role: 'user', content: 'Hello, world!' }];
      const count = await router.countTokens(messages);

      // MockProvider uses ~4 chars per token
      expect(count).toBeGreaterThan(0);
    });
  });

  describe('setPrimary', () => {
    it('should change primary provider', () => {
      const router = new LLMRouter({ primary: 'mock1' });
      router.registerProvider(mockProvider1);
      router.registerProvider(mockProvider2);

      router.setPrimary('mock2');
      expect(router.getPrimaryProvider()).toBe(mockProvider2);
    });

    it('should throw for unregistered provider', () => {
      const router = new LLMRouter({ primary: 'mock1' });
      router.registerProvider(mockProvider1);

      expect(() => router.setPrimary('nonexistent')).toThrow();
    });
  });

  describe('createRouter', () => {
    it('should create router with single provider', () => {
      const router = createRouter(mockProvider1);

      expect(router.hasProvider('mock1')).toBe(true);
      expect(router.getPrimaryProvider()).toBe(mockProvider1);
    });
  });
});
