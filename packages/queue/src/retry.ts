/**
 * OpenAgent V2 - Retry Policy
 *
 * Exponential backoff retry policy for failed tasks.
 */

import type { RetryConfig } from './types.js';

/**
 * Default retry configuration.
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  baseDelay: 1000,    // 1 second
  multiplier: 2,       // double each retry
  maxDelay: 30000,     // 30 seconds max
  maxRetries: 3,
};

/**
 * Calculates retry delay using exponential backoff.
 */
export class RetryPolicy {
  private readonly config: RetryConfig;

  constructor(config?: Partial<RetryConfig>) {
    this.config = { ...DEFAULT_RETRY_CONFIG, ...config };
  }

  /**
   * Calculate the delay for a given attempt number (0-based).
   * Formula: min(baseDelay * multiplier^attempt, maxDelay)
   */
  getDelay(attempt: number): number {
    const delay = this.config.baseDelay * Math.pow(this.config.multiplier, attempt);
    return Math.min(delay, this.config.maxDelay);
  }

  /**
   * Check if a retry should be attempted.
   */
  shouldRetry(attempt: number): boolean {
    return attempt < this.config.maxRetries;
  }

  /**
   * Get the maximum number of retries.
   */
  getMaxRetries(): number {
    return this.config.maxRetries;
  }

  /**
   * Get the configuration.
   */
  getConfig(): Readonly<RetryConfig> {
    return { ...this.config };
  }
}
