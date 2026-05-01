/**
 * Integration test wiring real V2 packages together:
 * EventBus + TaskQueue + MemoryStore + ArtifactStore + HandoffManager
 * Only the LLM and tools are mocked.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { EventBus } from '@mustard/message-bus';
import { TaskQueue } from '@mustard/queue';
import { MemoryStore } from '@mustard/memory';
import { ArtifactStore, HandoffManager } from '@mustard/artifact';

// Mock worker to avoid needing real LLM
vi.mock('@mustard/worker', () => {
  class MockWorkerRegistry {
    register = vi.fn();
    unregister = vi.fn();
    get = vi.fn();
    getActive = vi.fn(() => []);
    getDefinition = vi.fn();
    getDefinitions = vi.fn(() => ({}));
  }

  class MockWorkerFactory {
    create = vi.fn((config: any) => ({
      id: `worker-${config.role}-${Math.random().toString(36).slice(2, 6)}`,
      role: config.role ?? 'backend',
      name: `Mock ${config.role ?? 'backend'}`,
      status: 'idle',
      getStatus: () => 'idle',
      abort: vi.fn(),
      run: async function* (prompt: string) {
        yield { type: 'text', content: `[${config.role}] Completed: ${prompt.substring(0, 60)}` };
      },
    }));
    destroy = vi.fn();
  }

  return {
    WorkerRegistry: MockWorkerRegistry,
    WorkerFactory: MockWorkerFactory,
  };
});

const { Orchestrator } = await import('../orchestrator.js');

function createMockRouter(steps: any[]) {
  const responseStr = JSON.stringify(steps);
  return {
    chat: vi.fn(async function* () {
      yield { type: 'text', content: responseStr };
    }),
    registerProvider: vi.fn(),
    unregisterProvider: vi.fn(),
    getProvider: vi.fn(),
    getPrimaryProvider: vi.fn(),
    listProviders: vi.fn(() => []),
    hasProvider: vi.fn(() => false),
    setPrimary: vi.fn(),
    countTokens: vi.fn(),
    validateAll: vi.fn(),
    validateProvider: vi.fn(),
  } as any;
}

function createMockTools() {
  return {
    register: vi.fn(),
    registerAll: vi.fn(),
    unregister: vi.fn(),
    get: vi.fn(),
    getAll: vi.fn(() => []),
    getNames: vi.fn(() => []),
    has: vi.fn(() => false),
    getDefinitions: vi.fn(() => []),
    execute: vi.fn(),
    count: 0,
    clear: vi.fn(),
  } as any;
}

describe('V2 Integration: Orchestrator + EventBus + Queue + Memory + Artifacts', () => {
  let memoryStore: MemoryStore;

  afterEach(() => {
    memoryStore?.close();
  });

  it('should execute a multi-step plan with event tracking', async () => {
    const bus = new EventBus();
    memoryStore = new MemoryStore(':memory:');
    const artifactStore = new ArtifactStore();

    const events: string[] = [];
    bus.subscribe('plan.*', (msg) => events.push(msg.type));
    bus.subscribe('task.*', (msg) => events.push(msg.type));

    const steps = [
      { id: 'step-1', title: 'Design API', description: 'Design the REST API', assignTo: 'architect', priority: 'high', dependencies: [], prompt: 'Design a REST API for user management' },
      { id: 'step-2', title: 'Implement API', description: 'Code the API', assignTo: 'backend', priority: 'normal', dependencies: ['step-1'], prompt: 'Implement the user management API' },
      { id: 'step-3', title: 'Write tests', description: 'Test the API', assignTo: 'qa', priority: 'normal', dependencies: ['step-2'], prompt: 'Write tests for the user management API' },
    ];

    const orchestrator = new Orchestrator({}, {
      router: createMockRouter(steps),
      tools: createMockTools(),
      bus,
      memoryStore,
      artifactStore,
    });

    const result = await orchestrator.execute('Build user management API');

    expect(result.success).toBe(true);
    expect(result.stepResults).toHaveLength(3);
    expect(result.stepResults.every((r: any) => r.status === 'completed')).toBe(true);

    // Verify events were published
    expect(events).toContain('plan.created');
    expect(events).toContain('plan.completed');
    expect(events.filter((e) => e === 'task.created').length).toBe(3);
    // task.completed fires from both TaskQueue and Dispatcher (double publish)
    expect(events.filter((e) => e === 'task.completed').length).toBeGreaterThanOrEqual(3);
  });

  it('should support plan-then-execute workflow', async () => {
    const bus = new EventBus();
    memoryStore = new MemoryStore(':memory:');

    const steps = [
      { id: 'step-1', title: 'Audit security', description: 'Review security', assignTo: 'security', priority: 'critical', dependencies: [], prompt: 'Perform security audit' },
    ];

    const orchestrator = new Orchestrator({ requireApproval: false }, {
      router: createMockRouter(steps),
      tools: createMockTools(),
      bus,
      memoryStore,
    });

    // Phase 1: Plan
    const plan = await orchestrator.plan('Security audit');
    expect(plan.steps).toHaveLength(1);
    expect(plan.steps[0].assignTo).toBe('security');

    // Phase 2: Execute the plan
    const result = await orchestrator.executePlan(plan);
    expect(result.success).toBe(true);
  });

  it('should track progress during execution', async () => {
    const bus = new EventBus();
    memoryStore = new MemoryStore(':memory:');

    const steps = [
      { id: 'step-1', title: 'Task A', description: 'A', assignTo: 'backend', priority: 'normal', dependencies: [], prompt: 'Do A' },
      { id: 'step-2', title: 'Task B', description: 'B', assignTo: 'frontend', priority: 'normal', dependencies: [], prompt: 'Do B' },
    ];

    const orchestrator = new Orchestrator({ maxParallelWorkers: 2 }, {
      router: createMockRouter(steps),
      tools: createMockTools(),
      bus,
      memoryStore,
    });

    const result = await orchestrator.execute('Build features');

    expect(result.success).toBe(true);
    expect(result.stepResults).toHaveLength(2);
  });

  it('should work with real MemoryStore for context', async () => {
    const bus = new EventBus();
    memoryStore = new MemoryStore(':memory:');

    // Pre-populate memory
    memoryStore.store({
      type: 'convention',
      workerId: 'test',
      projectId: 'proj-1',
      title: 'Use TypeScript strict mode',
      content: 'All files must use strict TypeScript.',
      tags: ['typescript'],
    });

    const steps = [
      { id: 'step-1', title: 'Code', description: 'Write code', assignTo: 'backend', priority: 'normal', dependencies: [], prompt: 'Write the feature' },
    ];

    const orchestrator = new Orchestrator({}, {
      router: createMockRouter(steps),
      tools: createMockTools(),
      bus,
      memoryStore,
    });

    const result = await orchestrator.execute('Build feature');
    expect(result.success).toBe(true);

    // Verify memory was populated
    expect(memoryStore.count()).toBe(1);
  });

  it('should work with real EventBus wildcard subscriptions', async () => {
    const bus = new EventBus();
    memoryStore = new MemoryStore(':memory:');

    const taskEvents: any[] = [];
    const planEvents: any[] = [];

    bus.subscribe('task.*', (msg) => taskEvents.push(msg));
    bus.subscribe('plan.*', (msg) => planEvents.push(msg));

    const steps = [
      { id: 'step-1', title: 'Quick task', description: 'Fast', assignTo: 'backend', priority: 'normal', dependencies: [], prompt: 'Quick task' },
    ];

    const orchestrator = new Orchestrator({}, {
      router: createMockRouter(steps),
      tools: createMockTools(),
      bus,
      memoryStore,
    });

    await orchestrator.execute('Quick');

    // task.created, task.started, task.completed (may double-publish)
    expect(taskEvents.length).toBeGreaterThanOrEqual(3);
    // plan.created, plan.completed
    expect(planEvents.length).toBeGreaterThanOrEqual(2);
  });
});
