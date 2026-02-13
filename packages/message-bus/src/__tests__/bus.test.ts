import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventBus } from '../bus.js';
import type { MessageEnvelope } from '../types.js';

describe('EventBus', () => {
  let bus: EventBus;

  beforeEach(() => {
    bus = new EventBus();
  });

  // ===========================================================================
  // PUBLISH
  // ===========================================================================

  describe('publish', () => {
    it('should return a message envelope with all fields', () => {
      const envelope = bus.publish('task.created', { taskId: '123' });

      expect(envelope.id).toBeDefined();
      expect(envelope.type).toBe('task.created');
      expect(envelope.payload).toEqual({ taskId: '123' });
      expect(envelope.timestamp).toBeInstanceOf(Date);
    });

    it('should include correlationId and source from options', () => {
      const envelope = bus.publish('task.created', { taskId: '123' }, {
        correlationId: 'corr-1',
        source: 'planner',
      });

      expect(envelope.correlationId).toBe('corr-1');
      expect(envelope.source).toBe('planner');
    });

    it('should generate unique IDs for each message', () => {
      const a = bus.publish('task.created', {});
      const b = bus.publish('task.created', {});
      expect(a.id).not.toBe(b.id);
    });

    it('should notify matching subscribers', () => {
      const handler = vi.fn();
      bus.subscribe('task.created', handler);
      const envelope = bus.publish('task.created', { taskId: '1' });

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(envelope);
    });

    it('should not notify non-matching subscribers', () => {
      const handler = vi.fn();
      bus.subscribe('worker.status', handler);
      bus.publish('task.created', {});

      expect(handler).not.toHaveBeenCalled();
    });

    it('should not crash if a subscriber throws', () => {
      bus.subscribe('task.created', () => {
        throw new Error('boom');
      });

      expect(() => bus.publish('task.created', {})).not.toThrow();
    });
  });

  // ===========================================================================
  // SUBSCRIBE — PATTERN MATCHING
  // ===========================================================================

  describe('subscribe (pattern matching)', () => {
    it('should match exact type', () => {
      const handler = vi.fn();
      bus.subscribe('task.completed', handler);

      bus.publish('task.completed', {});
      bus.publish('task.created', {});

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should match wildcard "task.*"', () => {
      const handler = vi.fn();
      bus.subscribe('task.*', handler);

      bus.publish('task.created', {});
      bus.publish('task.completed', {});
      bus.publish('task.failed', {});
      bus.publish('worker.status', {}); // should NOT match

      expect(handler).toHaveBeenCalledTimes(3);
    });

    it('should match wildcard "*.error"', () => {
      const handler = vi.fn();
      bus.subscribe('*.error', handler);

      bus.publish('worker.error', {});
      bus.publish('system.error', {});
      bus.publish('task.created', {}); // should NOT match

      expect(handler).toHaveBeenCalledTimes(2);
    });

    it('should match global wildcard "*"', () => {
      const handler = vi.fn();
      bus.subscribe('*', handler);

      bus.publish('task.created', {});
      bus.publish('worker.status', {});

      // "*" matches single segments only (no dots), so "task.created" won't match "*"
      expect(handler).toHaveBeenCalledTimes(0);
    });

    it('should support multiple subscribers on the same pattern', () => {
      const h1 = vi.fn();
      const h2 = vi.fn();
      bus.subscribe('task.*', h1);
      bus.subscribe('task.*', h2);

      bus.publish('task.created', {});

      expect(h1).toHaveBeenCalledTimes(1);
      expect(h2).toHaveBeenCalledTimes(1);
    });

    it('should not match multi-segment types with single wildcard', () => {
      const handler = vi.fn();
      bus.subscribe('task.*', handler);

      // If someone publishes "task.created.detail" it should NOT match "task.*"
      bus.publish('task.created.detail' as any, {});
      expect(handler).toHaveBeenCalledTimes(0);
    });
  });

  // ===========================================================================
  // UNSUBSCRIBE
  // ===========================================================================

  describe('unsubscribe', () => {
    it('should stop receiving messages after unsubscribe', () => {
      const handler = vi.fn();
      const unsub = bus.subscribe('task.*', handler);

      bus.publish('task.created', {});
      expect(handler).toHaveBeenCalledTimes(1);

      unsub();
      bus.publish('task.completed', {});
      expect(handler).toHaveBeenCalledTimes(1); // still 1
    });

    it('should decrement subscription count', () => {
      const unsub = bus.subscribe('task.*', vi.fn());
      expect(bus.getSubscriptionCount()).toBe(1);

      unsub();
      expect(bus.getSubscriptionCount()).toBe(0);
    });
  });

  // ===========================================================================
  // ONCE
  // ===========================================================================

  describe('once', () => {
    it('should resolve with the first matching message', async () => {
      const promise = bus.once<{ id: string }>('task.completed');
      bus.publish('task.completed', { id: 'abc' });

      const msg = await promise;
      expect(msg.type).toBe('task.completed');
      expect(msg.payload.id).toBe('abc');
    });

    it('should auto-unsubscribe after first match', async () => {
      const promise = bus.once('task.completed');
      expect(bus.getSubscriptionCount()).toBe(1);

      bus.publish('task.completed', {});
      await promise;

      expect(bus.getSubscriptionCount()).toBe(0);
    });

    it('should reject on timeout', async () => {
      const promise = bus.once('task.completed', 50);

      await expect(promise).rejects.toThrow('timed out after 50ms');
    });

    it('should clean up subscription on timeout', async () => {
      const promise = bus.once('task.completed', 50);
      expect(bus.getSubscriptionCount()).toBe(1);

      await promise.catch(() => {});
      expect(bus.getSubscriptionCount()).toBe(0);
    });
  });

  // ===========================================================================
  // HISTORY
  // ===========================================================================

  describe('getHistory', () => {
    it('should return all messages when no query', () => {
      bus.publish('task.created', { id: '1' });
      bus.publish('task.completed', { id: '2' });

      const history = bus.getHistory();
      expect(history).toHaveLength(2);
    });

    it('should filter by type', () => {
      bus.publish('task.created', {});
      bus.publish('task.completed', {});
      bus.publish('worker.status', {});

      const history = bus.getHistory({ type: 'task.created' });
      expect(history).toHaveLength(1);
      expect(history[0].type).toBe('task.created');
    });

    it('should filter by correlationId', () => {
      bus.publish('task.created', {}, { correlationId: 'plan-1' });
      bus.publish('task.completed', {}, { correlationId: 'plan-1' });
      bus.publish('task.created', {}, { correlationId: 'plan-2' });

      const history = bus.getHistory({ correlationId: 'plan-1' });
      expect(history).toHaveLength(2);
    });

    it('should filter by since date', () => {
      bus.publish('task.created', {});

      const after = new Date();

      bus.publish('task.completed', {});

      const history = bus.getHistory({ since: after });
      // The second message timestamp >= after
      expect(history.length).toBeGreaterThanOrEqual(1);
      expect(history.every((m) => m.timestamp.getTime() >= after.getTime())).toBe(true);
    });

    it('should limit results', () => {
      for (let i = 0; i < 10; i++) {
        bus.publish('task.created', { i });
      }

      const history = bus.getHistory({ limit: 3 });
      expect(history).toHaveLength(3);
      // Should return last 3
      expect((history[0].payload as any).i).toBe(7);
      expect((history[2].payload as any).i).toBe(9);
    });

    it('should return copies (not internal references)', () => {
      bus.publish('task.created', {});
      const h1 = bus.getHistory();
      const h2 = bus.getHistory();
      expect(h1).not.toBe(h2);
    });

    it('should respect maxHistory config', () => {
      const smallBus = new EventBus({ maxHistory: 5 });
      for (let i = 0; i < 10; i++) {
        smallBus.publish('task.created', { i });
      }

      const history = smallBus.getHistory();
      expect(history).toHaveLength(5);
      // Should keep the last 5
      expect((history[0].payload as any).i).toBe(5);
    });
  });

  // ===========================================================================
  // CLEAR
  // ===========================================================================

  describe('clear', () => {
    it('should remove all subscriptions and history', () => {
      bus.subscribe('task.*', vi.fn());
      bus.publish('task.created', {});

      expect(bus.getSubscriptionCount()).toBe(1);
      expect(bus.getHistory()).toHaveLength(1);

      bus.clear();

      expect(bus.getSubscriptionCount()).toBe(0);
      expect(bus.getHistory()).toHaveLength(0);
    });
  });

  // ===========================================================================
  // SUBSCRIPTION COUNT
  // ===========================================================================

  describe('getSubscriptionCount', () => {
    it('should return 0 initially', () => {
      expect(bus.getSubscriptionCount()).toBe(0);
    });

    it('should track multiple subscriptions', () => {
      bus.subscribe('task.*', vi.fn());
      bus.subscribe('worker.*', vi.fn());
      bus.subscribe('handoff.*', vi.fn());
      expect(bus.getSubscriptionCount()).toBe(3);
    });
  });
});
