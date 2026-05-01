/**
 * PermissionGateway — integration layer that bridges the IntentEngine
 * (from @pram1t/mustard-collab-ai) with this package's mode / risk /
 * approval primitives.
 *
 * Wiring model (one gateway per room):
 *
 *   IntentEngine.emit('proposed', intent)
 *       └─> Gateway listener (synchronous, same frame)
 *              ├─ RiskAssessor.assess(intent)
 *              ├─ modeManager.current()
 *              ├─ decide({mode, intent, assessment, sensitive})
 *              └─ act on decision:
 *                   - auto_approve   → engine.approve(id, approver)
 *                   - auto_reject    → engine.reject(id, approver, reason)
 *                   - hold_pending   → no-op (intent remains 'pending')
 *                   - require_approval → approvalManager.open(...)
 *                         (approval events then drive engine.approve/reject)
 *
 * The gateway is attached by calling `attach()`, which returns a disposer.
 * Existing bus adapters (from both packages) continue to fan-out events
 * in parallel; the gateway is an orthogonal sync pathway, not a
 * replacement.
 *
 * Mode changes invalidate any in-flight approval for that room: the
 * gateway listens for ModeManager 'changed' events and cancels every
 * waiting approval. The underlying intents are marked invalidated on
 * the engine so downstream consumers see the rejection.
 */

import type { Intent } from '@pram1t/mustard-collab-ai';
import type { IntentEngine } from '@pram1t/mustard-collab-ai';
import type {
  ApprovalPolicy,
  ApprovalRequest,
  ModeRules,
  RiskAssessment,
  SensitiveFileMatch,
} from './types.js';
import { DEFAULT_APPROVAL_POLICIES, DEFAULT_MODE_RULES } from './types.js';
import type { ModeManager } from './mode-manager.js';
import type { ApprovalManager } from './approval-manager.js';
import type { RiskAssessor } from './risk-assessor.js';
import type { SensitiveFileDetector } from './sensitive-files.js';
import { SensitiveFileDetector as DefaultDetector } from './sensitive-files.js';
import { RiskAssessor as DefaultAssessor } from './risk-assessor.js';
import { decide, type PermissionDecision } from './permission-checker.js';

// ============================================================================
// Options
// ============================================================================

export interface PermissionGatewayOptions {
  engine: IntentEngine;
  modeManager: ModeManager;
  approvalManager: ApprovalManager;

  /**
   * Optional risk assessor. If omitted, a fresh RiskAssessor is
   * constructed using DEFAULT_RISK_RULES + the provided (or default)
   * sensitive-file detector.
   */
  riskAssessor?: RiskAssessor;

  /** Optional sensitive-file detector. Only used if riskAssessor is omitted. */
  sensitiveFiles?: SensitiveFileDetector;

  /** Override rules / policies if you need to deviate from DEFAULT_*. */
  rules?: ModeRules;
  policies?: Record<string, ApprovalPolicy>;

  /** Identity strings stamped on engine.approve / engine.reject calls. */
  autoApprover?: string;
  manualApprover?: string;
  autoRejector?: string;

  /** Optional logger hook for debugging. Called with decision records. */
  onDecision?: (event: GatewayDecisionEvent) => void;
}

export interface GatewayDecisionEvent {
  intent: Intent;
  assessment: RiskAssessment;
  sensitive: SensitiveFileMatch | null;
  decision: PermissionDecision;
  approvalRequestId?: string;
}

// ============================================================================
// Gateway
// ============================================================================

export class PermissionGateway {
  private readonly engine: IntentEngine;
  private readonly modeManager: ModeManager;
  private readonly approvalManager: ApprovalManager;
  private readonly riskAssessor: RiskAssessor;
  private readonly sensitiveFiles: SensitiveFileDetector;
  private readonly rules: ModeRules;
  private readonly policies: Record<string, ApprovalPolicy>;
  private readonly autoApprover: string;
  private readonly manualApprover: string;
  private readonly autoRejector: string;
  private readonly onDecision?: (event: GatewayDecisionEvent) => void;

  /** request.id → intent.id */
  private readonly requestToIntent = new Map<string, string>();
  /** intent.id → request.id (reverse lookup for engine-side resolutions) */
  private readonly intentToRequest = new Map<string, string>();

  private disposers: Array<() => void> = [];
  private attached = false;

  constructor(options: PermissionGatewayOptions) {
    this.engine = options.engine;
    this.modeManager = options.modeManager;
    this.approvalManager = options.approvalManager;
    this.sensitiveFiles = options.sensitiveFiles ?? new DefaultDetector();
    this.riskAssessor =
      options.riskAssessor ??
      new DefaultAssessor({ sensitiveFiles: this.sensitiveFiles });
    this.rules = options.rules ?? DEFAULT_MODE_RULES;
    this.policies = options.policies ?? DEFAULT_APPROVAL_POLICIES;
    this.autoApprover = options.autoApprover ?? 'collab-permissions:auto';
    this.manualApprover = options.manualApprover ?? 'collab-permissions:approval';
    this.autoRejector = options.autoRejector ?? 'collab-permissions:auto';
    this.onDecision = options.onDecision;
  }

  // --------------------------------------------------------------------------
  // Attach / detach
  // --------------------------------------------------------------------------

  /** Attach the gateway to its dependencies. Returns a disposer. */
  attach(): () => void {
    if (this.attached) return () => this.detach();
    this.attached = true;

    this.disposers.push(
      this.engine.on('proposed', intent => this.handleProposed(intent)),
    );

    // If the engine resolves an intent through some other path (its own
    // auto-approval policy, a coordinator-level decision, etc.) we drop
    // any approval request we'd opened for it. Otherwise the approval
    // would linger as a zombie waiter.
    const dropOnResolve = (intent: Intent) =>
      this.dropRequestForIntent(intent.id);
    this.disposers.push(this.engine.on('approved', dropOnResolve));
    this.disposers.push(this.engine.on('rejected', dropOnResolve));
    this.disposers.push(this.engine.on('invalidated', dropOnResolve));

    this.disposers.push(
      this.approvalManager.on('approved', req => this.handleApproved(req)),
    );
    this.disposers.push(
      this.approvalManager.on('auto_approved', req => this.handleApproved(req)),
    );
    this.disposers.push(
      this.approvalManager.on('rejected', req => this.handleRejected(req)),
    );
    this.disposers.push(
      this.approvalManager.on('expired', req => this.handleRejected(req)),
    );
    this.disposers.push(
      this.modeManager.on('changed', () => this.handleModeChanged()),
    );

    return () => this.detach();
  }

  detach(): void {
    for (const d of this.disposers) {
      try {
        d();
      } catch {
        /* swallow */
      }
    }
    this.disposers = [];
    this.attached = false;
  }

  // --------------------------------------------------------------------------
  // Handlers
  // --------------------------------------------------------------------------

  private handleProposed(intent: Intent): void {
    // Don't reprocess intents that the engine (or an earlier listener like
    // auto-approval) already resolved.
    const current = this.engine.get(intent.id);
    if (!current || current.status !== 'pending') return;

    const assessment = this.riskAssessor.assess(intent);
    const sensitive = this.findSensitive(intent);
    const mode = this.modeManager.current();
    const decision = decide({
      mode,
      intent,
      assessment,
      sensitive,
      rules: this.rules,
      policies: this.policies as Record<
        Parameters<typeof decide>[0]['mode'],
        ApprovalPolicy
      >,
      autoApprover: this.autoApprover,
    });

    let approvalRequestId: string | undefined;

    switch (decision.kind) {
      case 'auto_approve':
        this.safeApprove(intent.id, decision.approver);
        break;
      case 'auto_reject':
        this.safeReject(intent.id, this.autoRejector, decision.reason);
        break;
      case 'hold_pending':
        // Intent stays pending — caller reviews in plan-mode UI.
        break;
      case 'require_approval': {
        const req = this.approvalManager.open({
          intentId: intent.id,
          countdownSec: decision.countdownSec,
          timeoutSec: decision.timeoutSec,
          requiredApprovalsCount: decision.requiredApprovers,
        });
        this.requestToIntent.set(req.id, intent.id);
        this.intentToRequest.set(intent.id, req.id);
        approvalRequestId = req.id;
        break;
      }
    }

    this.onDecision?.({
      intent,
      assessment,
      sensitive,
      decision,
      approvalRequestId,
    });
  }

  private handleApproved(req: ApprovalRequest): void {
    const intentId = this.requestToIntent.get(req.id);
    if (!intentId) return;
    this.forgetPair(req.id, intentId);
    this.safeApprove(intentId, this.manualApprover);
  }

  private handleRejected(req: ApprovalRequest): void {
    const intentId = this.requestToIntent.get(req.id);
    if (!intentId) return;
    this.forgetPair(req.id, intentId);
    this.safeReject(
      intentId,
      this.manualApprover,
      req.status === 'expired'
        ? 'approval request timed out'
        : 'approval request rejected',
    );
  }

  /**
   * The intent got resolved through a path other than our approval
   * manager — cancel any outstanding approval request for it so it
   * doesn't linger as a zombie waiter.
   */
  private dropRequestForIntent(intentId: string): void {
    const requestId = this.intentToRequest.get(intentId);
    if (!requestId) return;
    this.forgetPair(requestId, intentId);
    try {
      this.approvalManager.cancel(requestId);
    } catch {
      /* already terminal — ignore */
    }
  }

  private forgetPair(requestId: string, intentId: string): void {
    this.requestToIntent.delete(requestId);
    this.intentToRequest.delete(intentId);
  }

  private handleModeChanged(): void {
    // Cancel every pending approval + invalidate the underlying intent so
    // downstream consumers see a terminal state.
    const pairs = Array.from(this.requestToIntent.entries());
    this.requestToIntent.clear();
    this.intentToRequest.clear();

    for (const [requestId, intentId] of pairs) {
      try {
        this.approvalManager.cancel(requestId);
      } catch {
        /* already terminal — ignore */
      }
      this.safeInvalidate(intentId, 'mode changed');
    }
  }

  // --------------------------------------------------------------------------
  // Helpers
  // --------------------------------------------------------------------------

  private findSensitive(intent: Intent): SensitiveFileMatch | null {
    const path = intentFilePath(intent);
    return path ? this.sensitiveFiles.check(path) : null;
  }

  private safeApprove(intentId: string, approver: string): void {
    const current = this.engine.get(intentId);
    if (!current || current.status !== 'pending') return;
    try {
      this.engine.approve(intentId, approver);
    } catch {
      /* raced with another resolver — ignore */
    }
  }

  private safeReject(intentId: string, rejecter: string, reason: string): void {
    const current = this.engine.get(intentId);
    if (!current || current.status !== 'pending') return;
    try {
      this.engine.reject(intentId, rejecter, reason);
    } catch {
      /* ignore */
    }
  }

  private safeInvalidate(intentId: string, reason: string): void {
    const current = this.engine.get(intentId);
    if (!current) return;
    if (
      current.status === 'completed' ||
      current.status === 'failed' ||
      current.status === 'rejected' ||
      current.status === 'invalidated'
    ) {
      return;
    }
    try {
      this.engine.invalidate(intentId, reason);
    } catch {
      /* ignore */
    }
  }
}

// ============================================================================
// Utilities
// ============================================================================

function intentFilePath(intent: Intent): string | null {
  const a = intent.action;
  switch (a.type) {
    case 'file_read':
    case 'file_create':
    case 'file_edit':
    case 'file_delete':
      return a.path;
    case 'file_rename':
      return a.newPath;
    default:
      return null;
  }
}
