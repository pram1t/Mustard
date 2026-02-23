/**
 * Generic webhook sender with retry logic and HMAC signatures.
 */

import { createHmac } from 'node:crypto';
import type { WebhookConfig, WebhookPayload, WebhookResult } from './types.js';

export class WebhookSender {
  private config: Required<Omit<WebhookConfig, 'secret' | 'headers'>> & Pick<WebhookConfig, 'secret' | 'headers'>;

  constructor(config: WebhookConfig) {
    this.config = {
      maxRetries: 3,
      retryDelayMs: 1000,
      timeoutMs: 10000,
      ...config,
    };
  }

  /**
   * Send a webhook payload with automatic retry on failure.
   */
  async send(payload: WebhookPayload): Promise<WebhookResult> {
    const body = JSON.stringify(payload);
    let lastError: string | undefined;

    for (let attempt = 1; attempt <= this.config.maxRetries + 1; attempt++) {
      try {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'User-Agent': 'openagent-webhook/1.0',
          'X-OpenAgent-Event': payload.event,
          ...this.config.headers,
        };

        if (this.config.secret) {
          headers['X-OpenAgent-Signature'] = this.sign(body, this.config.secret);
        }

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

        try {
          const res = await fetch(this.config.url, {
            method: 'POST',
            headers,
            body,
            signal: controller.signal,
          });

          if (res.ok) {
            return { success: true, statusCode: res.status, attempts: attempt };
          }

          lastError = `HTTP ${res.status}: ${res.statusText}`;

          // Don't retry on 4xx (client errors) except 429 (rate limit)
          if (res.status >= 400 && res.status < 500 && res.status !== 429) {
            return { success: false, statusCode: res.status, attempts: attempt, error: lastError };
          }
        } finally {
          clearTimeout(timeout);
        }
      } catch (err: any) {
        lastError = err.name === 'AbortError' ? 'Request timed out' : (err.message ?? 'Unknown error');
      }

      // Wait before retrying (exponential backoff)
      if (attempt <= this.config.maxRetries) {
        const delay = this.config.retryDelayMs * Math.pow(2, attempt - 1);
        await new Promise((r) => setTimeout(r, delay));
      }
    }

    return {
      success: false,
      attempts: this.config.maxRetries + 1,
      error: lastError,
    };
  }

  private sign(body: string, secret: string): string {
    return `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;
  }
}
