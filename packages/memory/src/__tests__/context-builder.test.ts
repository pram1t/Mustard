import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MemoryStore } from '../store.js';
import { ContextBuilder } from '../context-builder.js';

describe('ContextBuilder', () => {
  let store: MemoryStore;
  let builder: ContextBuilder;

  beforeEach(() => {
    store = new MemoryStore(':memory:');
    builder = new ContextBuilder(store);

    // Seed some memories
    store.store({
      type: 'decision',
      workerId: 'w1',
      projectId: 'p1',
      title: 'Use React for UI',
      content: 'We chose React for the frontend framework due to team expertise.',
      tags: ['react', 'frontend'],
    });
    store.store({
      type: 'pattern',
      workerId: 'w1',
      projectId: 'p1',
      title: 'Repository pattern',
      content: 'Use repository pattern for database access to decouple business logic.',
      tags: ['architecture'],
    });
    store.store({
      type: 'convention',
      workerId: 'w2',
      projectId: 'p1',
      title: 'Naming conventions',
      content: 'Use camelCase for variables, PascalCase for types.',
      tags: ['style'],
    });
    store.store({
      type: 'failure',
      workerId: 'w1',
      projectId: 'p1',
      title: 'Memory leak in event handlers',
      content: 'Forgetting to clean up event listeners caused a memory leak.',
      tags: ['bug'],
    });
    store.store({
      type: 'decision',
      workerId: 'w3',
      projectId: 'p2',
      title: 'Use PostgreSQL',
      content: 'PostgreSQL for the database due to JSON support.',
      tags: ['database'],
    });
  });

  afterEach(() => {
    store.close();
  });

  describe('buildContext', () => {
    it('should return empty string for no matches', () => {
      const ctx = builder.buildContext({ projectId: 'non-existent' });
      expect(ctx).toBe('');
    });

    it('should return formatted context with headers', () => {
      const ctx = builder.buildContext({ projectId: 'p1' });
      expect(ctx).toContain('# Relevant Context from Memory');
      expect(ctx).toContain('## Past Decisions');
      expect(ctx).toContain('## Known Patterns');
      expect(ctx).toContain('## Conventions');
      expect(ctx).toContain('## Past Failures');
    });

    it('should include memory titles and content', () => {
      const ctx = builder.buildContext({ projectId: 'p1' });
      expect(ctx).toContain('### Use React for UI');
      expect(ctx).toContain('We chose React');
      expect(ctx).toContain('### Repository pattern');
    });

    it('should include tags', () => {
      const ctx = builder.buildContext({ projectId: 'p1' });
      expect(ctx).toContain('*Tags: react, frontend*');
    });

    it('should filter by project', () => {
      const ctx = builder.buildContext({ projectId: 'p2' });
      expect(ctx).toContain('Use PostgreSQL');
      expect(ctx).not.toContain('Use React for UI');
    });

    it('should respect maxMemories limit', () => {
      const ctx = builder.buildContext({ projectId: 'p1', maxMemories: 2 });
      // Should have at most 2 memory entries
      const entryCount = (ctx.match(/### /g) || []).length;
      expect(entryCount).toBeLessThanOrEqual(2);
    });

    it('should use search when searchText is provided', () => {
      const ctx = builder.buildContext({ projectId: 'p1', searchText: 'React' });
      expect(ctx).toContain('Use React for UI');
    });
  });

  describe('buildSummary', () => {
    it('should return empty string for no matches', () => {
      const summary = builder.buildSummary({ projectId: 'non-existent' });
      expect(summary).toBe('');
    });

    it('should return a concise bullet list', () => {
      const summary = builder.buildSummary({ projectId: 'p1' });
      expect(summary).toContain('Memory context');
      expect(summary).toContain('[decision]');
      expect(summary).toContain('Use React for UI');
    });

    it('should include entry count', () => {
      const summary = builder.buildSummary({ projectId: 'p1' });
      expect(summary).toMatch(/Memory context \(\d+ entries\)/);
    });
  });
});
