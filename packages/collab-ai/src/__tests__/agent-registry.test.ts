import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AgentRegistry } from '../agent-registry.js';
import type { RegisteredAgent, AgentStatus } from '../types.js';

type RegisterOverrides = Partial<Parameters<AgentRegistry['register']>[0]>;

function makeAgent(overrides?: RegisterOverrides) {
  return {
    id: 'agent-1',
    name: 'Agent One',
    model: 'gpt-4o',
    provider: 'openai',
    ...overrides,
  };
}

describe('AgentRegistry.register', () => {
  it('registers a new agent with initializing status', () => {
    const reg = new AgentRegistry();
    const agent = reg.register(makeAgent());

    expect(agent.id).toBe('agent-1');
    expect(agent.status).toBe('initializing');
    expect(agent.registeredAt).toBeGreaterThan(0);
    expect(agent.lastActivity).toBeGreaterThan(0);
    expect(reg.size()).toBe(1);
    expect(reg.has('agent-1')).toBe(true);
  });

  it('emits a registered event', () => {
    const reg = new AgentRegistry();
    const events: RegisteredAgent[] = [];
    reg.on('registered', a => events.push(a));

    reg.register(makeAgent());

    expect(events).toHaveLength(1);
    expect(events[0].id).toBe('agent-1');
  });

  it('throws when registering a duplicate id', () => {
    const reg = new AgentRegistry();
    reg.register(makeAgent());
    expect(() => reg.register(makeAgent())).toThrow(/already registered/);
  });

  it('throws when exceeding maxAgents', () => {
    const reg = new AgentRegistry({ maxAgents: 2 });
    reg.register(makeAgent({ id: 'a1' }));
    reg.register(makeAgent({ id: 'a2' }));
    expect(() => reg.register(makeAgent({ id: 'a3' }))).toThrow(
      /maxAgents/,
    );
  });

  it('accepts custom allowedActions and rateLimits', () => {
    const reg = new AgentRegistry();
    const agent = reg.register(
      makeAgent({
        allowedActions: ['read'],
        rateLimits: {
          read: { maxOperations: 2, windowMs: 1000, cooldownMs: 5000 },
        },
      }),
    );
    expect(agent.allowedActions).toEqual(['read']);
    expect(agent.rateLimits.read.maxOperations).toBe(2);
  });
});

describe('AgentRegistry.unregister', () => {
  it('removes the agent and emits unregistered', () => {
    const reg = new AgentRegistry();
    const agent = reg.register(makeAgent());
    const events: RegisteredAgent[] = [];
    reg.on('unregistered', a => events.push(a));

    reg.unregister(agent.id);

    expect(reg.has('agent-1')).toBe(false);
    expect(events).toHaveLength(1);
  });

  it('is a no-op for unknown id', () => {
    const reg = new AgentRegistry();
    expect(() => reg.unregister('nope')).not.toThrow();
  });

  it('resets rate-limit state for that agent', () => {
    const reg = new AgentRegistry({
      defaultRateLimits: {
        read: { maxOperations: 1, windowMs: 60_000, cooldownMs: 60_000 },
      },
    });
    reg.register(makeAgent({ id: 'a1' }));
    expect(reg.tryConsume('a1', 'read')).toBe(true);
    expect(reg.tryConsume('a1', 'read')).toBe(false);

    reg.unregister('a1');
    reg.register(makeAgent({ id: 'a1' }));
    // After re-register the limiter should have forgotten the prior hit
    expect(reg.tryConsume('a1', 'read')).toBe(true);
  });
});

describe('AgentRegistry.list and filter', () => {
  it('returns all agents when no filter is given', () => {
    const reg = new AgentRegistry();
    reg.register(makeAgent({ id: 'a1' }));
    reg.register(makeAgent({ id: 'a2' }));
    expect(reg.list()).toHaveLength(2);
  });

  it('filters by status', () => {
    const reg = new AgentRegistry();
    reg.register(makeAgent({ id: 'a1' }));
    reg.register(makeAgent({ id: 'a2' }));
    reg.setStatus('a1', 'thinking');

    const thinking = reg.list({ status: 'thinking' });
    const initializing = reg.list({ status: 'initializing' });
    expect(thinking).toHaveLength(1);
    expect(initializing).toHaveLength(1);
  });
});

describe('AgentRegistry.setStatus', () => {
  it('updates status and returns the previous value', () => {
    const reg = new AgentRegistry();
    reg.register(makeAgent());
    const previous = reg.setStatus('agent-1', 'thinking');
    expect(previous).toBe('initializing');
    expect(reg.get('agent-1')?.status).toBe('thinking');
  });

  it('emits status_changed with the updated agent', () => {
    const reg = new AgentRegistry();
    reg.register(makeAgent());
    const events: RegisteredAgent[] = [];
    reg.on('status_changed', a => events.push(a));

    reg.setStatus('agent-1', 'executing');
    expect(events).toHaveLength(1);
    expect(events[0].status).toBe('executing');
  });

  it('is a no-op (and emits nothing) when status is unchanged', () => {
    const reg = new AgentRegistry();
    reg.register(makeAgent());
    const events: RegisteredAgent[] = [];
    reg.on('status_changed', a => events.push(a));

    const previous = reg.setStatus('agent-1', 'initializing');
    expect(previous).toBe('initializing');
    expect(events).toHaveLength(0);
  });

  it('throws on unknown id', () => {
    const reg = new AgentRegistry();
    expect(() => reg.setStatus('nope', 'idle')).toThrow(/not found/);
  });
});

describe('AgentRegistry rate limiting proxy', () => {
  it('tryConsume returns false for unknown agent', () => {
    const reg = new AgentRegistry();
    expect(reg.tryConsume('ghost', 'file_read')).toBe(false);
  });

  it('tryConsume consumes from the shared limiter', () => {
    const reg = new AgentRegistry({
      defaultRateLimits: {
        read: { maxOperations: 1, windowMs: 60_000, cooldownMs: 60_000 },
      },
    });
    reg.register(makeAgent());
    expect(reg.tryConsume('agent-1', 'read')).toBe(true);
    expect(reg.tryConsume('agent-1', 'read')).toBe(false);
  });

  it('getLimitStatus reports isLimited=true for unknown agents', () => {
    const reg = new AgentRegistry();
    const status = reg.getLimitStatus('ghost', 'read');
    expect(status.isLimited).toBe(true);
    expect(status.remaining).toBe(0);
  });

  it('getLimitStatus delegates to the shared limiter for known agents', () => {
    const reg = new AgentRegistry({
      defaultRateLimits: {
        read: { maxOperations: 3, windowMs: 60_000, cooldownMs: 60_000 },
      },
    });
    reg.register(makeAgent());
    expect(reg.getLimitStatus('agent-1', 'read').remaining).toBe(3);
    reg.tryConsume('agent-1', 'read');
    expect(reg.getLimitStatus('agent-1', 'read').remaining).toBe(2);
  });
});

describe('AgentRegistry.touch and markStaleAsError', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('touch bumps lastActivity', () => {
    const reg = new AgentRegistry();
    reg.register(makeAgent());
    const before = reg.get('agent-1')!.lastActivity;

    vi.advanceTimersByTime(5_000);
    reg.touch('agent-1');

    const after = reg.get('agent-1')!.lastActivity;
    expect(after).toBeGreaterThan(before);
  });

  it('touch is a no-op for unknown id', () => {
    const reg = new AgentRegistry();
    expect(() => reg.touch('ghost')).not.toThrow();
  });

  it('markStaleAsError flips stale agents to error status', () => {
    const reg = new AgentRegistry({ healthTimeoutMs: 10_000 });
    reg.register(makeAgent({ id: 'a1' }));
    reg.register(makeAgent({ id: 'a2' }));

    vi.advanceTimersByTime(5_000);
    reg.touch('a2');
    vi.advanceTimersByTime(6_000);

    const affected = reg.markStaleAsError();
    expect(affected).toEqual(['a1']);
    expect(reg.get('a1')?.status).toBe('error');
    expect(reg.get('a2')?.status).toBe('initializing');
  });

  it('ignores agents already in error or disconnected', () => {
    const reg = new AgentRegistry({ healthTimeoutMs: 1_000 });
    reg.register(makeAgent({ id: 'a1' }));
    reg.register(makeAgent({ id: 'a2' }));
    reg.setStatus('a1', 'error');
    reg.setStatus('a2', 'disconnected');

    vi.advanceTimersByTime(10_000);

    const affected = reg.markStaleAsError();
    expect(affected).toEqual([]);
  });
});

describe('AgentRegistry.clear', () => {
  it('removes all agents and clears rate-limit state', () => {
    const reg = new AgentRegistry();
    reg.register(makeAgent({ id: 'a1' }));
    reg.register(makeAgent({ id: 'a2' }));

    reg.clear();

    expect(reg.size()).toBe(0);
    expect(reg.list()).toEqual([]);
  });
});

describe('AgentRegistry listener lifecycle', () => {
  it('returns an unsubscribe function for on()', () => {
    const reg = new AgentRegistry();
    const events: RegisteredAgent[] = [];
    const unsub = reg.on('registered', a => events.push(a));

    reg.register(makeAgent({ id: 'a1' }));
    unsub();
    reg.register(makeAgent({ id: 'a2' }));

    expect(events).toHaveLength(1);
  });

  it('swallows listener errors', () => {
    const reg = new AgentRegistry();
    const ok: RegisteredAgent[] = [];
    reg.on('registered', () => {
      throw new Error('boom');
    });
    reg.on('registered', a => ok.push(a));

    expect(() => reg.register(makeAgent())).not.toThrow();
    expect(ok).toHaveLength(1);
  });
});
