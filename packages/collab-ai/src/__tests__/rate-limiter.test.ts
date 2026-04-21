import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RateLimiter } from '../rate-limiter.js';
import type { RateLimiterConfig } from '../types.js';

const AGENT = 'agent-1';

function config(over?: Partial<RateLimiterConfig>): RateLimiterConfig {
  return {
    maxOperations: 3,
    windowMs: 60_000,
    cooldownMs: 10_000,
    ...over,
  };
}

describe('RateLimiter.tryConsume', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('allows up to maxOperations in a window', () => {
    const rl = new RateLimiter({ read: config({ maxOperations: 3 }) });

    expect(rl.tryConsume(AGENT, 'read')).toBe(true);
    expect(rl.tryConsume(AGENT, 'read')).toBe(true);
    expect(rl.tryConsume(AGENT, 'read')).toBe(true);
  });

  it('blocks the call that hits the limit', () => {
    const rl = new RateLimiter({ read: config({ maxOperations: 2 }) });
    rl.tryConsume(AGENT, 'read');
    rl.tryConsume(AGENT, 'read');
    expect(rl.tryConsume(AGENT, 'read')).toBe(false);
  });

  it('enforces cooldown after the limit is hit', () => {
    const rl = new RateLimiter({
      read: config({ maxOperations: 1, cooldownMs: 30_000, windowMs: 5_000 }),
    });
    rl.tryConsume(AGENT, 'read');
    expect(rl.tryConsume(AGENT, 'read')).toBe(false);

    // Window would have passed — but cooldown still blocks us
    vi.advanceTimersByTime(6_000);
    expect(rl.tryConsume(AGENT, 'read')).toBe(false);

    // Past cooldown — allowed again
    vi.advanceTimersByTime(25_000);
    expect(rl.tryConsume(AGENT, 'read')).toBe(true);
  });

  it('treats unknown actions as unlimited', () => {
    const rl = new RateLimiter({ read: config() });
    for (let i = 0; i < 100; i++) {
      expect(rl.tryConsume(AGENT, 'unknown')).toBe(true);
    }
  });

  it('scopes counts per-agent', () => {
    const rl = new RateLimiter({ read: config({ maxOperations: 1 }) });
    expect(rl.tryConsume('a1', 'read')).toBe(true);
    expect(rl.tryConsume('a2', 'read')).toBe(true);
  });

  it('scopes counts per action type', () => {
    const rl = new RateLimiter({
      read: config({ maxOperations: 1 }),
      write: config({ maxOperations: 1 }),
    });
    expect(rl.tryConsume(AGENT, 'read')).toBe(true);
    expect(rl.tryConsume(AGENT, 'write')).toBe(true);
  });

  it('slides the window as time advances', () => {
    const rl = new RateLimiter({
      read: config({ maxOperations: 2, windowMs: 10_000, cooldownMs: 0 }),
    });
    rl.tryConsume(AGENT, 'read');
    rl.tryConsume(AGENT, 'read');
    expect(rl.tryConsume(AGENT, 'read')).toBe(false);

    // Advance past the window — older timestamps expire
    vi.advanceTimersByTime(10_001);
    expect(rl.tryConsume(AGENT, 'read')).toBe(true);
  });
});

describe('RateLimiter.getStatus', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('reports remaining budget on unused actions', () => {
    const rl = new RateLimiter({ read: config({ maxOperations: 5 }) });
    const s = rl.getStatus(AGENT, 'read');
    expect(s.remaining).toBe(5);
    expect(s.isLimited).toBe(false);
  });

  it('decrements remaining after consumption', () => {
    const rl = new RateLimiter({ read: config({ maxOperations: 5 }) });
    rl.tryConsume(AGENT, 'read');
    rl.tryConsume(AGENT, 'read');
    expect(rl.getStatus(AGENT, 'read').remaining).toBe(3);
  });

  it('reports Infinity + not limited for unknown actions', () => {
    const rl = new RateLimiter({});
    const s = rl.getStatus(AGENT, 'nope');
    expect(s.remaining).toBe(Infinity);
    expect(s.isLimited).toBe(false);
  });

  it('reports isLimited during cooldown', () => {
    const rl = new RateLimiter({
      read: config({ maxOperations: 1, cooldownMs: 10_000 }),
    });
    rl.tryConsume(AGENT, 'read');
    rl.tryConsume(AGENT, 'read'); // triggers cooldown

    const status = rl.getStatus(AGENT, 'read');
    expect(status.isLimited).toBe(true);
    expect(status.remaining).toBe(0);
    expect(status.resetAt).toBeGreaterThan(Date.now());
  });
});

describe('RateLimiter management', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('resetAgent clears window and cooldown for that agent', () => {
    const rl = new RateLimiter({
      read: config({ maxOperations: 1, cooldownMs: 60_000 }),
    });
    rl.tryConsume(AGENT, 'read');
    rl.tryConsume(AGENT, 'read');
    expect(rl.tryConsume(AGENT, 'read')).toBe(false);

    rl.resetAgent(AGENT);
    expect(rl.tryConsume(AGENT, 'read')).toBe(true);
  });

  it('clear wipes all state', () => {
    const rl = new RateLimiter({ read: config({ maxOperations: 1 }) });
    rl.tryConsume('a1', 'read');
    rl.tryConsume('a2', 'read');

    rl.clear();
    expect(rl.tryConsume('a1', 'read')).toBe(true);
    expect(rl.tryConsume('a2', 'read')).toBe(true);
  });

  it('getLimits returns a defensive copy', () => {
    const rl = new RateLimiter({ read: config({ maxOperations: 3 }) });
    const limits = rl.getLimits();
    delete (limits as Record<string, unknown>).read;
    expect(rl.getLimits().read).toBeDefined();
  });

  it('uses DEFAULT_AI_RATE_LIMITS when no config is supplied', () => {
    const rl = new RateLimiter();
    expect(rl.getLimits().file_read).toBeDefined();
    expect(rl.getLimits().file_edit).toBeDefined();
  });
});
