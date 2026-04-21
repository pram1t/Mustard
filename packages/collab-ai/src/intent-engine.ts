/**
 * Intent engine for OpenAgent Collab.
 *
 * Manages AI intent lifecycle:
 *   pending → approved → executing → completed/failed
 *   pending → rejected
 *   any → invalidated
 */

import { randomUUID } from 'node:crypto';
import type {
  Intent,
  IntentType,
  IntentAction,
  IntentStatus,
  RiskLevel,
} from './types.js';
import { shouldAutoApprove, type AutoApprovalPolicy } from './auto-approval.js';

// ============================================================================
// IntentEngine
// ============================================================================

/**
 * Options for the IntentEngine constructor.
 */
export interface IntentEngineOptions {
  /**
   * Optional auto-approval policy. When provided and `enabled`, newly
   * proposed intents that match the policy are immediately transitioned to
   * `approved` in the same synchronous frame as `propose()`.
   *
   * Observers will see the event sequence: `proposed` → `approved`.
   */
  autoApproval?: AutoApprovalPolicy;
}

/**
 * Manages AI intents — proposed actions that require approval.
 */
export class IntentEngine {
  private readonly intents = new Map<string, Intent>();
  private readonly listeners = new Map<string, Set<(intent: Intent) => void>>();
  private readonly autoApproval?: AutoApprovalPolicy;

  constructor(options: IntentEngineOptions = {}) {
    this.autoApproval = options.autoApproval;
  }

  // --------------------------------------------------------------------------
  // CRUD
  // --------------------------------------------------------------------------

  /**
   * Propose a new intent.
   *
   * If an auto-approval policy is configured and the intent matches,
   * it is auto-approved in the same synchronous frame.
   */
  propose(opts: {
    agentId: string;
    summary: string;
    type: IntentType;
    action: IntentAction;
    rationale: string;
    confidence: number;
    risk: RiskLevel;
  }): Intent {
    const intent: Intent = {
      id: randomUUID(),
      agentId: opts.agentId,
      summary: opts.summary,
      type: opts.type,
      action: opts.action,
      rationale: opts.rationale,
      confidence: opts.confidence,
      risk: opts.risk,
      status: 'pending',
      createdAt: Date.now(),
    };

    this.intents.set(intent.id, intent);
    this.emit('proposed', intent);

    if (this.autoApproval && shouldAutoApprove(intent, this.autoApproval)) {
      return this.approve(intent.id, this.autoApproval.approverIdentity);
    }

    return intent;
  }

  /** Get an intent by ID. */
  get(id: string): Intent | undefined {
    return this.intents.get(id);
  }

  /** List all intents, optionally filtered. */
  list(filter?: { agentId?: string; status?: IntentStatus }): Intent[] {
    let results = Array.from(this.intents.values());
    if (filter?.agentId) {
      results = results.filter(i => i.agentId === filter.agentId);
    }
    if (filter?.status) {
      results = results.filter(i => i.status === filter.status);
    }
    return results.sort((a, b) => b.createdAt - a.createdAt);
  }

  /** Count intents by status. */
  countByStatus(): Record<IntentStatus, number> {
    const counts: Record<string, number> = {
      pending: 0,
      approved: 0,
      rejected: 0,
      executing: 0,
      completed: 0,
      failed: 0,
      invalidated: 0,
    };
    for (const intent of this.intents.values()) {
      counts[intent.status]++;
    }
    return counts as Record<IntentStatus, number>;
  }

  // --------------------------------------------------------------------------
  // State Transitions
  // --------------------------------------------------------------------------

  /** Approve a pending intent. */
  approve(id: string, approvedBy: string): Intent {
    return this.transition(id, 'pending', 'approved', { resolvedBy: approvedBy, resolvedAt: Date.now() });
  }

  /** Reject a pending intent. */
  reject(id: string, rejectedBy: string, reason: string): Intent {
    return this.transition(id, 'pending', 'rejected', {
      resolvedBy: rejectedBy,
      resolvedAt: Date.now(),
      rejectionReason: reason,
    });
  }

  /** Mark an approved intent as executing. */
  startExecution(id: string): Intent {
    return this.transition(id, 'approved', 'executing');
  }

  /** Mark an executing intent as completed. */
  complete(id: string): Intent {
    return this.transition(id, 'executing', 'completed', { resolvedAt: Date.now() });
  }

  /** Mark an executing intent as failed. */
  fail(id: string, reason: string): Intent {
    return this.transition(id, 'executing', 'failed', {
      resolvedAt: Date.now(),
      rejectionReason: reason,
    });
  }

  /** Invalidate any non-terminal intent. */
  invalidate(id: string, reason: string): Intent {
    const intent = this.intents.get(id);
    if (!intent) throw new Error(`Intent not found: ${id}`);
    if (['completed', 'failed', 'rejected', 'invalidated'].includes(intent.status)) {
      throw new Error(`Cannot invalidate intent in ${intent.status} status`);
    }
    const updated: Intent = {
      ...intent,
      status: 'invalidated',
      resolvedAt: Date.now(),
      rejectionReason: reason,
    };
    this.intents.set(id, updated);
    this.emit('invalidated', updated);
    return updated;
  }

  // --------------------------------------------------------------------------
  // Cleanup
  // --------------------------------------------------------------------------

  /** Remove all terminal intents older than maxAge (ms). */
  purgeOld(maxAgeMs: number): number {
    const cutoff = Date.now() - maxAgeMs;
    let count = 0;
    for (const [id, intent] of this.intents) {
      if (['completed', 'failed', 'rejected', 'invalidated'].includes(intent.status)) {
        if (intent.createdAt < cutoff) {
          this.intents.delete(id);
          count++;
        }
      }
    }
    return count;
  }

  /** Clear all intents. */
  clear(): void {
    this.intents.clear();
  }

  // --------------------------------------------------------------------------
  // Events
  // --------------------------------------------------------------------------

  on(event: string, fn: (intent: Intent) => void): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(fn);
    return () => this.listeners.get(event)?.delete(fn);
  }

  // --------------------------------------------------------------------------
  // Internal
  // --------------------------------------------------------------------------

  private transition(
    id: string,
    expectedStatus: IntentStatus,
    newStatus: IntentStatus,
    updates?: Partial<Intent>,
  ): Intent {
    const intent = this.intents.get(id);
    if (!intent) throw new Error(`Intent not found: ${id}`);
    if (intent.status !== expectedStatus) {
      throw new Error(
        `Cannot transition from ${intent.status} to ${newStatus} (expected ${expectedStatus})`,
      );
    }
    const updated: Intent = { ...intent, ...updates, status: newStatus };
    this.intents.set(id, updated);
    this.emit(newStatus, updated);
    return updated;
  }

  private emit(event: string, intent: Intent): void {
    const set = this.listeners.get(event);
    if (set) {
      for (const fn of set) {
        try { fn(intent); } catch { /* swallow */ }
      }
    }
  }
}
