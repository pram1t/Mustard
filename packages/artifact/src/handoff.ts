/**
 * OpenAgent V2 - Handoff Manager
 *
 * State machine for managing artifact handoffs between workers.
 *
 * Valid transitions:
 *   pending → accepted
 *   pending → rejected
 *   pending → changes_requested
 *   changes_requested → pending (resubmit)
 */

import { randomUUID } from 'node:crypto';
import type { Handoff, HandoffStatus, IHandoffManager, ReviewFeedback } from './types.js';

/**
 * Valid state transitions for handoffs.
 */
const VALID_TRANSITIONS: Record<HandoffStatus, HandoffStatus[]> = {
  pending: ['accepted', 'rejected', 'changes_requested'],
  accepted: [], // terminal
  rejected: [], // terminal
  changes_requested: ['pending'], // can resubmit
};

/**
 * Manages artifact handoffs between workers using a state machine.
 */
export class HandoffManager implements IHandoffManager {
  private handoffs = new Map<string, Handoff>();

  /**
   * Create a new handoff.
   */
  create(artifactId: string, fromWorker: string, toWorker: string, message?: string): Handoff {
    const handoff: Handoff = {
      id: randomUUID(),
      artifactId,
      fromWorker,
      toWorker,
      status: 'pending',
      message,
      createdAt: new Date(),
    };

    this.handoffs.set(handoff.id, handoff);
    return handoff;
  }

  /**
   * Get a handoff by ID.
   */
  get(id: string): Handoff | undefined {
    return this.handoffs.get(id);
  }

  /**
   * Accept a handoff (pending → accepted).
   */
  accept(id: string): Handoff {
    return this.transition(id, 'accepted');
  }

  /**
   * Reject a handoff with feedback (pending → rejected).
   */
  reject(id: string, feedback: ReviewFeedback): Handoff {
    const handoff = this.transition(id, 'rejected');
    handoff.feedback = feedback;
    return handoff;
  }

  /**
   * Request changes on a handoff (pending → changes_requested).
   */
  requestChanges(id: string, feedback: ReviewFeedback): Handoff {
    const handoff = this.transition(id, 'changes_requested');
    handoff.feedback = feedback;
    return handoff;
  }

  /**
   * Resubmit after changes were requested (changes_requested → pending).
   */
  resubmit(id: string, message?: string): Handoff {
    const handoff = this.transition(id, 'pending');
    if (message) {
      handoff.message = message;
    }
    handoff.feedback = undefined;
    handoff.resolvedAt = undefined;
    return handoff;
  }

  /**
   * Get all handoffs for an artifact.
   */
  getByArtifact(artifactId: string): Handoff[] {
    return [...this.handoffs.values()].filter((h) => h.artifactId === artifactId);
  }

  /**
   * Get handoffs by worker (as sender or receiver).
   */
  getByWorker(workerId: string, role: 'from' | 'to'): Handoff[] {
    return [...this.handoffs.values()].filter((h) =>
      role === 'from' ? h.fromWorker === workerId : h.toWorker === workerId
    );
  }

  /**
   * Get all pending handoffs.
   */
  getPending(): Handoff[] {
    return [...this.handoffs.values()].filter((h) => h.status === 'pending');
  }

  // ===========================================================================
  // PRIVATE
  // ===========================================================================

  /**
   * Perform a state transition, throwing if invalid.
   */
  private transition(id: string, newStatus: HandoffStatus): Handoff {
    const handoff = this.handoffs.get(id);
    if (!handoff) {
      throw new Error(`Handoff not found: ${id}`);
    }

    const validNext = VALID_TRANSITIONS[handoff.status];
    if (!validNext.includes(newStatus)) {
      throw new Error(
        `Invalid handoff transition: ${handoff.status} → ${newStatus}. ` +
        `Valid transitions from "${handoff.status}": [${validNext.join(', ')}]`
      );
    }

    handoff.status = newStatus;

    // Mark terminal states as resolved
    if (newStatus === 'accepted' || newStatus === 'rejected') {
      handoff.resolvedAt = new Date();
    }

    return handoff;
  }
}
