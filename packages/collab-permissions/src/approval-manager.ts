/**
 * ApprovalManager — owns the lifecycle of ApprovalRequest records.
 *
 * Each request has up to two timers:
 *   - countdown timer: fires `onAutoApprove(request)` if no human acts first
 *     (used by auto-mode with non-zero countdownSec)
 *   - timeout timer: fires `onTimeout(request)` when the overall approval
 *     window elapses (used for manual-approval flows)
 *
 * Only one timer is ever active at a time per request. Countdown is
 * scheduled if `countdownSec > 0`; otherwise the timeout timer runs for
 * `timeoutSec`. Both reach a terminal status through the same finalize
 * path so that state transitions stay simple.
 *
 * All times are in seconds on the public API; internally converted to ms.
 */

import { randomUUID } from 'node:crypto';
import type { ApprovalRequest, ApprovalStatus } from './types.js';

// ============================================================================
// Events
// ============================================================================

export type ApprovalEventName =
  | 'created'
  | 'approved'
  | 'rejected'
  | 'auto_approved'
  | 'expired';

type Listener = (req: ApprovalRequest) => void;

// ============================================================================
// Config
// ============================================================================

export interface ApprovalManagerOptions {
  /** Seconds → ms multiplier. Tests can override for speed, though fake
   * timers are the canonical approach. Default: 1000. */
  secondsToMs?: number;
}

export interface OpenApprovalInput {
  /** Intent id this approval is for. */
  intentId: string;
  /**
   * Countdown seconds before auto-approval. 0 = no auto-approval; use
   * `timeoutSec` instead to bound the manual-approval window.
   */
  countdownSec: number;
  /** Overall timeout in seconds; 0 = no timeout. */
  timeoutSec: number;
  /** Who must approve. Empty array allowed (any single approver). */
  requiredApprovers?: string[];
  /** How many approvals are required before the request transitions. */
  requiredApprovalsCount?: number;
}

// ============================================================================
// ApprovalManager
// ============================================================================

export class ApprovalManager {
  private readonly requests = new Map<string, ApprovalRequest>();
  private readonly timers = new Map<string, NodeJS.Timeout>();
  private readonly timerMode = new Map<string, 'countdown' | 'timeout'>();
  private readonly requiredCounts = new Map<string, number>();
  private readonly listeners = new Map<ApprovalEventName, Set<Listener>>();
  private readonly secondsToMs: number;

  constructor(options: ApprovalManagerOptions = {}) {
    this.secondsToMs = options.secondsToMs ?? 1000;
  }

  // --------------------------------------------------------------------------
  // Open / query
  // --------------------------------------------------------------------------

  /**
   * Create a new approval request. Schedules a countdown timer if
   * `countdownSec > 0`; otherwise a timeout timer if `timeoutSec > 0`.
   */
  open(input: OpenApprovalInput): ApprovalRequest {
    const req: ApprovalRequest = {
      id: randomUUID(),
      intentId: input.intentId,
      requiredApprovers: input.requiredApprovers ?? [],
      approvals: [],
      autoApproveCountdown: input.countdownSec,
      status: 'waiting',
      createdAt: Date.now(),
    };
    this.requests.set(req.id, req);
    this.requiredCounts.set(req.id, input.requiredApprovalsCount ?? 1);

    if (input.countdownSec > 0) {
      this.scheduleCountdown(req.id, input.countdownSec);
    } else if (input.timeoutSec > 0) {
      this.scheduleTimeout(req.id, input.timeoutSec);
    }

    this.emit('created', req);
    return this.snapshot(req);
  }

  /** Fetch a request by id, or `undefined`. */
  get(id: string): ApprovalRequest | undefined {
    const r = this.requests.get(id);
    return r ? this.snapshot(r) : undefined;
  }

  /** List all requests, optionally filtered by status. */
  list(filter?: { status?: ApprovalStatus }): ApprovalRequest[] {
    const all = Array.from(this.requests.values()).map(r => this.snapshot(r));
    return filter?.status ? all.filter(r => r.status === filter.status) : all;
  }

  /** Produce a defensive copy including nested arrays. */
  private snapshot(r: ApprovalRequest): ApprovalRequest {
    return {
      ...r,
      requiredApprovers: [...r.requiredApprovers],
      approvals: [...r.approvals],
    };
  }

  /** Number of requests currently in the 'waiting' state. */
  waitingCount(): number {
    let n = 0;
    for (const r of this.requests.values()) if (r.status === 'waiting') n++;
    return n;
  }

  // --------------------------------------------------------------------------
  // Actions
  // --------------------------------------------------------------------------

  /**
   * Record an approval from `approver`. When the required count is reached
   * the request transitions to 'approved' and timers are cleared.
   */
  approve(id: string, approver: string): ApprovalRequest {
    const req = this.requireWaiting(id);
    if (!req.approvals.includes(approver)) {
      req.approvals = [...req.approvals, approver];
    }

    const threshold = this.requiredCounts.get(id) ?? 1;
    if (req.approvals.length >= threshold) {
      return this.finalize(id, 'approved', 'approved');
    }

    // Still waiting for more approvers — update the stored request.
    this.requests.set(id, req);
    return this.snapshot(req);
  }

  /** Reject a request. Clears timers and emits 'rejected'. */
  reject(id: string, _rejecter: string): ApprovalRequest {
    this.requireWaiting(id);
    return this.finalize(id, 'rejected', 'rejected');
  }

  /**
   * Cancel a request without a specific reason. Used when the intent is
   * invalidated by an external event (mode change, engine invalidate,
   * etc.). Emits 'rejected' like reject().
   */
  cancel(id: string): ApprovalRequest {
    this.requireWaiting(id);
    return this.finalize(id, 'rejected', 'rejected');
  }

  /** Clear all state. Tears down any outstanding timers. */
  clear(): void {
    for (const id of Array.from(this.timers.keys())) {
      this.clearTimer(id);
    }
    this.requests.clear();
    this.requiredCounts.clear();
  }

  /** Alias for `clear()` — matches the house convention for disposable objects. */
  destroy(): void {
    this.clear();
  }

  // --------------------------------------------------------------------------
  // Listeners
  // --------------------------------------------------------------------------

  on(event: ApprovalEventName, fn: Listener): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(fn);
    return () => this.listeners.get(event)?.delete(fn);
  }

  private emit(event: ApprovalEventName, req: ApprovalRequest): void {
    const set = this.listeners.get(event);
    if (!set) return;
    const snap = this.snapshot(req);
    for (const fn of set) {
      try {
        fn(snap);
      } catch {
        /* swallow */
      }
    }
  }

  // --------------------------------------------------------------------------
  // Internals
  // --------------------------------------------------------------------------

  private requireWaiting(id: string): ApprovalRequest {
    const req = this.requests.get(id);
    if (!req) throw new Error(`Approval request not found: ${id}`);
    if (req.status !== 'waiting') {
      throw new Error(
        `Approval request ${id} is already ${req.status}; cannot re-resolve.`,
      );
    }
    return req;
  }

  private scheduleCountdown(id: string, seconds: number): void {
    const handle = setTimeout(() => {
      this.finalize(id, 'auto_approved', 'auto_approved');
    }, seconds * this.secondsToMs);
    this.timers.set(id, handle);
    this.timerMode.set(id, 'countdown');
  }

  private scheduleTimeout(id: string, seconds: number): void {
    const handle = setTimeout(() => {
      this.finalize(id, 'expired', 'expired');
    }, seconds * this.secondsToMs);
    this.timers.set(id, handle);
    this.timerMode.set(id, 'timeout');
  }

  private clearTimer(id: string): void {
    const handle = this.timers.get(id);
    if (handle) clearTimeout(handle);
    this.timers.delete(id);
    this.timerMode.delete(id);
  }

  private finalize(
    id: string,
    status: ApprovalStatus,
    event: ApprovalEventName,
  ): ApprovalRequest {
    const req = this.requests.get(id);
    if (!req) throw new Error(`Approval request not found: ${id}`);
    this.clearTimer(id);

    const updated: ApprovalRequest = {
      ...req,
      status,
      resolvedAt: Date.now(),
    };
    this.requests.set(id, updated);
    this.emit(event, updated);
    return this.snapshot(updated);
  }
}
