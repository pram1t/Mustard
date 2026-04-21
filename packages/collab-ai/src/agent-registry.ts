/**
 * Agent registry for OpenAgent Collab.
 *
 * Owns the lifecycle of registered AI agents in a room: who's present,
 * what status they're in, and per-agent rate-limit proxying.
 *
 * Design choices (deliberate, documented):
 *   - One shared RateLimiter internally. The limiter already scopes
 *     counts per-agent-per-action via its own Map; a second layer would
 *     be duplication. Per-agent limit *overrides* are out of scope for
 *     Phase 5 — the `rateLimits` field on a registered agent is
 *     descriptive, not enforcing. If a consumer needs agent-specific
 *     limits, fork to `Map<agentId, RateLimiter>`.
 *   - No internal timers. Health-sweep is explicit via
 *     markStaleAsError() — call it from the room loop that already has
 *     a tick. This keeps tests deterministic and avoids zombie
 *     intervals that survive beyond destroy().
 */

import type {
  RegisteredAgent,
  AgentStatus,
  RateLimiterConfig,
  RateLimitStatus,
} from './types.js';
import { DEFAULT_AI_RATE_LIMITS } from './types.js';
import { RateLimiter } from './rate-limiter.js';

// ============================================================================
// Config
// ============================================================================

export interface AgentRegistryConfig {
  /** Max concurrent registered agents. Default: 8. */
  maxAgents?: number;

  /**
   * Limits passed to the internal RateLimiter. Applies to all agents
   * (shared limiter). Defaults to DEFAULT_AI_RATE_LIMITS.
   */
  defaultRateLimits?: Record<string, RateLimiterConfig>;

  /**
   * How long an agent may go without `touch()` before markStaleAsError()
   * will flip it to 'error'. Default: 120_000 ms.
   */
  healthTimeoutMs?: number;
}

export interface AgentRegisterInput {
  id: string;
  name: string;
  model: string;
  provider: string;
  /** Optional allow-list of action names. Empty/undefined means all allowed. */
  allowedActions?: string[];
  /**
   * Descriptive per-agent rate limits. NOT enforced by this registry
   * in Phase 5 — kept for UI display and future per-agent enforcement.
   */
  rateLimits?: Record<string, RateLimiterConfig>;
}

type RegistryEvent = 'registered' | 'unregistered' | 'status_changed';

// ============================================================================
// AgentRegistry
// ============================================================================

const DEFAULT_MAX_AGENTS = 8;
const DEFAULT_HEALTH_TIMEOUT_MS = 120_000;

export class AgentRegistry {
  private readonly agents = new Map<string, RegisteredAgent>();
  private readonly listeners = new Map<
    RegistryEvent,
    Set<(agent: RegisteredAgent) => void>
  >();
  private readonly limiter: RateLimiter;
  private readonly maxAgents: number;
  private readonly healthTimeoutMs: number;

  constructor(config: AgentRegistryConfig = {}) {
    this.maxAgents = config.maxAgents ?? DEFAULT_MAX_AGENTS;
    this.healthTimeoutMs = config.healthTimeoutMs ?? DEFAULT_HEALTH_TIMEOUT_MS;
    this.limiter = new RateLimiter(
      config.defaultRateLimits ?? { ...DEFAULT_AI_RATE_LIMITS },
    );
  }

  // --------------------------------------------------------------------------
  // Lifecycle
  // --------------------------------------------------------------------------

  /**
   * Register a new agent. Throws if the id already exists or if maxAgents
   * would be exceeded.
   */
  register(input: AgentRegisterInput): RegisteredAgent {
    if (this.agents.has(input.id)) {
      throw new Error(`Agent already registered: ${input.id}`);
    }
    if (this.agents.size >= this.maxAgents) {
      throw new Error(
        `Cannot register agent ${input.id}: maxAgents (${this.maxAgents}) reached`,
      );
    }

    const now = Date.now();
    const agent: RegisteredAgent = {
      id: input.id,
      name: input.name,
      model: input.model,
      provider: input.provider,
      status: 'initializing',
      allowedActions: input.allowedActions ?? [],
      rateLimits: input.rateLimits ?? { ...DEFAULT_AI_RATE_LIMITS },
      registeredAt: now,
      lastActivity: now,
    };
    this.agents.set(agent.id, agent);
    this.emit('registered', agent);
    return agent;
  }

  /** Unregister an agent. Also clears its rate-limit window. No-op if absent. */
  unregister(id: string): void {
    const agent = this.agents.get(id);
    if (!agent) return;
    this.agents.delete(id);
    this.limiter.resetAgent(id);
    this.emit('unregistered', agent);
  }

  // --------------------------------------------------------------------------
  // Queries
  // --------------------------------------------------------------------------

  get(id: string): RegisteredAgent | undefined {
    return this.agents.get(id);
  }

  list(filter?: { status?: AgentStatus }): RegisteredAgent[] {
    const all = Array.from(this.agents.values());
    return filter?.status ? all.filter(a => a.status === filter.status) : all;
  }

  has(id: string): boolean {
    return this.agents.has(id);
  }

  size(): number {
    return this.agents.size;
  }

  // --------------------------------------------------------------------------
  // Status
  // --------------------------------------------------------------------------

  /**
   * Set an agent's status. Returns the previous status. Emits a
   * 'status_changed' event with the updated agent record. Throws on
   * unknown id.
   */
  setStatus(id: string, status: AgentStatus): AgentStatus {
    const agent = this.agents.get(id);
    if (!agent) throw new Error(`Agent not found: ${id}`);
    const previous = agent.status;
    if (previous === status) return previous;

    const updated: RegisteredAgent = {
      ...agent,
      status,
      lastActivity: Date.now(),
    };
    this.agents.set(id, updated);
    this.emit('status_changed', updated);
    return previous;
  }

  /** Bump lastActivity without changing status. No-op on unknown id. */
  touch(id: string): void {
    const agent = this.agents.get(id);
    if (!agent) return;
    this.agents.set(id, { ...agent, lastActivity: Date.now() });
  }

  // --------------------------------------------------------------------------
  // Rate limiting (proxy to shared RateLimiter)
  // --------------------------------------------------------------------------

  /**
   * Check and consume a rate-limit slot for this agent + action.
   * Returns false if the agent is unknown or rate-limited.
   */
  tryConsume(agentId: string, actionType: string): boolean {
    if (!this.agents.has(agentId)) return false;
    return this.limiter.tryConsume(agentId, actionType);
  }

  /**
   * Inspect rate-limit status for an agent + action without consuming.
   * Unknown agents return `isLimited: true` so callers treat them as
   * blocked rather than unlimited.
   */
  getLimitStatus(agentId: string, actionType: string): RateLimitStatus {
    if (!this.agents.has(agentId)) {
      return { remaining: 0, resetAt: 0, isLimited: true };
    }
    return this.limiter.getStatus(agentId, actionType);
  }

  // --------------------------------------------------------------------------
  // Health
  // --------------------------------------------------------------------------

  /**
   * Flip agents whose lastActivity is older than healthTimeoutMs to
   * 'error' status. Emits 'status_changed' for each affected agent.
   * Returns the ids of agents that were marked stale.
   *
   * The `now` argument is mainly for deterministic testing; defaults to
   * Date.now().
   */
  markStaleAsError(now: number = Date.now()): string[] {
    const cutoff = now - this.healthTimeoutMs;
    const affected: string[] = [];
    for (const agent of this.agents.values()) {
      if (agent.status === 'error' || agent.status === 'disconnected') continue;
      if (agent.lastActivity < cutoff) {
        this.setStatus(agent.id, 'error');
        affected.push(agent.id);
      }
    }
    return affected;
  }

  // --------------------------------------------------------------------------
  // Events
  // --------------------------------------------------------------------------

  on(event: RegistryEvent, fn: (agent: RegisteredAgent) => void): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(fn);
    return () => this.listeners.get(event)?.delete(fn);
  }

  // --------------------------------------------------------------------------
  // Reset
  // --------------------------------------------------------------------------

  /** Remove all agents and clear rate-limit state. */
  clear(): void {
    this.agents.clear();
    this.limiter.clear();
  }

  // --------------------------------------------------------------------------
  // Internal
  // --------------------------------------------------------------------------

  private emit(event: RegistryEvent, agent: RegisteredAgent): void {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const fn of set) {
      try {
        fn(agent);
      } catch {
        /* swallow — match IntentEngine.emit behavior */
      }
    }
  }
}
