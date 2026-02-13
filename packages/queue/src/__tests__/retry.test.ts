import { describe, it, expect } from 'vitest';
import { RetryPolicy, DEFAULT_RETRY_CONFIG } from '../retry.js';

describe('RetryPolicy', () => {
  describe('default config', () => {
    it('should have sensible defaults', () => {
      expect(DEFAULT_RETRY_CONFIG.baseDelay).toBe(1000);
      expect(DEFAULT_RETRY_CONFIG.multiplier).toBe(2);
      expect(DEFAULT_RETRY_CONFIG.maxDelay).toBe(30000);
      expect(DEFAULT_RETRY_CONFIG.maxRetries).toBe(3);
    });
  });

  describe('getDelay', () => {
    it('should return baseDelay for attempt 0', () => {
      const policy = new RetryPolicy({ baseDelay: 1000, multiplier: 2, maxDelay: 30000 });
      expect(policy.getDelay(0)).toBe(1000);
    });

    it('should apply exponential backoff', () => {
      const policy = new RetryPolicy({ baseDelay: 1000, multiplier: 2, maxDelay: 100000 });
      expect(policy.getDelay(0)).toBe(1000);   // 1000 * 2^0 = 1000
      expect(policy.getDelay(1)).toBe(2000);   // 1000 * 2^1 = 2000
      expect(policy.getDelay(2)).toBe(4000);   // 1000 * 2^2 = 4000
      expect(policy.getDelay(3)).toBe(8000);   // 1000 * 2^3 = 8000
    });

    it('should cap at maxDelay', () => {
      const policy = new RetryPolicy({ baseDelay: 1000, multiplier: 2, maxDelay: 5000 });
      expect(policy.getDelay(0)).toBe(1000);
      expect(policy.getDelay(1)).toBe(2000);
      expect(policy.getDelay(2)).toBe(4000);
      expect(policy.getDelay(3)).toBe(5000); // capped
      expect(policy.getDelay(10)).toBe(5000); // still capped
    });

    it('should work with multiplier of 3', () => {
      const policy = new RetryPolicy({ baseDelay: 100, multiplier: 3, maxDelay: 100000 });
      expect(policy.getDelay(0)).toBe(100);
      expect(policy.getDelay(1)).toBe(300);
      expect(policy.getDelay(2)).toBe(900);
    });
  });

  describe('shouldRetry', () => {
    it('should return true when under max retries', () => {
      const policy = new RetryPolicy({ maxRetries: 3 });
      expect(policy.shouldRetry(0)).toBe(true);
      expect(policy.shouldRetry(1)).toBe(true);
      expect(policy.shouldRetry(2)).toBe(true);
    });

    it('should return false when at or above max retries', () => {
      const policy = new RetryPolicy({ maxRetries: 3 });
      expect(policy.shouldRetry(3)).toBe(false);
      expect(policy.shouldRetry(4)).toBe(false);
    });

    it('should return false when maxRetries is 0', () => {
      const policy = new RetryPolicy({ maxRetries: 0 });
      expect(policy.shouldRetry(0)).toBe(false);
    });
  });

  describe('getMaxRetries', () => {
    it('should return configured max retries', () => {
      const policy = new RetryPolicy({ maxRetries: 5 });
      expect(policy.getMaxRetries()).toBe(5);
    });
  });

  describe('getConfig', () => {
    it('should return a copy of the config', () => {
      const policy = new RetryPolicy({ baseDelay: 500 });
      const config = policy.getConfig();
      expect(config.baseDelay).toBe(500);
      expect(config.multiplier).toBe(2); // default
    });
  });
});
