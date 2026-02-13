import { describe, it, expect, beforeEach } from 'vitest';
import { HandoffManager } from '../handoff.js';
import type { ReviewFeedback } from '../types.js';

describe('HandoffManager', () => {
  let manager: HandoffManager;

  beforeEach(() => {
    manager = new HandoffManager();
  });

  const feedback: ReviewFeedback = {
    decision: 'request_changes',
    comments: ['Need more detail on error handling'],
    blockers: ['Missing validation'],
    suggestions: ['Consider using Zod'],
  };

  // ===========================================================================
  // CREATE
  // ===========================================================================

  describe('create', () => {
    it('should create a handoff in pending status', () => {
      const h = manager.create('artifact-1', 'worker-a', 'worker-b', 'Please review');

      expect(h.id).toBeDefined();
      expect(h.artifactId).toBe('artifact-1');
      expect(h.fromWorker).toBe('worker-a');
      expect(h.toWorker).toBe('worker-b');
      expect(h.status).toBe('pending');
      expect(h.message).toBe('Please review');
      expect(h.createdAt).toBeInstanceOf(Date);
    });

    it('should generate unique IDs', () => {
      const h1 = manager.create('a1', 'w1', 'w2');
      const h2 = manager.create('a2', 'w1', 'w2');
      expect(h1.id).not.toBe(h2.id);
    });
  });

  // ===========================================================================
  // GET
  // ===========================================================================

  describe('get', () => {
    it('should retrieve by ID', () => {
      const h = manager.create('a1', 'w1', 'w2');
      expect(manager.get(h.id)).toBeDefined();
      expect(manager.get(h.id)!.id).toBe(h.id);
    });

    it('should return undefined for non-existent', () => {
      expect(manager.get('non-existent')).toBeUndefined();
    });
  });

  // ===========================================================================
  // STATE TRANSITIONS
  // ===========================================================================

  describe('accept', () => {
    it('should transition pending → accepted', () => {
      const h = manager.create('a1', 'w1', 'w2');
      const accepted = manager.accept(h.id);
      expect(accepted.status).toBe('accepted');
      expect(accepted.resolvedAt).toBeInstanceOf(Date);
    });

    it('should throw for non-pending handoff', () => {
      const h = manager.create('a1', 'w1', 'w2');
      manager.accept(h.id);
      expect(() => manager.accept(h.id)).toThrow('Invalid handoff transition');
    });
  });

  describe('reject', () => {
    it('should transition pending → rejected with feedback', () => {
      const h = manager.create('a1', 'w1', 'w2');
      const rejected = manager.reject(h.id, {
        decision: 'reject',
        comments: ['Fundamentally wrong approach'],
      });
      expect(rejected.status).toBe('rejected');
      expect(rejected.feedback).toBeDefined();
      expect(rejected.feedback!.comments).toContain('Fundamentally wrong approach');
      expect(rejected.resolvedAt).toBeInstanceOf(Date);
    });
  });

  describe('requestChanges', () => {
    it('should transition pending → changes_requested', () => {
      const h = manager.create('a1', 'w1', 'w2');
      const changed = manager.requestChanges(h.id, feedback);
      expect(changed.status).toBe('changes_requested');
      expect(changed.feedback).toBeDefined();
      expect(changed.feedback!.blockers).toContain('Missing validation');
    });
  });

  describe('resubmit', () => {
    it('should transition changes_requested → pending', () => {
      const h = manager.create('a1', 'w1', 'w2');
      manager.requestChanges(h.id, feedback);

      const resubmitted = manager.resubmit(h.id, 'Addressed all feedback');
      expect(resubmitted.status).toBe('pending');
      expect(resubmitted.message).toBe('Addressed all feedback');
      expect(resubmitted.feedback).toBeUndefined();
    });

    it('should throw when resubmitting from pending', () => {
      const h = manager.create('a1', 'w1', 'w2');
      expect(() => manager.resubmit(h.id)).toThrow('Invalid handoff transition');
    });
  });

  describe('invalid transitions', () => {
    it('should throw for accepted → anything', () => {
      const h = manager.create('a1', 'w1', 'w2');
      manager.accept(h.id);
      expect(() => manager.reject(h.id, feedback)).toThrow('Invalid handoff transition');
    });

    it('should throw for rejected → anything', () => {
      const h = manager.create('a1', 'w1', 'w2');
      manager.reject(h.id, feedback);
      expect(() => manager.accept(h.id)).toThrow('Invalid handoff transition');
    });

    it('should throw for non-existent handoff', () => {
      expect(() => manager.accept('non-existent')).toThrow('Handoff not found');
    });
  });

  // ===========================================================================
  // FULL CYCLE: pending → changes_requested → pending → accepted
  // ===========================================================================

  describe('full review cycle', () => {
    it('should support resubmit and approve flow', () => {
      const h = manager.create('a1', 'architect', 'backend');
      expect(h.status).toBe('pending');

      // Reviewer requests changes
      manager.requestChanges(h.id, {
        decision: 'request_changes',
        comments: ['Add error handling'],
      });
      expect(manager.get(h.id)!.status).toBe('changes_requested');

      // Author resubmits
      manager.resubmit(h.id, 'Added error handling');
      expect(manager.get(h.id)!.status).toBe('pending');

      // Reviewer accepts
      manager.accept(h.id);
      expect(manager.get(h.id)!.status).toBe('accepted');
    });
  });

  // ===========================================================================
  // QUERIES
  // ===========================================================================

  describe('getByArtifact', () => {
    it('should return all handoffs for an artifact', () => {
      manager.create('a1', 'w1', 'w2');
      manager.create('a1', 'w1', 'w3');
      manager.create('a2', 'w1', 'w2');

      const results = manager.getByArtifact('a1');
      expect(results).toHaveLength(2);
    });
  });

  describe('getByWorker', () => {
    it('should filter by sender', () => {
      manager.create('a1', 'w1', 'w2');
      manager.create('a2', 'w1', 'w3');
      manager.create('a3', 'w2', 'w1');

      const sent = manager.getByWorker('w1', 'from');
      expect(sent).toHaveLength(2);
    });

    it('should filter by receiver', () => {
      manager.create('a1', 'w1', 'w2');
      manager.create('a2', 'w1', 'w3');
      manager.create('a3', 'w2', 'w1');

      const received = manager.getByWorker('w1', 'to');
      expect(received).toHaveLength(1);
    });
  });

  describe('getPending', () => {
    it('should return only pending handoffs', () => {
      const h1 = manager.create('a1', 'w1', 'w2');
      manager.create('a2', 'w1', 'w3');
      manager.accept(h1.id);

      const pending = manager.getPending();
      expect(pending).toHaveLength(1);
    });
  });
});
