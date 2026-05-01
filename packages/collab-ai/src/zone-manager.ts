/**
 * Zone manager for OpenAgent Collab.
 *
 * Manages file/region claims to prevent editing conflicts.
 * Key rule: humans always override AI claims.
 */

import type { Range } from '@pram1t/mustard-collab-core';
import type { ClaimedZone, ZoneClaimRequest, ZoneClaimResult } from './types.js';

// ============================================================================
// ZoneManager
// ============================================================================

/** Default AI claim expiry (60 seconds). */
const DEFAULT_AI_CLAIM_EXPIRY_MS = 60_000;

export class ZoneManager {
  private readonly claims = new Map<string, ClaimedZone[]>();

  // --------------------------------------------------------------------------
  // Claim Operations
  // --------------------------------------------------------------------------

  /**
   * Attempt to claim a zone.
   * Human claims override AI claims. AI claims have expiry.
   */
  claim(request: ZoneClaimRequest): ZoneClaimResult {
    this.removeExpired();

    const fileClaims = this.claims.get(request.file) ?? [];

    // Check for overlapping claims
    const overlapping = fileClaims.filter(c => rangesOverlap(c.region, request.region));

    if (overlapping.length === 0) {
      // No conflict — grant claim
      return this.grantClaim(request);
    }

    // Human always wins over AI
    if (request.participantType === 'human') {
      // Remove any AI claims that overlap
      const aiOverlaps = overlapping.filter(c => c.claimerType === 'ai');
      for (const aiClaim of aiOverlaps) {
        this.removeClaim(request.file, aiClaim.claimerId);
      }

      // Check if any human claims remain
      const humanOverlaps = overlapping.filter(c => c.claimerType === 'human');
      if (humanOverlaps.length === 0) {
        return this.grantClaim(request);
      }

      // Another human already has a claim — deny
      return {
        success: false,
        conflict: {
          existingClaim: humanOverlaps[0],
          resolution: 'denied',
        },
      };
    }

    // AI requesting — check what's in the way
    const humanOverlaps = overlapping.filter(c => c.claimerType === 'human');
    if (humanOverlaps.length > 0) {
      return {
        success: false,
        conflict: {
          existingClaim: humanOverlaps[0],
          resolution: 'denied',
        },
      };
    }

    // AI vs AI — first-come-first-served
    const aiOverlaps = overlapping.filter(c => c.claimerId !== request.participantId);
    if (aiOverlaps.length > 0) {
      return {
        success: false,
        conflict: {
          existingClaim: aiOverlaps[0],
          resolution: 'denied',
        },
      };
    }

    // Own AI claim already exists — update it
    return this.grantClaim(request);
  }

  /**
   * Release all claims by a participant for a file.
   */
  release(file: string, participantId: string): void {
    this.removeClaim(file, participantId);
  }

  /**
   * Release all claims by a participant (all files).
   */
  releaseAll(participantId: string): void {
    for (const [file] of this.claims) {
      this.removeClaim(file, participantId);
    }
  }

  // --------------------------------------------------------------------------
  // Queries
  // --------------------------------------------------------------------------

  /** Get all claims for a file. */
  getFileClaims(file: string): ClaimedZone[] {
    this.removeExpired();
    return [...(this.claims.get(file) ?? [])];
  }

  /** Get all claims by a participant. */
  getParticipantClaims(participantId: string): ClaimedZone[] {
    this.removeExpired();
    const result: ClaimedZone[] = [];
    for (const claims of this.claims.values()) {
      for (const c of claims) {
        if (c.claimerId === participantId) {
          result.push(c);
        }
      }
    }
    return result;
  }

  /** Check if a specific position is claimed by someone else. */
  isClaimedByOther(file: string, line: number, participantId: string): boolean {
    this.removeExpired();
    const fileClaims = this.claims.get(file) ?? [];
    return fileClaims.some(
      c => c.claimerId !== participantId && line >= c.region.startLine && line <= c.region.endLine,
    );
  }

  /** Total number of active claims. */
  get totalClaims(): number {
    this.removeExpired();
    let count = 0;
    for (const claims of this.claims.values()) {
      count += claims.length;
    }
    return count;
  }

  /** Clear all claims. */
  clear(): void {
    this.claims.clear();
  }

  // --------------------------------------------------------------------------
  // Internal
  // --------------------------------------------------------------------------

  private grantClaim(request: ZoneClaimRequest): ZoneClaimResult {
    const now = Date.now();
    const zone: ClaimedZone = {
      file: request.file,
      region: request.region,
      claimerId: request.participantId,
      claimerType: request.participantType,
      claimedAt: now,
      expiresAt:
        request.participantType === 'ai'
          ? now + (request.duration ?? DEFAULT_AI_CLAIM_EXPIRY_MS)
          : undefined,
    };

    // Remove existing claims by same participant on same file
    this.removeClaim(request.file, request.participantId);

    const fileClaims = this.claims.get(request.file) ?? [];
    fileClaims.push(zone);
    this.claims.set(request.file, fileClaims);

    return { success: true, claim: zone };
  }

  private removeClaim(file: string, participantId: string): void {
    const fileClaims = this.claims.get(file);
    if (!fileClaims) return;
    const filtered = fileClaims.filter(c => c.claimerId !== participantId);
    if (filtered.length === 0) {
      this.claims.delete(file);
    } else {
      this.claims.set(file, filtered);
    }
  }

  private removeExpired(): void {
    const now = Date.now();
    for (const [file, claims] of this.claims) {
      const active = claims.filter(c => !c.expiresAt || c.expiresAt > now);
      if (active.length === 0) {
        this.claims.delete(file);
      } else if (active.length !== claims.length) {
        this.claims.set(file, active);
      }
    }
  }
}

// ============================================================================
// Range Helpers
// ============================================================================

function rangesOverlap(a: Range, b: Range): boolean {
  // No overlap if one ends before the other starts
  if (a.endLine < b.startLine || b.endLine < a.startLine) return false;
  // Same line: check columns
  if (a.endLine === b.startLine && a.endColumn <= b.startColumn) return false;
  if (b.endLine === a.startLine && b.endColumn <= a.startColumn) return false;
  return true;
}
