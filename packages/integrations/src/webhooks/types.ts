/**
 * Webhook sender types.
 */

export interface WebhookConfig {
  /** Target URL to POST to */
  url: string;
  /** Optional secret for HMAC-SHA256 signature verification */
  secret?: string;
  /** Custom headers to include */
  headers?: Record<string, string>;
  /** Max retries on failure (default: 3) */
  maxRetries?: number;
  /** Retry delay in ms (default: 1000, doubles on each retry) */
  retryDelayMs?: number;
  /** Request timeout in ms (default: 10000) */
  timeoutMs?: number;
}

export interface WebhookPayload {
  event: string;
  timestamp: string;
  data: unknown;
}

export interface WebhookResult {
  success: boolean;
  statusCode?: number;
  attempts: number;
  error?: string;
}

export interface WebhookRegistration {
  id: string;
  config: WebhookConfig;
  /** Event patterns to subscribe to (e.g. "task.*", "plan.approved") */
  eventPatterns: string[];
  enabled: boolean;
}
