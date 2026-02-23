import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SqliteTaskQueue } from '../sqlite-queue.js';

describe('SqliteTaskQueue', () => {
  let queue: SqliteTaskQueue;

  beforeEach(() => {
    queue = new SqliteTaskQueue(':memory:');
  });

  afterEach(() => {
    queue.close();
  });

  describe('add', () => {
    it('should create a task with ready status when no deps', () => {
      const task = queue.add({ title: 'Build UI', description: 'Create the frontend', priority: 'high' });
      expect(task.id).toBeDefined();
      expect(task.title).toBe('Build UI');
      expect(task.status).toBe('ready');
      expect(task.priority).toBe('high');
    });

    it('should create a task with pending status when has deps', () => {
      const t1 = queue.add({ title: 'Design', description: 'Design API' });
      const t2 = queue.add({ title: 'Build', description: 'Build API', dependencies: [t1.id] });
      expect(t2.status).toBe('pending');
    });

    it('should use custom id if provided', () => {
      const task = queue.add({ id: 'my-id', title: 'Test', description: 'Test task' });
      expect(task.id).toBe('my-id');
    });
  });

  describe('getNext', () => {
    it('should return highest priority ready task', () => {
      queue.add({ title: 'Low', description: 'Low task', priority: 'low' });
      queue.add({ title: 'Critical', description: 'Critical task', priority: 'critical' });
      queue.add({ title: 'Normal', description: 'Normal task' });

      const next = queue.getNext();
      expect(next).not.toBeNull();
      expect(next!.title).toBe('Critical');
    });

    it('should return FIFO within same priority', () => {
      queue.add({ title: 'First', description: 'First task', priority: 'high' });
      queue.add({ title: 'Second', description: 'Second task', priority: 'high' });

      const next = queue.getNext();
      expect(next!.title).toBe('First');
    });

    it('should skip pending tasks (unresolved deps)', () => {
      const t1 = queue.add({ title: 'Dep', description: 'Dependency' });
      queue.add({ title: 'Blocked', description: 'Blocked task', dependencies: [t1.id] });
      queue.add({ title: 'Free', description: 'Free task', priority: 'low' });

      const next = queue.getNext();
      // Dep is ready and higher priority than Free
      expect(next!.title).toBe('Dep');
    });

    it('should return null when no ready tasks', () => {
      const t1 = queue.add({ title: 'Dep', description: 'Dep' });
      queue.add({ title: 'Blocked', description: 'Blocked', dependencies: [t1.id] });
      queue.start(t1.id); // t1 is now running, not ready
      expect(queue.getNext()?.title).toBe(undefined);
    });
  });

  describe('lifecycle', () => {
    it('should transition through full lifecycle', () => {
      const task = queue.add({ title: 'Work', description: 'Do work' });
      expect(task.status).toBe('ready');

      const started = queue.start(task.id);
      expect(started.status).toBe('running');
      expect(started.startedAt).toBeDefined();

      const completed = queue.complete(task.id, { output: 'done' });
      expect(completed.status).toBe('completed');
      expect(completed.completedAt).toBeDefined();
      expect(completed.result).toEqual({ output: 'done' });
    });

    it('should handle failure', () => {
      const task = queue.add({ title: 'Fail', description: 'Will fail' });
      queue.start(task.id);
      const failed = queue.fail(task.id, 'Something broke');
      expect(failed.status).toBe('failed');
      expect(failed.error).toBe('Something broke');
    });

    it('should handle cancellation', () => {
      const task = queue.add({ title: 'Cancel', description: 'Will cancel' });
      const cancelled = queue.cancel(task.id);
      expect(cancelled.status).toBe('cancelled');
    });

    it('should reject invalid transitions', () => {
      const task = queue.add({ title: 'Test', description: 'Test' });
      expect(() => queue.complete(task.id)).toThrow('expected "running"');
    });
  });

  describe('dependency resolution', () => {
    it('should mark dependent task ready when deps complete', () => {
      const t1 = queue.add({ title: 'First', description: 'First' });
      const t2 = queue.add({ title: 'Second', description: 'Second', dependencies: [t1.id] });
      expect(queue.get(t2.id)!.status).toBe('pending');

      queue.start(t1.id);
      queue.complete(t1.id);

      // getNext should update ready status
      const next = queue.getNext();
      expect(next!.title).toBe('Second');
    });

    it('should handle multi-dep chains', () => {
      const t1 = queue.add({ title: 'A', description: 'A' });
      const t2 = queue.add({ title: 'B', description: 'B' });
      const t3 = queue.add({ title: 'C', description: 'C', dependencies: [t1.id, t2.id] });

      queue.start(t1.id);
      queue.complete(t1.id);
      // t3 still pending — t2 not done
      expect(queue.get(t3.id)!.status).toBe('pending');

      queue.start(t2.id);
      queue.complete(t2.id);
      // Now t3 should become ready
      const next = queue.getNext();
      expect(next!.title).toBe('C');
    });
  });

  describe('queries', () => {
    it('getAll returns all tasks', () => {
      queue.add({ title: 'A', description: 'A' });
      queue.add({ title: 'B', description: 'B' });
      expect(queue.getAll()).toHaveLength(2);
    });

    it('getByStatus filters correctly', () => {
      const t1 = queue.add({ title: 'A', description: 'A' });
      queue.add({ title: 'B', description: 'B' });
      queue.start(t1.id);
      expect(queue.getByStatus('running')).toHaveLength(1);
      expect(queue.getByStatus('ready')).toHaveLength(1);
    });

    it('getStats returns correct counts', () => {
      const t1 = queue.add({ title: 'A', description: 'A' });
      queue.add({ title: 'B', description: 'B' });
      queue.start(t1.id);
      const stats = queue.getStats();
      expect(stats.total).toBe(2);
      expect(stats.running).toBe(1);
      expect(stats.ready).toBe(1);
    });
  });

  describe('clear', () => {
    it('should remove all tasks', () => {
      queue.add({ title: 'A', description: 'A' });
      queue.add({ title: 'B', description: 'B' });
      queue.clear();
      expect(queue.getAll()).toHaveLength(0);
      expect(queue.getStats().total).toBe(0);
    });
  });

  describe('persistence', () => {
    it('should return persisted data from get()', () => {
      const task = queue.add({
        title: 'Persist',
        description: 'Test persistence',
        priority: 'high',
        metadata: { key: 'value' },
      });
      const fetched = queue.get(task.id)!;
      expect(fetched.title).toBe('Persist');
      expect(fetched.priority).toBe('high');
      expect(fetched.metadata).toEqual({ key: 'value' });
    });
  });
});
