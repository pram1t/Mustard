/**
 * Server API tests using Fastify inject().
 */
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { EventBus } from '@pram1t/mustard-message-bus';

// Mock @pram1t/mustard-worker
vi.mock('@pram1t/mustard-worker', () => {
  class MockWorkerRegistry {
    register = vi.fn();
    unregister = vi.fn();
    get = vi.fn();
    getActive = vi.fn(() => []);
    getActiveWorkers = vi.fn(() => []);
    getActiveCount = vi.fn(() => 0);
    getDefinition = vi.fn((role: string) => {
      if (role === 'architect') {
        return {
          role: 'architect',
          name: 'Architect',
          description: 'System architect',
          skills: [{ name: 'Design', description: 'System design', proficiency: 'expert' }],
          tools: { allowed: [], denied: [] },
          prompt: { expertise: [], responsibilities: [], artifacts: { produces: [], consumes: [] } },
        };
      }
      return undefined;
    });
    getAllDefinitions = vi.fn(() => [
      { role: 'architect', name: 'Architect', description: 'Arch', skills: [{ name: 'x', description: 'y', proficiency: 'expert' }], tools: { allowed: [], denied: [] } },
      { role: 'backend', name: 'Backend', description: 'Back', skills: [], tools: { allowed: [], denied: [] } },
    ]);
    getRegisteredRoles = vi.fn(() => ['architect', 'backend']);
    registerDefinition = vi.fn();
    hasDefinition = vi.fn(() => true);
    trackWorker = vi.fn();
    untrackWorker = vi.fn();
    getWorker = vi.fn();
    getWorkersByRole = vi.fn(() => []);
    clearActiveWorkers = vi.fn();
  }

  class MockWorkerFactory {
    create = vi.fn();
    destroy = vi.fn();
  }

  return { WorkerRegistry: MockWorkerRegistry, WorkerFactory: MockWorkerFactory };
});

// Mock @pram1t/mustard-orchestrator
vi.mock('@pram1t/mustard-orchestrator', () => {
  class MockOrchestrator {
    config: any;
    deps: any;
    constructor(config: any, deps: any) {
      this.config = config;
      this.deps = deps;
    }
    async plan(prompt: string) {
      return {
        id: 'plan-test-1',
        request: prompt,
        steps: [
          { id: 'step-1', title: 'Design', description: 'Design it', assignTo: 'architect', priority: 'normal', dependencies: [], prompt: 'Design' },
        ],
        createdAt: new Date('2025-01-01'),
      };
    }
    async executePlan(plan: any) {
      this.deps.bus.publish('plan.created', { planId: plan.id, steps: 1 });
      this.deps.bus.publish('task.completed', { taskId: 'step-1', title: 'Design', duration: 100 });
      return {
        planId: plan.id,
        success: true,
        stepResults: [{ stepId: 'step-1', status: 'completed', duration: 100, output: 'done' }],
        totalDuration: 100,
        summary: 'Successfully completed all 1 steps.',
      };
    }
    async execute(prompt: string) {
      return this.executePlan({ id: 'plan-exec-1', request: prompt, steps: [], createdAt: new Date() });
    }
    getProgress() { return null; }
    getBus() { return this.deps.bus; }
    setPlanApprovalCallback() {}
    setStepApprovalCallback() {}
  }
  return { Orchestrator: MockOrchestrator };
});

const { createServer } = await import('../server.js');

function createMockRouter() {
  return {
    chat: vi.fn(async function* () { yield { type: 'text', content: '[]' }; }),
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
    register: vi.fn(), registerAll: vi.fn(), unregister: vi.fn(), get: vi.fn(),
    getAll: vi.fn(() => []), getNames: vi.fn(() => []), has: vi.fn(() => false),
    getDefinitions: vi.fn(() => []), execute: vi.fn(), count: 0, clear: vi.fn(),
  } as any;
}

describe('OpenAgent API Server', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    const bus = new EventBus();
    app = await createServer({ port: 0 }, {
      router: createMockRouter(),
      tools: createMockTools(),
      bus,
    });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /health', () => {
    it('should return health status', async () => {
      const res = await app.inject({ method: 'GET', url: '/health' });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.status).toBe('ok');
      expect(body.version).toBe('0.0.0');
    });
  });

  describe('GET /metrics', () => {
    it('should return server metrics', async () => {
      const res = await app.inject({ method: 'GET', url: '/metrics' });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.uptime).toBeGreaterThan(0);
      expect(body.memoryUsage).toBeDefined();
      expect(body.memoryUsage.heapUsed).toBeGreaterThan(0);
      expect(typeof body.activeWorkers).toBe('number');
      expect(typeof body.busSubscriptions).toBe('number');
      expect(body.timestamp).toBeDefined();
    });
  });

  describe('POST /api/requests', () => {
    it('should create a plan', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/requests',
        payload: { prompt: 'Build a REST API' },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.planId).toBe('plan-test-1');
      expect(body.data.steps).toHaveLength(1);
    });

    it('should reject missing prompt', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/requests',
        payload: {},
      });
      expect(res.statusCode).toBe(400);
    });
  });

  describe('GET /api/plans/:id', () => {
    it('should return plan details', async () => {
      // First create a plan
      await app.inject({ method: 'POST', url: '/api/requests', payload: { prompt: 'test' } });

      const res = await app.inject({ method: 'GET', url: '/api/plans/plan-test-1' });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data.planId).toBe('plan-test-1');
    });

    it('should 404 for unknown plan', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/plans/nonexistent' });
      expect(res.statusCode).toBe(404);
    });
  });

  describe('POST /api/plans/:id/approve', () => {
    it('should execute an approved plan', async () => {
      // Create plan first
      await app.inject({ method: 'POST', url: '/api/requests', payload: { prompt: 'test approve' } });

      const res = await app.inject({ method: 'POST', url: '/api/plans/plan-test-1/approve' });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.success).toBe(true);
    });
  });

  describe('POST /api/plans/:id/reject', () => {
    it('should reject a plan', async () => {
      // Create plan first
      await app.inject({ method: 'POST', url: '/api/requests', payload: { prompt: 'test reject' } });

      const res = await app.inject({ method: 'POST', url: '/api/plans/plan-test-1/reject' });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data.status).toBe('rejected');
    });
  });

  describe('GET /api/workers', () => {
    it('should list worker definitions', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/workers' });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.definitions).toBeInstanceOf(Array);
      expect(body.data.totalDefinitions).toBeGreaterThan(0);
    });
  });

  describe('GET /api/workers/:role', () => {
    it('should return worker definition', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/workers/architect' });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data.role).toBe('architect');
    });

    it('should 404 for unknown role', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/workers/nonexistent' });
      expect(res.statusCode).toBe(404);
    });
  });

  describe('GET /api/tasks', () => {
    it('should return task list', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/tasks' });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data).toBeInstanceOf(Array);
    });
  });

  describe('GET /api/artifacts', () => {
    it('should return 501 when no artifact store', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/artifacts' });
      expect(res.statusCode).toBe(501);
    });
  });

  describe('GET /api/tasks/:id', () => {
    it('should 404 for unknown task', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/tasks/nonexistent' });
      expect(res.statusCode).toBe(404);
    });
  });

  describe('GET /api/artifacts/:id', () => {
    it('should return 501 when no artifact store for single artifact', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/artifacts/art-1' });
      expect(res.statusCode).toBe(501);
    });
  });

  describe('GET /api/workers/active', () => {
    it('should list active workers', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/workers/active' });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data).toBeInstanceOf(Array);
    });
  });
});

describe('Server with API key auth', () => {
  let authedApp: FastifyInstance;

  beforeAll(async () => {
    const bus = new EventBus();
    authedApp = await createServer({ port: 0, apiKey: 'test-secret-key' }, {
      router: createMockRouter(),
      tools: createMockTools(),
      bus,
    });
  });

  afterAll(async () => {
    await authedApp.close();
  });

  it('allows /health without auth', async () => {
    const res = await authedApp.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
  });

  it('rejects requests without API key', async () => {
    const res = await authedApp.inject({ method: 'GET', url: '/api/workers' });
    expect(res.statusCode).toBe(401);
  });

  it('accepts requests with Bearer token', async () => {
    const res = await authedApp.inject({
      method: 'GET',
      url: '/api/workers',
      headers: { authorization: 'Bearer test-secret-key' },
    });
    expect(res.statusCode).toBe(200);
  });

  it('accepts requests with x-api-key header', async () => {
    const res = await authedApp.inject({
      method: 'GET',
      url: '/api/workers',
      headers: { 'x-api-key': 'test-secret-key' },
    });
    expect(res.statusCode).toBe(200);
  });

  it('rejects requests with wrong API key', async () => {
    const res = await authedApp.inject({
      method: 'GET',
      url: '/api/workers',
      headers: { authorization: 'Bearer wrong-key' },
    });
    expect(res.statusCode).toBe(401);
  });
});

describe('Server with artifact store', () => {
  let storeApp: FastifyInstance;

  beforeAll(async () => {
    const bus = new EventBus();
    const mockArtifactStore = {
      list: vi.fn().mockReturnValue([
        { id: 'art-1', name: 'test.ts', type: 'code', projectId: 'proj-1' },
        { id: 'art-2', name: 'design.md', type: 'document', projectId: 'proj-1' },
      ]),
      get: vi.fn().mockImplementation((id: string) => {
        if (id === 'art-1') return { id: 'art-1', name: 'test.ts', type: 'code', content: 'console.log("hi")' };
        return undefined;
      }),
      store: vi.fn(),
    } as any;

    storeApp = await createServer({ port: 0 }, {
      router: createMockRouter(),
      tools: createMockTools(),
      bus,
      artifactStore: mockArtifactStore,
    });
  });

  afterAll(async () => {
    await storeApp.close();
  });

  it('lists artifacts when store is available', async () => {
    const res = await storeApp.inject({ method: 'GET', url: '/api/artifacts' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(2);
    expect(body.total).toBe(2);
  });

  it('gets a single artifact by ID', async () => {
    const res = await storeApp.inject({ method: 'GET', url: '/api/artifacts/art-1' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.id).toBe('art-1');
    expect(body.data.name).toBe('test.ts');
  });

  it('returns 404 for unknown artifact', async () => {
    const res = await storeApp.inject({ method: 'GET', url: '/api/artifacts/nonexistent' });
    expect(res.statusCode).toBe(404);
  });
});
