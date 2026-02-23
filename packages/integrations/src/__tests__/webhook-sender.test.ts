import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WebhookSender } from '../webhooks/sender.js';
import type { WebhookPayload } from '../webhooks/types.js';

const mockFetch = vi.fn();
global.fetch = mockFetch;

const payload: WebhookPayload = {
  event: 'task.completed',
  timestamp: '2025-01-01T00:00:00Z',
  data: { taskId: '123', status: 'completed' },
};

function httpResponse(status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
  });
}

describe('WebhookSender', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sends a webhook with correct headers', async () => {
    mockFetch.mockReturnValue(httpResponse(200));
    const sender = new WebhookSender({ url: 'https://example.com/hook' });
    const result = await sender.send(payload);

    expect(result.success).toBe(true);
    expect(result.attempts).toBe(1);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://example.com/hook',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          'X-OpenAgent-Event': 'task.completed',
        }),
      }),
    );
  });

  it('includes HMAC signature when secret is provided', async () => {
    mockFetch.mockReturnValue(httpResponse(200));
    const sender = new WebhookSender({ url: 'https://example.com/hook', secret: 'mysecret' });
    await sender.send(payload);

    const callHeaders = mockFetch.mock.calls[0][1].headers;
    expect(callHeaders['X-OpenAgent-Signature']).toMatch(/^sha256=[a-f0-9]+$/);
  });

  it('retries on 5xx errors', async () => {
    mockFetch
      .mockReturnValueOnce(httpResponse(500))
      .mockReturnValueOnce(httpResponse(502))
      .mockReturnValueOnce(httpResponse(200));

    const sender = new WebhookSender({
      url: 'https://example.com/hook',
      maxRetries: 3,
      retryDelayMs: 10, // fast for tests
    });

    const result = await sender.send(payload);
    expect(result.success).toBe(true);
    expect(result.attempts).toBe(3);
  });

  it('does not retry on 4xx errors (except 429)', async () => {
    mockFetch.mockReturnValue(httpResponse(400));
    const sender = new WebhookSender({
      url: 'https://example.com/hook',
      maxRetries: 3,
      retryDelayMs: 10,
    });

    const result = await sender.send(payload);
    expect(result.success).toBe(false);
    expect(result.attempts).toBe(1);
    expect(result.statusCode).toBe(400);
  });

  it('retries on 429 rate limit', async () => {
    mockFetch
      .mockReturnValueOnce(httpResponse(429))
      .mockReturnValueOnce(httpResponse(200));

    const sender = new WebhookSender({
      url: 'https://example.com/hook',
      maxRetries: 3,
      retryDelayMs: 10,
    });

    const result = await sender.send(payload);
    expect(result.success).toBe(true);
    expect(result.attempts).toBe(2);
  });

  it('handles network errors with retries', async () => {
    mockFetch
      .mockRejectedValueOnce(new Error('ECONNREFUSED'))
      .mockReturnValueOnce(httpResponse(200));

    const sender = new WebhookSender({
      url: 'https://example.com/hook',
      maxRetries: 3,
      retryDelayMs: 10,
    });

    const result = await sender.send(payload);
    expect(result.success).toBe(true);
    expect(result.attempts).toBe(2);
  });

  it('fails after exhausting retries', async () => {
    mockFetch.mockRejectedValue(new Error('ECONNREFUSED'));
    const sender = new WebhookSender({
      url: 'https://example.com/hook',
      maxRetries: 2,
      retryDelayMs: 10,
    });

    const result = await sender.send(payload);
    expect(result.success).toBe(false);
    expect(result.attempts).toBe(3); // 1 initial + 2 retries
    expect(result.error).toBe('ECONNREFUSED');
  });

  it('includes custom headers', async () => {
    mockFetch.mockReturnValue(httpResponse(200));
    const sender = new WebhookSender({
      url: 'https://example.com/hook',
      headers: { 'X-Custom': 'value' },
    });
    await sender.send(payload);

    const callHeaders = mockFetch.mock.calls[0][1].headers;
    expect(callHeaders['X-Custom']).toBe('value');
  });
});
