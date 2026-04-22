import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ApprovalManager } from '../approval-manager.js';
import type { ApprovalRequest } from '../types.js';

describe('ApprovalManager.open', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('creates a waiting request with a fresh id', () => {
    const m = new ApprovalManager();
    const req = m.open({ intentId: 'i-1', countdownSec: 0, timeoutSec: 300 });
    expect(req.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(req.status).toBe('waiting');
    expect(req.intentId).toBe('i-1');
    expect(req.autoApproveCountdown).toBe(0);
    expect(req.approvals).toEqual([]);
  });

  it('emits a created event', () => {
    const m = new ApprovalManager();
    const events: ApprovalRequest[] = [];
    m.on('created', r => events.push(r));
    m.open({ intentId: 'i-1', countdownSec: 0, timeoutSec: 300 });
    expect(events).toHaveLength(1);
    expect(events[0].intentId).toBe('i-1');
  });

  it('stores requiredApprovers verbatim and defaults to empty', () => {
    const m = new ApprovalManager();
    const a = m.open({ intentId: 'i-1', countdownSec: 0, timeoutSec: 300 });
    const b = m.open({
      intentId: 'i-2',
      countdownSec: 0,
      timeoutSec: 300,
      requiredApprovers: ['alice', 'bob'],
    });
    expect(a.requiredApprovers).toEqual([]);
    expect(b.requiredApprovers).toEqual(['alice', 'bob']);
  });
});

describe('ApprovalManager.approve', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('transitions to approved on a single-approval request', () => {
    const m = new ApprovalManager();
    const events: ApprovalRequest[] = [];
    m.on('approved', r => events.push(r));

    const req = m.open({ intentId: 'i-1', countdownSec: 0, timeoutSec: 300 });
    const after = m.approve(req.id, 'alice');

    expect(after.status).toBe('approved');
    expect(after.approvals).toEqual(['alice']);
    expect(after.resolvedAt).toBeGreaterThan(0);
    expect(events).toHaveLength(1);
  });

  it('collects approvals until the required count is reached', () => {
    const m = new ApprovalManager();
    const events: ApprovalRequest[] = [];
    m.on('approved', r => events.push(r));

    const req = m.open({
      intentId: 'i-1',
      countdownSec: 0,
      timeoutSec: 300,
      requiredApprovalsCount: 2,
    });

    const mid = m.approve(req.id, 'alice');
    expect(mid.status).toBe('waiting');
    expect(events).toHaveLength(0);

    const done = m.approve(req.id, 'bob');
    expect(done.status).toBe('approved');
    expect(done.approvals).toEqual(['alice', 'bob']);
    expect(events).toHaveLength(1);
  });

  it('deduplicates the same approver voting twice', () => {
    const m = new ApprovalManager();
    const req = m.open({
      intentId: 'i-1',
      countdownSec: 0,
      timeoutSec: 300,
      requiredApprovalsCount: 2,
    });
    m.approve(req.id, 'alice');
    const after = m.approve(req.id, 'alice');
    expect(after.approvals).toEqual(['alice']);
    expect(after.status).toBe('waiting');
  });

  it('throws when approving a terminal request', () => {
    const m = new ApprovalManager();
    const req = m.open({ intentId: 'i-1', countdownSec: 0, timeoutSec: 300 });
    m.approve(req.id, 'alice');
    expect(() => m.approve(req.id, 'bob')).toThrow(/already approved/);
  });

  it('throws on unknown id', () => {
    const m = new ApprovalManager();
    expect(() => m.approve('nope', 'alice')).toThrow(/not found/);
  });
});

describe('ApprovalManager.reject / cancel', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('reject transitions to rejected and emits the event', () => {
    const m = new ApprovalManager();
    const events: ApprovalRequest[] = [];
    m.on('rejected', r => events.push(r));

    const req = m.open({ intentId: 'i-1', countdownSec: 0, timeoutSec: 300 });
    const after = m.reject(req.id, 'alice');

    expect(after.status).toBe('rejected');
    expect(events).toHaveLength(1);
  });

  it('cancel transitions to rejected too (same terminal event)', () => {
    const m = new ApprovalManager();
    const events: ApprovalRequest[] = [];
    m.on('rejected', r => events.push(r));

    const req = m.open({ intentId: 'i-1', countdownSec: 0, timeoutSec: 300 });
    const after = m.cancel(req.id);
    expect(after.status).toBe('rejected');
    expect(events).toHaveLength(1);
  });
});

describe('ApprovalManager countdown', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('auto-approves after countdownSec when nothing else happens', () => {
    const m = new ApprovalManager();
    const events: ApprovalRequest[] = [];
    m.on('auto_approved', r => events.push(r));

    m.open({ intentId: 'i-1', countdownSec: 5, timeoutSec: 300 });

    expect(events).toHaveLength(0);
    vi.advanceTimersByTime(4_999);
    expect(events).toHaveLength(0);
    vi.advanceTimersByTime(2);
    expect(events).toHaveLength(1);
    expect(events[0].status).toBe('auto_approved');
  });

  it('manual approve cancels the countdown timer', () => {
    const m = new ApprovalManager();
    const autoEvents: ApprovalRequest[] = [];
    const okEvents: ApprovalRequest[] = [];
    m.on('auto_approved', r => autoEvents.push(r));
    m.on('approved', r => okEvents.push(r));

    const req = m.open({ intentId: 'i-1', countdownSec: 5, timeoutSec: 300 });
    m.approve(req.id, 'alice');

    vi.advanceTimersByTime(60_000);
    expect(autoEvents).toHaveLength(0);
    expect(okEvents).toHaveLength(1);
  });

  it('manual reject cancels the countdown timer', () => {
    const m = new ApprovalManager();
    const autoEvents: ApprovalRequest[] = [];
    const rejected: ApprovalRequest[] = [];
    m.on('auto_approved', r => autoEvents.push(r));
    m.on('rejected', r => rejected.push(r));

    const req = m.open({ intentId: 'i-1', countdownSec: 5, timeoutSec: 300 });
    m.reject(req.id, 'alice');

    vi.advanceTimersByTime(60_000);
    expect(autoEvents).toHaveLength(0);
    expect(rejected).toHaveLength(1);
  });
});

describe('ApprovalManager timeout (no countdown)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('expires after timeoutSec when there is no countdown', () => {
    const m = new ApprovalManager();
    const events: ApprovalRequest[] = [];
    m.on('expired', r => events.push(r));

    m.open({ intentId: 'i-1', countdownSec: 0, timeoutSec: 10 });

    vi.advanceTimersByTime(9_999);
    expect(events).toHaveLength(0);
    vi.advanceTimersByTime(2);
    expect(events).toHaveLength(1);
    expect(events[0].status).toBe('expired');
  });

  it('manual approval cancels the timeout', () => {
    const m = new ApprovalManager();
    const expired: ApprovalRequest[] = [];
    m.on('expired', r => expired.push(r));

    const req = m.open({ intentId: 'i-1', countdownSec: 0, timeoutSec: 5 });
    m.approve(req.id, 'alice');
    vi.advanceTimersByTime(60_000);
    expect(expired).toHaveLength(0);
  });

  it('no timer when both countdownSec and timeoutSec are 0', () => {
    const m = new ApprovalManager();
    const events: ApprovalRequest[] = [];
    m.on('expired', r => events.push(r));
    m.on('auto_approved', r => events.push(r));

    m.open({ intentId: 'i-1', countdownSec: 0, timeoutSec: 0 });
    vi.advanceTimersByTime(10 * 60_000);
    expect(events).toHaveLength(0);
  });
});

describe('ApprovalManager queries', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('list + filter by status', () => {
    const m = new ApprovalManager();
    const a = m.open({ intentId: 'i-1', countdownSec: 0, timeoutSec: 300 });
    m.open({ intentId: 'i-2', countdownSec: 0, timeoutSec: 300 });
    m.approve(a.id, 'alice');

    expect(m.list()).toHaveLength(2);
    expect(m.list({ status: 'waiting' })).toHaveLength(1);
    expect(m.list({ status: 'approved' })).toHaveLength(1);
    expect(m.waitingCount()).toBe(1);
  });

  it('get returns a copy (mutation does not affect state)', () => {
    const m = new ApprovalManager();
    const a = m.open({ intentId: 'i-1', countdownSec: 0, timeoutSec: 300 });
    const copy = m.get(a.id)!;
    copy.approvals.push('sneaky');
    expect(m.get(a.id)!.approvals).toEqual([]);
  });

  it('get returns undefined for unknown id', () => {
    const m = new ApprovalManager();
    expect(m.get('nope')).toBeUndefined();
  });
});

describe('ApprovalManager.destroy', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('clears pending timers so nothing fires after teardown', () => {
    const m = new ApprovalManager();
    const events: ApprovalRequest[] = [];
    m.on('auto_approved', r => events.push(r));
    m.on('expired', r => events.push(r));

    m.open({ intentId: 'i-1', countdownSec: 5, timeoutSec: 300 });
    m.open({ intentId: 'i-2', countdownSec: 0, timeoutSec: 10 });

    m.destroy();

    vi.advanceTimersByTime(60_000);
    expect(events).toHaveLength(0);
    expect(m.list()).toEqual([]);
  });
});

describe('ApprovalManager listener lifecycle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('on() returns an unsubscribe function', () => {
    const m = new ApprovalManager();
    const events: ApprovalRequest[] = [];
    const unsub = m.on('created', r => events.push(r));
    m.open({ intentId: 'i-1', countdownSec: 0, timeoutSec: 300 });
    unsub();
    m.open({ intentId: 'i-2', countdownSec: 0, timeoutSec: 300 });
    expect(events).toHaveLength(1);
  });

  it('swallows listener errors', () => {
    const m = new ApprovalManager();
    const ok: ApprovalRequest[] = [];
    m.on('created', () => {
      throw new Error('boom');
    });
    m.on('created', r => ok.push(r));
    expect(() =>
      m.open({ intentId: 'i-1', countdownSec: 0, timeoutSec: 300 }),
    ).not.toThrow();
    expect(ok).toHaveLength(1);
  });
});
