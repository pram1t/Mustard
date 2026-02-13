import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventBus } from '@openagent/message-bus';
import type { OrchestratorDeps } from '../types.js';

// Mock @openagent/worker so the Orchestrator doesn't create real BaseWorkers/AgentLoops
vi.mock('@openagent/worker', () => {
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
      id: `mock-worker-${Math.random().toString(36).slice(2, 8)}`,
      role: config.role ?? 'backend',
      name: `Mock ${config.role ?? 'backend'}`,
      status: 'idle',
      getStatus: () => 'idle',
      run: async function* (prompt: string) {
        yield { type: 'text', content: `Output for: ${prompt.substring(0, 50)}` };
      },
    }));
    destroy = vi.fn();
  }

  return {
    WorkerRegistry: MockWorkerRegistry,
    WorkerFactory: MockWorkerFactory,
  };
});

// Must import AFTER vi.mock
const { Orchestrator } = await import('../orchestrator.js');

/**
 * Create a mock LLMRouter that returns a pre-built plan.
 */
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

/**
 * Create a mock ToolRegistry.
 */
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

describe('Orchestrator', () => {
  function createTestDeps(steps: any[]): OrchestratorDeps {
    return {
      router: createMockRouter(steps),
      tools: createMockTools(),
      bus: new EventBus(),
    };
  }

  it('should execute a simple one-step plan', async () => {
    const steps = [
      {
        id: 'step-1',
        title: 'Analyze code',
        description: 'Review the codebase',
        assignTo: 'architect',
        priority: 'normal',
        dependencies: [],
        prompt: 'Review the code structure.',
      },
    ];

    const deps = createTestDeps(steps);
    const orchestrator = new Orchestrator({}, deps);

    const result = await orchestrator.execute('Review the code');

    expect(result.planId).toBeDefined();
    expect(result.success).toBe(true);
    expect(result.stepResults).toHaveLength(1);
    expect(result.stepResults[0].status).toBe('completed');
    expect(result.totalDuration).toBeGreaterThanOrEqual(0);
    expect(result.summary).toContain('Successfully completed all 1 steps');
  });

  it('should execute multi-step plan with dependencies', async () => {
    const steps = [
      {
        id: 'step-1',
        title: 'Design',
        description: 'Design the system',
        assignTo: 'architect',
        priority: 'high',
        dependencies: [],
        prompt: 'Design the system.',
      },
      {
        id: 'step-2',
        title: 'Implement',
        description: 'Write the code',
        assignTo: 'backend',
        priority: 'normal',
        dependencies: ['step-1'],
        prompt: 'Write the code.',
      },
    ];

    const deps = createTestDeps(steps);
    const orchestrator = new Orchestrator({}, deps);

    const result = await orchestrator.execute('Build a feature');

    expect(result.success).toBe(true);
    expect(result.stepResults).toHaveLength(2);
    expect(result.summary).toContain('Successfully completed all 2 steps');
  });

  it('should create a plan without executing', async () => {
    const steps = [
      { id: 'step-1', title: 'Test', description: 'test', assignTo: 'backend', priority: 'normal', dependencies: [], prompt: 'test' },
    ];

    const deps = createTestDeps(steps);
    const orchestrator = new Orchestrator({}, deps);

    const plan = await orchestrator.plan('Test request');

    expect(plan.id).toBeDefined();
    expect(plan.request).toBe('Test request');
    expect(plan.steps).toHaveLength(1);
  });

  it('should publish plan events to bus', async () => {
    const steps = [
      { id: 'step-1', title: 'Test', description: 'test', assignTo: 'backend', priority: 'normal', dependencies: [], prompt: 'test' },
    ];

    const bus = new EventBus();
    const handler = vi.fn();
    bus.subscribe('plan.*', handler);

    const deps: OrchestratorDeps = {
      router: createMockRouter(steps),
      tools: createMockTools(),
      bus,
    };

    const orchestrator = new Orchestrator({}, deps);
    await orchestrator.execute('Test');

    // Should have plan.created and plan.completed
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it('should expose the message bus', () => {
    const deps = createTestDeps([]);
    const orchestrator = new Orchestrator({}, deps);
    expect(orchestrator.getBus()).toBeDefined();
  });

  it('should execute a pre-created plan', async () => {
    const steps = [
      { id: 'step-1', title: 'Test', description: 'test', assignTo: 'backend', priority: 'normal', dependencies: [], prompt: 'test' },
    ];

    const deps = createTestDeps(steps);
    const orchestrator = new Orchestrator({}, deps);

    const plan = await orchestrator.plan('Test');
    const result = await orchestrator.executePlan(plan);

    expect(result.success).toBe(true);
    expect(result.stepResults).toHaveLength(1);
  });
});
