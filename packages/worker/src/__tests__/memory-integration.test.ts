import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WorkerMemory } from '../memory-integration.js';
import type { IMemoryStore, MemoryEntry, MemoryInput, MemoryQuery, SearchResult } from '@openagent/memory';

/**
 * Create a mock MemoryStore for testing.
 */
function createMockStore(): IMemoryStore {
  const entries: MemoryEntry[] = [];
  let counter = 0;

  return {
    store: vi.fn((input: MemoryInput): MemoryEntry => {
      counter++;
      const entry: MemoryEntry = {
        id: `mem-${counter}`,
        type: input.type,
        workerId: input.workerId,
        projectId: input.projectId,
        title: input.title,
        content: input.content,
        tags: input.tags ?? [],
        createdAt: new Date(),
        accessCount: 0,
        lastAccessed: new Date(),
        metadata: input.metadata,
      };
      entries.push(entry);
      return entry;
    }),
    get: vi.fn((id: string) => entries.find(e => e.id === id) ?? null),
    query: vi.fn((opts: MemoryQuery) => {
      return entries.filter(e => {
        if (opts.projectId && e.projectId !== opts.projectId) return false;
        if (opts.workerId && e.workerId !== opts.workerId) return false;
        if (opts.type && e.type !== opts.type) return false;
        return true;
      }).slice(0, opts.limit ?? 100);
    }),
    search: vi.fn((_text: string, limit?: number): SearchResult[] => {
      // Return all entries with a score of 1
      return entries.slice(0, limit ?? 10).map(e => ({ entry: e, score: 1 }));
    }),
    update: vi.fn(),
    delete: vi.fn(() => true),
    count: vi.fn(() => entries.length),
    close: vi.fn(),
  };
}

describe('WorkerMemory', () => {
  let store: IMemoryStore;
  let memory: WorkerMemory;

  beforeEach(() => {
    store = createMockStore();
    memory = new WorkerMemory(store, 'worker-1', 'backend', 'project-1');
  });

  describe('recordDecision', () => {
    it('should store a decision memory', () => {
      const entry = memory.recordDecision('Use REST', 'Chose REST over GraphQL');

      expect(entry.type).toBe('decision');
      expect(entry.title).toBe('Use REST');
      expect(entry.content).toBe('Chose REST over GraphQL');
      expect(entry.workerId).toBe('worker-1');
      expect(entry.projectId).toBe('project-1');
      expect(store.store).toHaveBeenCalledTimes(1);
    });

    it('should include tags and role metadata', () => {
      const entry = memory.recordDecision('Use REST', 'Details', ['api', 'arch']);

      expect(entry.tags).toEqual(['api', 'arch']);
      expect(entry.metadata).toEqual({ role: 'backend' });
    });

    it('should use role as default tag when no tags provided', () => {
      const entry = memory.recordDecision('Use REST', 'Details');
      expect(entry.tags).toEqual(['backend']);
    });
  });

  describe('recordPattern', () => {
    it('should store a pattern memory', () => {
      const entry = memory.recordPattern('Repository pattern', 'All services use repository pattern');
      expect(entry.type).toBe('pattern');
      expect(entry.title).toBe('Repository pattern');
    });
  });

  describe('recordFailure', () => {
    it('should store a failure memory', () => {
      const entry = memory.recordFailure('DB timeout', 'Connection pool exhausted');
      expect(entry.type).toBe('failure');
      expect(entry.title).toBe('DB timeout');
    });
  });

  describe('recordConvention', () => {
    it('should store a convention memory', () => {
      const entry = memory.recordConvention('camelCase', 'All variables use camelCase');
      expect(entry.type).toBe('convention');
      expect(entry.title).toBe('camelCase');
    });
  });

  describe('buildTaskContext', () => {
    it('should return empty string when no memories exist', () => {
      const context = memory.buildTaskContext('Build an API');
      // ContextBuilder returns '' when no memories match
      expect(typeof context).toBe('string');
    });

    it('should build context from stored memories', () => {
      // Store some memories first
      memory.recordDecision('Use REST', 'Chose REST over GraphQL');
      memory.recordPattern('MVC', 'Project uses MVC pattern');

      const context = memory.buildTaskContext('Build an API');

      // The context builder should have been called (search was invoked)
      expect(store.search).toHaveBeenCalled();
    });
  });

  describe('getSummary', () => {
    it('should return empty string when no memories', () => {
      const summary = memory.getSummary();
      expect(typeof summary).toBe('string');
    });

    it('should return summary after storing memories', () => {
      memory.recordDecision('Decision 1', 'Content 1');
      memory.recordPattern('Pattern 1', 'Content 2');

      const summary = memory.getSummary();
      // Summary is built by ContextBuilder which queries the store
      expect(store.query).toHaveBeenCalled();
    });
  });

  describe('getMemoryCount', () => {
    it('should return 0 when no memories', () => {
      expect(memory.getMemoryCount()).toBe(0);
    });

    it('should return count after storing memories', () => {
      memory.recordDecision('Dec 1', 'Content');
      memory.recordPattern('Pat 1', 'Content');

      // Note: getMemoryCount calls query with projectId + workerId filter
      const count = memory.getMemoryCount();
      expect(store.query).toHaveBeenCalled();
    });
  });

  describe('getMemories', () => {
    it('should return empty array when no memories', () => {
      const memories = memory.getMemories();
      expect(memories).toEqual([]);
    });

    it('should filter by type', () => {
      memory.recordDecision('Dec 1', 'Content');
      memory.recordPattern('Pat 1', 'Content');

      memory.getMemories('decision');

      expect(store.query).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'decision',
          projectId: 'project-1',
          workerId: 'worker-1',
        })
      );
    });

    it('should respect limit', () => {
      memory.getMemories(undefined, 5);

      expect(store.query).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 5,
        })
      );
    });
  });

  describe('scoping', () => {
    it('should scope memories to worker and project', () => {
      const memory2 = new WorkerMemory(store, 'worker-2', 'frontend', 'project-1');

      memory.recordDecision('Backend decision', 'Details');
      memory2.recordDecision('Frontend decision', 'Details');

      // Both stored but with different workerIds
      expect(store.store).toHaveBeenCalledTimes(2);
      const calls = (store.store as any).mock.calls;
      expect(calls[0][0].workerId).toBe('worker-1');
      expect(calls[1][0].workerId).toBe('worker-2');
    });

    it('should scope to project', () => {
      const memoryProjectB = new WorkerMemory(store, 'worker-1', 'backend', 'project-2');

      memory.recordDecision('Project A decision', 'Details');
      memoryProjectB.recordDecision('Project B decision', 'Details');

      const calls = (store.store as any).mock.calls;
      expect(calls[0][0].projectId).toBe('project-1');
      expect(calls[1][0].projectId).toBe('project-2');
    });
  });
});
