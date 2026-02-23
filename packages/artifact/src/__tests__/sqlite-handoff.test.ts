import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { SqliteHandoffManager } from '../sqlite-handoff.js';
import type { ReviewFeedback } from '../types.js';

describe('SqliteHandoffManager', () => {
  let db: Database.Database;
  let manager: SqliteHandoffManager;

  beforeEach(() => {
    db = new Database(':memory:');
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    manager = new SqliteHandoffManager(db);
  });

  afterEach(() => {
    db.close();
  });

  const feedback: ReviewFeedback = {
    decision: 'request_changes',
    comments: ['Needs more detail'],
    blockers: ['Missing error handling'],
    suggestions: ['Add retry logic'],
  };

  describe('create', () => {
    it('should create a pending handoff', () => {
      const h = manager.create('art-1', 'worker-a', 'worker-b', 'Please review');
      expect(h.id).toBeDefined();
      expect(h.artifactId).toBe('art-1');
      expect(h.fromWorker).toBe('worker-a');
      expect(h.toWorker).toBe('worker-b');
      expect(h.status).toBe('pending');
      expect(h.message).toBe('Please review');
    });

    it('should persist across get calls', () => {
      const created = manager.create('art-1', 'w-a', 'w-b');
      const fetched = manager.get(created.id);
      expect(fetched).toBeDefined();
      expect(fetched!.id).toBe(created.id);
      expect(fetched!.status).toBe('pending');
    });
  });

  describe('accept', () => {
    it('should transition pending → accepted', () => {
      const h = manager.create('art-1', 'w-a', 'w-b');
      const accepted = manager.accept(h.id);
      expect(accepted.status).toBe('accepted');
      expect(accepted.resolvedAt).toBeDefined();
    });

    it('should persist the accepted state', () => {
      const h = manager.create('art-1', 'w-a', 'w-b');
      manager.accept(h.id);
      const fetched = manager.get(h.id)!;
      expect(fetched.status).toBe('accepted');
    });

    it('should reject transition from terminal state', () => {
      const h = manager.create('art-1', 'w-a', 'w-b');
      manager.accept(h.id);
      expect(() => manager.accept(h.id)).toThrow('Invalid handoff transition');
    });
  });

  describe('reject', () => {
    it('should transition pending → rejected with feedback', () => {
      const h = manager.create('art-1', 'w-a', 'w-b');
      const rejected = manager.reject(h.id, { decision: 'reject', comments: ['Bad'] });
      expect(rejected.status).toBe('rejected');
      expect(rejected.feedback?.comments).toEqual(['Bad']);
      expect(rejected.resolvedAt).toBeDefined();
    });
  });

  describe('requestChanges', () => {
    it('should transition pending → changes_requested', () => {
      const h = manager.create('art-1', 'w-a', 'w-b');
      const changed = manager.requestChanges(h.id, feedback);
      expect(changed.status).toBe('changes_requested');
      expect(changed.feedback?.blockers).toEqual(['Missing error handling']);
    });
  });

  describe('resubmit', () => {
    it('should transition changes_requested → pending', () => {
      const h = manager.create('art-1', 'w-a', 'w-b');
      manager.requestChanges(h.id, feedback);
      const resubmitted = manager.resubmit(h.id, 'Fixed issues');
      expect(resubmitted.status).toBe('pending');
      expect(resubmitted.message).toBe('Fixed issues');
      expect(resubmitted.feedback).toBeUndefined();
    });

    it('should reject resubmit from pending', () => {
      const h = manager.create('art-1', 'w-a', 'w-b');
      expect(() => manager.resubmit(h.id)).toThrow('Invalid handoff transition');
    });
  });

  describe('queries', () => {
    it('should find by artifact', () => {
      manager.create('art-1', 'w-a', 'w-b');
      manager.create('art-1', 'w-a', 'w-c');
      manager.create('art-2', 'w-a', 'w-b');
      expect(manager.getByArtifact('art-1')).toHaveLength(2);
    });

    it('should find by worker (from)', () => {
      manager.create('art-1', 'w-a', 'w-b');
      manager.create('art-2', 'w-a', 'w-c');
      manager.create('art-3', 'w-b', 'w-a');
      expect(manager.getByWorker('w-a', 'from')).toHaveLength(2);
    });

    it('should find by worker (to)', () => {
      manager.create('art-1', 'w-a', 'w-b');
      manager.create('art-2', 'w-c', 'w-b');
      expect(manager.getByWorker('w-b', 'to')).toHaveLength(2);
    });

    it('should find pending only', () => {
      const h1 = manager.create('art-1', 'w-a', 'w-b');
      manager.create('art-2', 'w-a', 'w-c');
      manager.accept(h1.id);
      const pending = manager.getPending();
      expect(pending).toHaveLength(1);
    });
  });

  describe('error cases', () => {
    it('should throw for non-existent handoff on get transitions', () => {
      expect(() => manager.accept('bad-id')).toThrow('Handoff not found: bad-id');
    });
  });
});
