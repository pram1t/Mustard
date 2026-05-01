import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TaskQueue } from '../task-queue.js';
import { EventBus } from '@mustard/message-bus';
import type { TaskInput } from '../types.js';

describe('TaskQueue', () => {
  let queue: TaskQueue;
  let bus: EventBus;

  beforeEach(() => {
    bus = new EventBus();
    queue = new TaskQueue(bus);
  });

  function input(overrides: Partial<TaskInput> = {}): TaskInput {
    return {
      title: 'Test Task',
      description: 'A test task',
      priority: 'normal',
      ...overrides,
    };
  }

  // ===========================================================================
  // ADD
  // ===========================================================================

  describe('add', () => {
    it('should create a task with generated ID', () => {
      const task = queue.add(input());
      expect(task.id).toBeDefined();
      expect(task.title).toBe('Test Task');
      expect(task.priority).toBe('normal');
      expect(task.retryCount).toBe(0);
    });

    it('should use provided ID', () => {
      const task = queue.add(input({ id: 'custom-id' }));
      expect(task.id).toBe('custom-id');
    });

    it('should mark as ready when no dependencies', () => {
      const task = queue.add(input());
      expect(task.status).toBe('ready');
    });

    it('should mark as pending when has dependencies', () => {
      queue.add(input({ id: 'dep-1' }));
      const task = queue.add(input({ dependencies: ['dep-1'] }));
      expect(task.status).toBe('pending');
    });

    it('should publish task.created event', () => {
      const handler = vi.fn();
      bus.subscribe('task.created', handler);
      queue.add(input());
      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  // ===========================================================================
  // PRIORITY ORDERING
  // ===========================================================================

  describe('getNext (priority)', () => {
    it('should return highest priority task first', () => {
      queue.add(input({ id: 'low', title: 'Low', priority: 'low' }));
      queue.add(input({ id: 'critical', title: 'Critical', priority: 'critical' }));
      queue.add(input({ id: 'high', title: 'High', priority: 'high' }));

      const next = queue.getNext();
      expect(next).not.toBeNull();
      expect(next!.id).toBe('critical');
    });

    it('should return FIFO within same priority', () => {
      queue.add(input({ id: 'first', title: 'First' }));
      queue.add(input({ id: 'second', title: 'Second' }));

      const next = queue.getNext();
      expect(next!.id).toBe('first');
    });

    it('should return null when no ready tasks', () => {
      expect(queue.getNext()).toBeNull();
    });

    it('should skip running/completed/failed tasks', () => {
      const t = queue.add(input({ id: 't1' }));
      queue.start(t.id);

      expect(queue.getNext()).toBeNull();
    });
  });

  // ===========================================================================
  // DEPENDENCY HANDLING
  // ===========================================================================

  describe('dependencies', () => {
    it('should not return task with unsatisfied dependencies', () => {
      queue.add(input({ id: 'dep-1' }));
      queue.add(input({ id: 'task-1', dependencies: ['dep-1'] }));

      // dep-1 is ready, task-1 is pending
      const next = queue.getNext();
      expect(next!.id).toBe('dep-1');
    });

    it('should make task ready after dependency completes', () => {
      const dep = queue.add(input({ id: 'dep-1' }));
      queue.add(input({ id: 'task-1', dependencies: ['dep-1'] }));

      queue.start(dep.id);
      queue.complete(dep.id);

      // Now task-1 should be ready
      const next = queue.getNext();
      expect(next).not.toBeNull();
      expect(next!.id).toBe('task-1');
    });

    it('should handle chained dependencies', () => {
      queue.add(input({ id: 'a' }));
      queue.add(input({ id: 'b', dependencies: ['a'] }));
      queue.add(input({ id: 'c', dependencies: ['b'] }));

      // Only 'a' should be ready
      expect(queue.getNext()!.id).toBe('a');

      // Complete a → b becomes ready
      queue.start('a');
      queue.complete('a');
      expect(queue.getNext()!.id).toBe('b');

      // Complete b → c becomes ready
      queue.start('b');
      queue.complete('b');
      expect(queue.getNext()!.id).toBe('c');
    });
  });

  // ===========================================================================
  // LIFECYCLE
  // ===========================================================================

  describe('start', () => {
    it('should transition ready → running', () => {
      const t = queue.add(input());
      queue.start(t.id);
      expect(queue.get(t.id)!.status).toBe('running');
      expect(queue.get(t.id)!.startedAt).toBeInstanceOf(Date);
    });

    it('should throw for non-ready task', () => {
      queue.add(input({ id: 'dep' }));
      const t = queue.add(input({ dependencies: ['dep'] }));
      expect(() => queue.start(t.id)).toThrow('expected "ready"');
    });
  });

  describe('complete', () => {
    it('should transition running → completed', () => {
      const t = queue.add(input());
      queue.start(t.id);
      queue.complete(t.id, { output: 'done' });

      const completed = queue.get(t.id)!;
      expect(completed.status).toBe('completed');
      expect(completed.result).toEqual({ output: 'done' });
      expect(completed.completedAt).toBeInstanceOf(Date);
    });

    it('should throw for non-running task', () => {
      const t = queue.add(input());
      expect(() => queue.complete(t.id)).toThrow('expected "running"');
    });

    it('should publish task.completed event', () => {
      const handler = vi.fn();
      bus.subscribe('task.completed', handler);

      const t = queue.add(input());
      queue.start(t.id);
      queue.complete(t.id);

      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe('fail', () => {
    it('should transition running → failed', () => {
      const t = queue.add(input());
      queue.start(t.id);
      queue.fail(t.id, 'Something went wrong');

      const failed = queue.get(t.id)!;
      expect(failed.status).toBe('failed');
      expect(failed.error).toBe('Something went wrong');
    });

    it('should publish task.failed event', () => {
      const handler = vi.fn();
      bus.subscribe('task.failed', handler);

      const t = queue.add(input());
      queue.start(t.id);
      queue.fail(t.id, 'error');

      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe('cancel', () => {
    it('should cancel a ready task', () => {
      const t = queue.add(input());
      queue.cancel(t.id);
      expect(queue.get(t.id)!.status).toBe('cancelled');
    });

    it('should cancel a running task', () => {
      const t = queue.add(input());
      queue.start(t.id);
      queue.cancel(t.id);
      expect(queue.get(t.id)!.status).toBe('cancelled');
    });

    it('should throw when cancelling completed task', () => {
      const t = queue.add(input());
      queue.start(t.id);
      queue.complete(t.id);
      expect(() => queue.cancel(t.id)).toThrow('Cannot cancel');
    });
  });

  // ===========================================================================
  // QUERIES
  // ===========================================================================

  describe('getByStatus', () => {
    it('should filter by status', () => {
      queue.add(input({ id: 't1' }));
      queue.add(input({ id: 't2' }));
      const t3 = queue.add(input({ id: 't3' }));
      queue.start(t3.id);

      expect(queue.getByStatus('ready')).toHaveLength(2);
      expect(queue.getByStatus('running')).toHaveLength(1);
    });
  });

  describe('getStats', () => {
    it('should return accurate counts', () => {
      queue.add(input({ id: 't1' }));
      queue.add(input({ id: 't2' }));
      const t3 = queue.add(input({ id: 't3' }));
      queue.start(t3.id);
      queue.complete(t3.id);

      const stats = queue.getStats();
      expect(stats.total).toBe(3);
      expect(stats.ready).toBe(2);
      expect(stats.completed).toBe(1);
    });
  });

  describe('clear', () => {
    it('should remove all tasks', () => {
      queue.add(input());
      queue.add(input());
      queue.clear();
      expect(queue.getAll()).toHaveLength(0);
    });
  });

  // ===========================================================================
  // WITHOUT BUS
  // ===========================================================================

  describe('without bus', () => {
    it('should work without a message bus', () => {
      const noBusQueue = new TaskQueue();
      const t = noBusQueue.add(input());
      noBusQueue.start(t.id);
      noBusQueue.complete(t.id);
      expect(noBusQueue.get(t.id)!.status).toBe('completed');
    });
  });
});
