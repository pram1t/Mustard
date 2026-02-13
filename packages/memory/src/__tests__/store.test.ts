import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MemoryStore } from '../store.js';
import type { MemoryInput } from '../types.js';

describe('MemoryStore', () => {
  let store: MemoryStore;

  beforeEach(() => {
    store = new MemoryStore(':memory:');
  });

  afterEach(() => {
    store.close();
  });

  // Helper to create a standard input
  function input(overrides: Partial<MemoryInput> = {}): MemoryInput {
    return {
      type: 'decision',
      workerId: 'worker-1',
      projectId: 'project-1',
      title: 'Test Decision',
      content: 'We decided to use TypeScript for type safety.',
      tags: ['typescript', 'tooling'],
      ...overrides,
    };
  }

  // ===========================================================================
  // STORE
  // ===========================================================================

  describe('store', () => {
    it('should create a memory entry with generated ID', () => {
      const entry = store.store(input());
      expect(entry.id).toBeDefined();
      expect(entry.type).toBe('decision');
      expect(entry.title).toBe('Test Decision');
      expect(entry.content).toContain('TypeScript');
      expect(entry.tags).toEqual(['typescript', 'tooling']);
      expect(entry.accessCount).toBe(0);
      expect(entry.createdAt).toBeInstanceOf(Date);
    });

    it('should generate unique IDs', () => {
      const e1 = store.store(input());
      const e2 = store.store(input());
      expect(e1.id).not.toBe(e2.id);
    });

    it('should store all memory types', () => {
      const types = ['decision', 'pattern', 'convention', 'failure'] as const;
      for (const type of types) {
        const entry = store.store(input({ type, title: `${type} entry` }));
        expect(entry.type).toBe(type);
      }
      expect(store.count()).toBe(4);
    });

    it('should store metadata', () => {
      const entry = store.store(input({ metadata: { source: 'code-review', priority: 'high' } }));
      expect(entry.metadata).toEqual({ source: 'code-review', priority: 'high' });
    });

    it('should default tags to empty array', () => {
      const entry = store.store(input({ tags: undefined }));
      expect(entry.tags).toEqual([]);
    });
  });

  // ===========================================================================
  // GET
  // ===========================================================================

  describe('get', () => {
    it('should retrieve a stored memory', () => {
      const created = store.store(input());
      const retrieved = store.get(created.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved!.id).toBe(created.id);
      expect(retrieved!.title).toBe('Test Decision');
    });

    it('should return null for non-existent ID', () => {
      expect(store.get('non-existent')).toBeNull();
    });

    it('should increment access count on get', () => {
      const created = store.store(input());
      expect(created.accessCount).toBe(0);

      const first = store.get(created.id);
      expect(first!.accessCount).toBe(1);

      const second = store.get(created.id);
      expect(second!.accessCount).toBe(2);
    });

    it('should update lastAccessed on get', () => {
      const created = store.store(input());
      const retrieved = store.get(created.id);
      expect(retrieved!.lastAccessed.getTime()).toBeGreaterThanOrEqual(created.lastAccessed.getTime());
    });
  });

  // ===========================================================================
  // QUERY
  // ===========================================================================

  describe('query', () => {
    beforeEach(() => {
      store.store(input({ type: 'decision', title: 'Decision 1', projectId: 'p1', workerId: 'w1' }));
      store.store(input({ type: 'pattern', title: 'Pattern 1', projectId: 'p1', workerId: 'w2' }));
      store.store(input({ type: 'decision', title: 'Decision 2', projectId: 'p2', workerId: 'w1' }));
      store.store(input({ type: 'failure', title: 'Failure 1', projectId: 'p1', workerId: 'w1', tags: ['critical'] }));
    });

    it('should return all memories with empty query', () => {
      const results = store.query({});
      expect(results).toHaveLength(4);
    });

    it('should filter by type', () => {
      const results = store.query({ type: 'decision' });
      expect(results).toHaveLength(2);
      expect(results.every((r) => r.type === 'decision')).toBe(true);
    });

    it('should filter by project', () => {
      const results = store.query({ projectId: 'p1' });
      expect(results).toHaveLength(3);
    });

    it('should filter by worker', () => {
      const results = store.query({ workerId: 'w1' });
      expect(results).toHaveLength(3);
    });

    it('should filter by tags', () => {
      const results = store.query({ tags: ['critical'] });
      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('Failure 1');
    });

    it('should combine filters', () => {
      const results = store.query({ type: 'decision', projectId: 'p1' });
      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('Decision 1');
    });

    it('should respect limit', () => {
      const results = store.query({ limit: 2 });
      expect(results).toHaveLength(2);
    });

    it('should order by createdAt desc by default', () => {
      const results = store.query({});
      // Last inserted should be first (desc)
      expect(results[0].title).toBe('Failure 1');
    });
  });

  // ===========================================================================
  // SEARCH (FTS5)
  // ===========================================================================

  describe('search', () => {
    beforeEach(() => {
      store.store(input({ title: 'React component patterns', content: 'Use functional components with hooks for state management.' }));
      store.store(input({ title: 'Database indexing', content: 'Always add indexes on foreign keys for query performance.' }));
      store.store(input({ title: 'TypeScript generics', content: 'Use generic types for reusable utility functions.' }));
    });

    it('should find entries matching search text', () => {
      const results = store.search('React');
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results[0].entry.title).toContain('React');
    });

    it('should search content as well as title', () => {
      const results = store.search('hooks');
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results[0].entry.content).toContain('hooks');
    });

    it('should return relevance scores', () => {
      const results = store.search('components');
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(typeof results[0].score).toBe('number');
    });

    it('should respect limit', () => {
      const results = store.search('use', 1);
      expect(results).toHaveLength(1);
    });

    it('should return empty for no matches', () => {
      const results = store.search('nonexistentxyz');
      expect(results).toHaveLength(0);
    });

    it('should return empty for empty search text', () => {
      const results = store.search('');
      expect(results).toHaveLength(0);
    });
  });

  // ===========================================================================
  // UPDATE
  // ===========================================================================

  describe('update', () => {
    it('should update title', () => {
      const created = store.store(input());
      const updated = store.update(created.id, { title: 'Updated Title' });
      expect(updated).not.toBeNull();
      expect(updated!.title).toBe('Updated Title');
    });

    it('should update content', () => {
      const created = store.store(input());
      const updated = store.update(created.id, { content: 'New content' });
      expect(updated!.content).toBe('New content');
    });

    it('should update tags', () => {
      const created = store.store(input());
      const updated = store.update(created.id, { tags: ['new-tag'] });
      expect(updated!.tags).toEqual(['new-tag']);
    });

    it('should return null for non-existent ID', () => {
      expect(store.update('non-existent', { title: 'x' })).toBeNull();
    });

    it('should reflect updated content in FTS search', () => {
      const created = store.store(input({ title: 'Old Title', content: 'old content' }));
      store.update(created.id, { title: 'Kubernetes deployment', content: 'Deploy with helm charts.' });

      const results = store.search('Kubernetes');
      expect(results.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ===========================================================================
  // DELETE
  // ===========================================================================

  describe('delete', () => {
    it('should delete an existing entry', () => {
      const created = store.store(input());
      expect(store.delete(created.id)).toBe(true);
      expect(store.get(created.id)).toBeNull();
    });

    it('should return false for non-existent ID', () => {
      expect(store.delete('non-existent')).toBe(false);
    });

    it('should decrement count', () => {
      const e1 = store.store(input());
      store.store(input());
      expect(store.count()).toBe(2);

      store.delete(e1.id);
      expect(store.count()).toBe(1);
    });
  });

  // ===========================================================================
  // COUNT
  // ===========================================================================

  describe('count', () => {
    it('should return 0 for empty store', () => {
      expect(store.count()).toBe(0);
    });

    it('should return total count', () => {
      store.store(input());
      store.store(input());
      store.store(input());
      expect(store.count()).toBe(3);
    });

    it('should filter by project', () => {
      store.store(input({ projectId: 'p1' }));
      store.store(input({ projectId: 'p1' }));
      store.store(input({ projectId: 'p2' }));

      expect(store.count('p1')).toBe(2);
      expect(store.count('p2')).toBe(1);
    });
  });
});
