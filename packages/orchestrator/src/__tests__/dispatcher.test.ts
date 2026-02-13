import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventBus } from '@openagent/message-bus';
import { TaskQueue } from '@openagent/queue';
import { Dispatcher } from '../dispatcher.js';
import type { ExecutionPlan } from '../types.js';

// Mock WorkerFactory that creates mock workers
function createMockFactory(outputs: Record<string, string> = {}) {
  return {
    create: vi.fn((config: any) => ({
      id: `mock-worker-${Math.random().toString(36).slice(2, 8)}`,
      role: config.role,
      name: `Mock ${config.role}`,
      status: 'idle',
      getStatus: () => 'idle',
      run: async function* (prompt: string) {
        const output = outputs[config.role] ?? `Output for: ${prompt.substring(0, 50)}`;
        yield { type: 'text', content: output };
      },
    })),
    destroy: vi.fn(),
  } as any;
}

// Mock WorkerFactory that throws errors
function createFailingFactory(error: string) {
  return {
    create: vi.fn(() => ({
      id: 'failing-worker',
      role: 'backend',
      name: 'Failing Worker',
      status: 'idle',
      getStatus: () => 'idle',
      run: async function* () {
        throw new Error(error);
      },
    })),
    destroy: vi.fn(),
  } as any;
}

describe('Dispatcher', () => {
  let bus: EventBus;
  let queue: TaskQueue;

  beforeEach(() => {
    bus = new EventBus();
    queue = new TaskQueue(bus);
  });

  const testPlan: ExecutionPlan = {
    id: 'plan-1',
    request: 'Build a login page',
    steps: [
      {
        id: 'step-1',
        title: 'Design architecture',
        description: 'Design the login system',
        assignTo: 'architect',
        priority: 'high',
        dependencies: [],
        prompt: 'Design the login architecture.',
      },
      {
        id: 'step-2',
        title: 'Implement backend',
        description: 'Create auth endpoints',
        assignTo: 'backend',
        priority: 'normal',
        dependencies: ['step-1'],
        prompt: 'Implement the auth API.',
      },
      {
        id: 'step-3',
        title: 'Implement frontend',
        description: 'Create login form',
        assignTo: 'frontend',
        priority: 'normal',
        dependencies: ['step-1'],
        prompt: 'Create the login page.',
      },
    ],
    createdAt: new Date(),
  };

  describe('loadPlan', () => {
    it('should add all steps to the queue', () => {
      const factory = createMockFactory();
      const dispatcher = new Dispatcher(queue, factory, bus);

      dispatcher.loadPlan(testPlan);

      expect(queue.getAll()).toHaveLength(3);
    });

    it('should preserve dependencies', () => {
      const factory = createMockFactory();
      const dispatcher = new Dispatcher(queue, factory, bus);

      dispatcher.loadPlan(testPlan);

      const step2 = queue.get('step-2');
      expect(step2!.dependencies).toEqual(['step-1']);
    });
  });

  describe('dispatchNext', () => {
    it('should dispatch the highest-priority ready task', async () => {
      const factory = createMockFactory();
      const dispatcher = new Dispatcher(queue, factory, bus);

      dispatcher.loadPlan(testPlan);

      // step-1 is the only ready task (no deps, high priority)
      const result = await dispatcher.dispatchNext();
      expect(result).not.toBeNull();
      expect(result!.stepId).toBe('step-1');
      expect(result!.status).toBe('completed');
    });

    it('should return null when no tasks are ready', async () => {
      const factory = createMockFactory();
      const dispatcher = new Dispatcher(queue, factory, bus);

      const result = await dispatcher.dispatchNext();
      expect(result).toBeNull();
    });

    it('should handle worker failures', async () => {
      const factory = createFailingFactory('Worker crashed');
      const dispatcher = new Dispatcher(queue, factory, bus);

      queue.add({ id: 'task-1', title: 'Test', description: 'Test', priority: 'normal' });

      const result = await dispatcher.dispatchNext();
      expect(result).not.toBeNull();
      expect(result!.status).toBe('failed');
      expect(result!.error).toBe('Worker crashed');
    });

    it('should execute dependent tasks after dependencies complete', async () => {
      const factory = createMockFactory();
      const dispatcher = new Dispatcher(queue, factory, bus);

      dispatcher.loadPlan(testPlan);

      // Execute step-1 (architect)
      const r1 = await dispatcher.dispatchNext();
      expect(r1!.stepId).toBe('step-1');

      // Now step-2 and step-3 should be ready
      const r2 = await dispatcher.dispatchNext();
      expect(['step-2', 'step-3']).toContain(r2!.stepId);

      const r3 = await dispatcher.dispatchNext();
      expect(['step-2', 'step-3']).toContain(r3!.stepId);
    });
  });

  describe('hasMore', () => {
    it('should return true when tasks remain', () => {
      const factory = createMockFactory();
      const dispatcher = new Dispatcher(queue, factory, bus);

      dispatcher.loadPlan(testPlan);
      expect(dispatcher.hasMore()).toBe(true);
    });

    it('should return false when all complete', async () => {
      const factory = createMockFactory();
      const dispatcher = new Dispatcher(queue, factory, bus);

      queue.add({ id: 't1', title: 'Test', description: 'Test' });

      await dispatcher.dispatchNext();
      expect(dispatcher.hasMore()).toBe(false);
    });
  });

  describe('getResults', () => {
    it('should collect all step results', async () => {
      const factory = createMockFactory();
      const dispatcher = new Dispatcher(queue, factory, bus);

      queue.add({ id: 't1', title: 'A', description: 'A' });
      queue.add({ id: 't2', title: 'B', description: 'B' });

      await dispatcher.dispatchNext();
      await dispatcher.dispatchNext();

      expect(dispatcher.getResults()).toHaveLength(2);
    });
  });
});
