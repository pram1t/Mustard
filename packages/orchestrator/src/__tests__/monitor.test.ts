import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProgressMonitor } from '../monitor.js';
import type { ExecutionPlan } from '../types.js';

// ─── Mock queue ──────────────────────────────────────────────

function createMockQueue(tasks: Record<string, { status: string }> = {}) {
  const stats = {
    total: Object.keys(tasks).length,
    pending: 0,
    ready: 0,
    running: 0,
    completed: 0,
    failed: 0,
  };

  for (const t of Object.values(tasks)) {
    if (t.status === 'pending') stats.pending++;
    else if (t.status === 'ready') stats.ready++;
    else if (t.status === 'running') stats.running++;
    else if (t.status === 'completed') stats.completed++;
    else if (t.status === 'failed') stats.failed++;
  }

  return {
    getStats: vi.fn().mockReturnValue(stats),
    get: vi.fn((id: string) => tasks[id] ?? undefined),
  } as any;
}

function createPlan(stepCount = 3): ExecutionPlan {
  return {
    id: 'plan-1',
    request: 'Build something',
    steps: Array.from({ length: stepCount }, (_, i) => ({
      id: `step-${i}`,
      title: `Step ${i}`,
      description: `Do step ${i}`,
      assignTo: 'backend' as const,
      priority: 'medium' as const,
      dependencies: [],
      prompt: `Do step ${i}`,
    })),
    createdAt: new Date(),
  };
}

describe('ProgressMonitor', () => {
  let queue: ReturnType<typeof createMockQueue>;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('getProgress', () => {
    it('returns null when no plan is loaded', () => {
      queue = createMockQueue();
      const monitor = new ProgressMonitor(queue);
      expect(monitor.getProgress()).toBeNull();
    });

    it('returns progress snapshot for a monitored plan', () => {
      queue = createMockQueue({
        'step-0': { status: 'completed' },
        'step-1': { status: 'running' },
        'step-2': { status: 'pending' },
      });

      const monitor = new ProgressMonitor(queue);
      monitor.startMonitoring(createPlan(3));

      const progress = monitor.getProgress();
      expect(progress).not.toBeNull();
      expect(progress!.planId).toBe('plan-1');
      expect(progress!.totalSteps).toBe(3);
      expect(progress!.completedSteps).toBe(1);
      expect(progress!.runningSteps).toBe(1);
      expect(progress!.pendingSteps).toBe(1);
      expect(progress!.progressPercent).toBe(33);
    });

    it('returns 0% for 0 completed steps', () => {
      queue = createMockQueue({
        'step-0': { status: 'pending' },
        'step-1': { status: 'pending' },
      });

      const monitor = new ProgressMonitor(queue);
      monitor.startMonitoring(createPlan(2));
      expect(monitor.getProgress()!.progressPercent).toBe(0);
    });

    it('returns 100% when all steps are completed', () => {
      queue = createMockQueue({
        'step-0': { status: 'completed' },
        'step-1': { status: 'completed' },
      });

      const monitor = new ProgressMonitor(queue);
      monitor.startMonitoring(createPlan(2));
      expect(monitor.getProgress()!.progressPercent).toBe(100);
    });

    it('handles 0 total steps (empty plan)', () => {
      queue = createMockQueue({});
      const monitor = new ProgressMonitor(queue);
      monitor.startMonitoring(createPlan(0));
      expect(monitor.getProgress()!.progressPercent).toBe(0);
    });

    it('includes step details with correct data', () => {
      queue = createMockQueue({
        'step-0': { status: 'completed' },
        'step-1': { status: 'running' },
      });

      const monitor = new ProgressMonitor(queue);
      monitor.startMonitoring(createPlan(2));

      const details = monitor.getProgress()!.stepDetails;
      expect(details).toHaveLength(2);
      expect(details[0]).toEqual({
        stepId: 'step-0',
        title: 'Step 0',
        status: 'completed',
        assignTo: 'backend',
      });
    });

    it('shows unknown status for tasks not in queue', () => {
      queue = createMockQueue({}); // empty queue
      const monitor = new ProgressMonitor(queue);
      monitor.startMonitoring(createPlan(1));

      const details = monitor.getProgress()!.stepDetails;
      expect(details[0].status).toBe('unknown');
    });
  });

  describe('isComplete', () => {
    it('returns false when no plan is loaded', () => {
      queue = createMockQueue();
      const monitor = new ProgressMonitor(queue);
      expect(monitor.isComplete()).toBe(false);
    });

    it('returns true when all tasks are completed', () => {
      queue = createMockQueue({
        'step-0': { status: 'completed' },
        'step-1': { status: 'completed' },
      });

      const monitor = new ProgressMonitor(queue);
      monitor.startMonitoring(createPlan(2));
      expect(monitor.isComplete()).toBe(true);
    });

    it('returns true when tasks are completed or failed (none pending/running)', () => {
      queue = createMockQueue({
        'step-0': { status: 'completed' },
        'step-1': { status: 'failed' },
      });

      const monitor = new ProgressMonitor(queue);
      monitor.startMonitoring(createPlan(2));
      expect(monitor.isComplete()).toBe(true);
    });

    it('returns false when tasks are still running', () => {
      queue = createMockQueue({
        'step-0': { status: 'completed' },
        'step-1': { status: 'running' },
      });

      const monitor = new ProgressMonitor(queue);
      monitor.startMonitoring(createPlan(2));
      expect(monitor.isComplete()).toBe(false);
    });

    it('returns false when tasks are pending', () => {
      queue = createMockQueue({
        'step-0': { status: 'completed' },
        'step-1': { status: 'pending' },
      });

      const monitor = new ProgressMonitor(queue);
      monitor.startMonitoring(createPlan(2));
      expect(monitor.isComplete()).toBe(false);
    });
  });

  describe('hasFailures', () => {
    it('returns false with no failures', () => {
      queue = createMockQueue({
        'step-0': { status: 'completed' },
        'step-1': { status: 'running' },
      });

      const monitor = new ProgressMonitor(queue);
      expect(monitor.hasFailures()).toBe(false);
    });

    it('returns true when any task has failed', () => {
      queue = createMockQueue({
        'step-0': { status: 'completed' },
        'step-1': { status: 'failed' },
      });

      const monitor = new ProgressMonitor(queue);
      expect(monitor.hasFailures()).toBe(true);
    });
  });

  describe('lifecycle', () => {
    it('startMonitoring loads a plan', () => {
      queue = createMockQueue({
        'step-0': { status: 'pending' },
      });

      const monitor = new ProgressMonitor(queue);
      expect(monitor.getProgress()).toBeNull();

      monitor.startMonitoring(createPlan(1));
      expect(monitor.getProgress()).not.toBeNull();
    });

    it('stopMonitoring clears the plan', () => {
      queue = createMockQueue({
        'step-0': { status: 'pending' },
      });

      const monitor = new ProgressMonitor(queue);
      monitor.startMonitoring(createPlan(1));
      expect(monitor.getProgress()).not.toBeNull();

      monitor.stopMonitoring();
      expect(monitor.getProgress()).toBeNull();
    });

    it('unsubscribes bus events on stopMonitoring', () => {
      const unsub = vi.fn();
      const mockBus = {
        subscribe: vi.fn().mockReturnValue(unsub),
      } as any;

      queue = createMockQueue();
      const monitor = new ProgressMonitor(queue, mockBus);
      monitor.startMonitoring(createPlan(1));
      expect(mockBus.subscribe).toHaveBeenCalledWith('task.*', expect.any(Function));

      monitor.stopMonitoring();
      expect(unsub).toHaveBeenCalled();
    });

    it('does not subscribe to bus events if no bus provided', () => {
      queue = createMockQueue();
      const monitor = new ProgressMonitor(queue); // no bus
      monitor.startMonitoring(createPlan(1));
      // Should not throw
      monitor.stopMonitoring();
    });
  });
});
