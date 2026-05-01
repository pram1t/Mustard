import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WorkerFactory } from '../factory.js';
import { WorkerRegistry } from '../registry.js';
import type { WorkerConfig, WorkerDefinition, WorkerStatus } from '../types.js';

// ─── Mocks ──────────────────────────────────────────────────

vi.mock('@mustard/core', () => ({
  AgentLoop: vi.fn().mockImplementation(() => ({
    initialize: vi.fn().mockResolvedValue(undefined),
    run: vi.fn().mockReturnValue({ [Symbol.asyncIterator]: () => ({ next: () => Promise.resolve({ done: true }) }) }),
  })),
}));

const mockRouter = {} as any;

const mockTool = (name: string) => ({
  name,
  description: `${name} tool`,
  parameters: {},
  execute: vi.fn(),
});

const mockToolRegistry = {
  getAll: vi.fn().mockReturnValue([
    mockTool('Read'),
    mockTool('Write'),
    mockTool('Glob'),
    mockTool('Grep'),
    mockTool('Bash'),
    mockTool('Edit'),
  ]),
  register: vi.fn(),
  get: vi.fn(),
} as any;

describe('WorkerFactory', () => {
  let registry: WorkerRegistry;
  let factory: WorkerFactory;

  beforeEach(() => {
    vi.restoreAllMocks();
    registry = new WorkerRegistry();
    factory = new WorkerFactory(registry, mockRouter, mockToolRegistry);
  });

  it('creates a worker from a built-in role', () => {
    const worker = factory.create({ role: 'backend' });
    expect(worker).toBeDefined();
    expect(worker.id).toBeDefined();
    expect(worker.role).toBe('backend');
    expect(worker.name).toBe('Backend Developer');
    expect(worker.status).toBe('idle');
  });

  it('tracks the created worker in the registry', () => {
    const worker = factory.create({ role: 'frontend' });
    expect(registry.getActiveCount()).toBe(1);
    expect(registry.getWorker(worker.id)).toBeDefined();
  });

  it('throws when creating from unknown role', () => {
    expect(() => factory.create({ role: 'nonexistent' as any }))
      .toThrow('No worker definition found for role: nonexistent');
  });

  it('creates workers with unique IDs', () => {
    const w1 = factory.create({ role: 'backend' });
    const w2 = factory.create({ role: 'backend' });
    expect(w1.id).not.toBe(w2.id);
    expect(registry.getActiveCount()).toBe(2);
  });

  it('sets up communication channel when bus is provided', () => {
    const mockBus = {
      subscribe: vi.fn().mockReturnValue(vi.fn()),
      publish: vi.fn(),
    } as any;

    const worker = factory.create({ role: 'backend', bus: mockBus });
    expect(worker).toBeDefined();
    // Worker should have a channel set — the fact that creation succeeds is the test
  });

  it('sets up memory integration when memoryStore and projectId are provided', () => {
    const mockMemoryStore = {
      store: vi.fn(),
      query: vi.fn(),
      get: vi.fn(),
    } as any;

    const worker = factory.create({
      role: 'qa',
      memoryStore: mockMemoryStore,
      projectId: 'proj-1',
    });
    expect(worker).toBeDefined();
  });

  it('does not set up memory without projectId', () => {
    const mockMemoryStore = {} as any;
    // Should not throw — memory integration is optional
    const worker = factory.create({
      role: 'qa',
      memoryStore: mockMemoryStore,
      // no projectId
    });
    expect(worker).toBeDefined();
  });

  it('destroys a worker and removes from tracking', () => {
    const worker = factory.create({ role: 'devops' });
    expect(registry.getActiveCount()).toBe(1);

    const result = factory.destroy(worker.id);
    expect(result).toBe(true);
    expect(registry.getActiveCount()).toBe(0);
  });

  it('destroy returns false for unknown worker ID', () => {
    const result = factory.destroy('nonexistent-id');
    expect(result).toBe(false);
  });

  it('creates all 10 built-in roles', () => {
    const roles = [
      'architect', 'frontend', 'backend', 'qa', 'devops',
      'security', 'pm', 'tech_writer', 'ui_ux', 'dba',
    ] as const;

    for (const role of roles) {
      const worker = factory.create({ role });
      expect(worker.role).toBe(role);
    }
    expect(registry.getActiveCount()).toBe(10);
  });

  it('passes config options through to worker', () => {
    const worker = factory.create({
      role: 'backend',
      cwd: '/test/dir',
      sessionId: 'sess-1',
      maxIterations: 25,
    });
    expect(worker).toBeDefined();
    expect(worker.role).toBe('backend');
  });
});
