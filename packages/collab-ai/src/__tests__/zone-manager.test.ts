import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Range } from '@mustard/collab-core';
import { ZoneManager } from '../zone-manager.js';
import type { ZoneClaimRequest } from '../types.js';

function r(startLine: number, endLine: number, startColumn = 0, endColumn = 0): Range {
  return { startLine, startColumn, endLine, endColumn };
}

function request(over?: Partial<ZoneClaimRequest>): ZoneClaimRequest {
  return {
    file: 'src/a.ts',
    region: r(1, 10),
    participantId: 'p-ai-1',
    participantType: 'ai',
    ...over,
  };
}

describe('ZoneManager.claim — non-conflicting', () => {
  it('grants an AI claim with an expiry on a clean file', () => {
    const zm = new ZoneManager();
    const result = zm.claim(request());

    expect(result.success).toBe(true);
    expect(result.claim?.claimerType).toBe('ai');
    expect(result.claim?.expiresAt).toBeGreaterThan(Date.now());
  });

  it('grants a human claim with no expiry', () => {
    const zm = new ZoneManager();
    const result = zm.claim(
      request({ participantId: 'p-human-1', participantType: 'human' }),
    );

    expect(result.success).toBe(true);
    expect(result.claim?.expiresAt).toBeUndefined();
  });

  it('grants two AI claims on non-overlapping regions of the same file', () => {
    const zm = new ZoneManager();
    const a = zm.claim(request({ participantId: 'p-1', region: r(1, 5) }));
    const b = zm.claim(request({ participantId: 'p-2', region: r(10, 15) }));

    expect(a.success).toBe(true);
    expect(b.success).toBe(true);
    expect(zm.totalClaims).toBe(2);
  });
});

describe('ZoneManager.claim — AI vs AI conflicts', () => {
  it('denies a second AI when regions overlap', () => {
    const zm = new ZoneManager();
    zm.claim(request({ participantId: 'p-1', region: r(1, 10) }));
    const conflict = zm.claim(request({ participantId: 'p-2', region: r(5, 15) }));

    expect(conflict.success).toBe(false);
    expect(conflict.conflict?.resolution).toBe('denied');
    expect(conflict.conflict?.existingClaim.claimerId).toBe('p-1');
  });

  it('updates an existing AI claim when the same agent reclaims', () => {
    const zm = new ZoneManager();
    const first = zm.claim(request({ participantId: 'p-1', region: r(1, 10) }));
    const second = zm.claim(request({ participantId: 'p-1', region: r(5, 20) }));

    expect(second.success).toBe(true);
    expect(zm.totalClaims).toBe(1);
    expect(second.claim?.region.endLine).toBe(20);
    // The old claim should be gone
    expect(first.claim?.region.endLine).toBe(10);
  });
});

describe('ZoneManager.claim — human priority', () => {
  it('evicts an overlapping AI claim when a human claims', () => {
    const zm = new ZoneManager();
    zm.claim(request({ participantId: 'p-ai-1', region: r(1, 10) }));
    const result = zm.claim(
      request({
        participantId: 'p-human-1',
        participantType: 'human',
        region: r(5, 15),
      }),
    );

    expect(result.success).toBe(true);
    expect(zm.totalClaims).toBe(1);
    expect(zm.getFileClaims('src/a.ts')[0].claimerId).toBe('p-human-1');
  });

  it('denies an AI claim overlapping an existing human claim', () => {
    const zm = new ZoneManager();
    zm.claim(
      request({
        participantId: 'p-human-1',
        participantType: 'human',
        region: r(1, 10),
      }),
    );
    const result = zm.claim(request({ participantId: 'p-ai-1', region: r(5, 15) }));

    expect(result.success).toBe(false);
    expect(result.conflict?.existingClaim.claimerId).toBe('p-human-1');
  });

  it('denies a human claim overlapping another human claim', () => {
    const zm = new ZoneManager();
    zm.claim(
      request({ participantId: 'h-1', participantType: 'human', region: r(1, 10) }),
    );
    const result = zm.claim(
      request({ participantId: 'h-2', participantType: 'human', region: r(5, 15) }),
    );

    expect(result.success).toBe(false);
    expect(result.conflict?.resolution).toBe('denied');
  });
});

describe('ZoneManager.release', () => {
  it('releases a specific participant\'s claim on a file', () => {
    const zm = new ZoneManager();
    zm.claim(request({ participantId: 'p-1' }));
    zm.release('src/a.ts', 'p-1');
    expect(zm.totalClaims).toBe(0);
  });

  it('releases all claims by a participant across files', () => {
    const zm = new ZoneManager();
    zm.claim(request({ participantId: 'p-1', file: 'a.ts', region: r(1, 5) }));
    zm.claim(request({ participantId: 'p-1', file: 'b.ts', region: r(1, 5) }));
    zm.claim(request({ participantId: 'p-2', file: 'a.ts', region: r(10, 20) }));

    zm.releaseAll('p-1');

    expect(zm.totalClaims).toBe(1);
    expect(zm.getFileClaims('a.ts')[0].claimerId).toBe('p-2');
  });
});

describe('ZoneManager queries', () => {
  it('getFileClaims returns a copy (mutation does not affect state)', () => {
    const zm = new ZoneManager();
    zm.claim(request());
    const snapshot = zm.getFileClaims('src/a.ts');
    snapshot.pop();
    expect(zm.totalClaims).toBe(1);
  });

  it('getParticipantClaims returns every claim by that participant', () => {
    const zm = new ZoneManager();
    zm.claim(request({ participantId: 'p-1', file: 'a.ts', region: r(1, 5) }));
    zm.claim(request({ participantId: 'p-1', file: 'b.ts', region: r(1, 5) }));
    zm.claim(request({ participantId: 'p-2', file: 'a.ts', region: r(10, 20) }));

    const claims = zm.getParticipantClaims('p-1');
    expect(claims).toHaveLength(2);
    expect(claims.map(c => c.file).sort()).toEqual(['a.ts', 'b.ts']);
  });

  it('isClaimedByOther excludes the requester from the check', () => {
    const zm = new ZoneManager();
    zm.claim(request({ participantId: 'p-1', region: r(5, 10) }));
    expect(zm.isClaimedByOther('src/a.ts', 7, 'p-1')).toBe(false);
    expect(zm.isClaimedByOther('src/a.ts', 7, 'p-2')).toBe(true);
    expect(zm.isClaimedByOther('src/a.ts', 100, 'p-2')).toBe(false);
  });

  it('clear removes all claims', () => {
    const zm = new ZoneManager();
    zm.claim(request({ participantId: 'p-1' }));
    zm.claim(request({ participantId: 'p-2', file: 'b.ts' }));
    zm.clear();
    expect(zm.totalClaims).toBe(0);
  });
});

describe('ZoneManager expiry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('expires AI claims after the default duration', () => {
    const zm = new ZoneManager();
    zm.claim(request({ participantId: 'p-ai-1' }));
    expect(zm.totalClaims).toBe(1);

    vi.advanceTimersByTime(60_001);
    expect(zm.totalClaims).toBe(0);
  });

  it('honors a custom duration', () => {
    const zm = new ZoneManager();
    zm.claim(request({ participantId: 'p-ai-1', duration: 5_000 }));
    vi.advanceTimersByTime(4_999);
    expect(zm.totalClaims).toBe(1);
    vi.advanceTimersByTime(2);
    expect(zm.totalClaims).toBe(0);
  });

  it('never expires human claims', () => {
    const zm = new ZoneManager();
    zm.claim(
      request({ participantId: 'p-human-1', participantType: 'human' }),
    );
    vi.advanceTimersByTime(10 * 60_000);
    expect(zm.totalClaims).toBe(1);
  });

  it('allows a new AI claim on the same region after the old one expires', () => {
    const zm = new ZoneManager();
    zm.claim(request({ participantId: 'p-1' }));
    vi.advanceTimersByTime(60_001);
    const result = zm.claim(request({ participantId: 'p-2' }));
    expect(result.success).toBe(true);
  });
});
