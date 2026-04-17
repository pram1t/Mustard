/**
 * Rate limiter for AI agents in OpenAgent Collab.
 *
 * Sliding window rate limiting per agent per action type.
 */

import type { RateLimiterConfig, RateLimitStatus } from './types.js';
import { DEFAULT_AI_RATE_LIMITS } from './types.js';

// ============================================================================
// RateLimiter
// ============================================================================

export class RateLimiter {
  /** agentId → actionType → timestamps[] */
  private readonly windows = new Map<string, Map<string, number[]>>();
  /** agentId → actionType → cooldownUntil */
  private readonly cooldowns = new Map<string, Map<string, number>>();
  private readonly limits: Record<string, RateLimiterConfig>;

  constructor(limits?: Record<string, RateLimiterConfig>) {
    this.limits = limits ?? { ...DEFAULT_AI_RATE_LIMITS };
  }

  // --------------------------------------------------------------------------
  // Check & Record
  // --------------------------------------------------------------------------

  /**
   * Check if an action is allowed and record it if so.
   *
   * @returns true if allowed, false if rate-limited
   */
  tryConsume(agentId: string, actionType: string): boolean {
    const status = this.getStatus(agentId, actionType);
    if (status.isLimited) return false;

    // Record the action
    this.record(agentId, actionType);
    return true;
  }

  /**
   * Get the rate limit status for an agent + action.
   */
  getStatus(agentId: string, actionType: string): RateLimitStatus {
    const config = this.limits[actionType];
    if (!config) {
      return { remaining: Infinity, resetAt: 0, isLimited: false };
    }

    const now = Date.now();

    // Check cooldown
    const cooldownUntil = this.cooldowns.get(agentId)?.get(actionType) ?? 0;
    if (now < cooldownUntil) {
      return { remaining: 0, resetAt: cooldownUntil, isLimited: true };
    }

    // Count operations in current window
    const timestamps = this.getWindow(agentId, actionType);
    const windowStart = now - config.windowMs;
    const inWindow = timestamps.filter(t => t > windowStart);
    const remaining = Math.max(0, config.maxOperations - inWindow.length);

    return {
      remaining,
      resetAt: inWindow.length > 0 ? inWindow[0] + config.windowMs : now + config.windowMs,
      isLimited: remaining <= 0,
    };
  }

  // --------------------------------------------------------------------------
  // Management
  // --------------------------------------------------------------------------

  /** Clear all rate limit state for an agent. */
  resetAgent(agentId: string): void {
    this.windows.delete(agentId);
    this.cooldowns.delete(agentId);
  }

  /** Clear all rate limit state. */
  clear(): void {
    this.windows.clear();
    this.cooldowns.clear();
  }

  /** Get configured limits. */
  getLimits(): Record<string, RateLimiterConfig> {
    return { ...this.limits };
  }

  // --------------------------------------------------------------------------
  // Internal
  // --------------------------------------------------------------------------

  private record(agentId: string, actionType: string): void {
    const now = Date.now();
    const timestamps = this.getWindow(agentId, actionType);
    timestamps.push(now);

    // Clean old entries
    const config = this.limits[actionType];
    if (config) {
      const windowStart = now - config.windowMs;
      const active = timestamps.filter(t => t > windowStart);
      this.setWindow(agentId, actionType, active);

      // Start cooldown if limit is hit
      if (active.length >= config.maxOperations) {
        if (!this.cooldowns.has(agentId)) {
          this.cooldowns.set(agentId, new Map());
        }
        this.cooldowns.get(agentId)!.set(actionType, now + config.cooldownMs);
      }
    }
  }

  private getWindow(agentId: string, actionType: string): number[] {
    return this.windows.get(agentId)?.get(actionType) ?? [];
  }

  private setWindow(agentId: string, actionType: string, timestamps: number[]): void {
    if (!this.windows.has(agentId)) {
      this.windows.set(agentId, new Map());
    }
    this.windows.get(agentId)!.set(actionType, timestamps);
  }
}
