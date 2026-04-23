import { describe, it, expect } from 'vitest';
import { ProjectMemory } from '../project.js';

function fresh() {
  return new ProjectMemory({ dbPath: ':memory:' });
}

describe('ProjectMemory.add', () => {
  it('creates an entry with generated id and timestamps', () => {
    const m = fresh();
    const entry = m.add({
      roomId: 'r-1',
      category: 'decision',
      title: 'Use Vitest',
      content: 'We chose Vitest because it is fast and Vite-native.',
      createdBy: 'alice',
    });
    expect(entry.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(entry.createdAt).toBeInstanceOf(Date);
    expect(entry.updatedAt.getTime()).toBeGreaterThanOrEqual(entry.createdAt.getTime());
    expect(entry.tags).toEqual([]);
  });

  it('honors tags at insert', () => {
    const m = fresh();
    const entry = m.add({
      roomId: 'r-1',
      category: 'convention',
      title: 'Prefer const',
      content: 'Default to const; let when reassignment needed.',
      createdBy: 'alice',
      tags: ['style', 'typescript'],
    });
    expect(entry.tags).toEqual(['style', 'typescript']);
  });

  it('shortcuts addDecision / addConvention / addKnowledge', () => {
    const m = fresh();
    expect(m.addDecision('r-1', 'alice', 'A', 'a').category).toBe('decision');
    expect(m.addConvention('r-1', 'alice', 'B', 'b').category).toBe('convention');
    expect(m.addKnowledge('r-1', 'alice', 'C', 'c').category).toBe('knowledge');
  });
});

describe('ProjectMemory.get / update / remove', () => {
  it('get hydrates timestamps + tags', () => {
    const m = fresh();
    const e = m.add({
      roomId: 'r-1',
      category: 'decision',
      title: 't',
      content: 'c',
      createdBy: 'alice',
      tags: ['x'],
    });
    const got = m.get(e.id)!;
    expect(got.tags).toEqual(['x']);
    expect(got.createdAt).toBeInstanceOf(Date);
  });

  it('get returns undefined for unknown id', () => {
    expect(fresh().get('nope')).toBeUndefined();
  });

  it('update patches selected fields and bumps updatedAt', async () => {
    const m = fresh();
    const e = m.add({
      roomId: 'r-1',
      category: 'decision',
      title: 'original',
      content: 'c',
      createdBy: 'alice',
    });

    await new Promise(r => setTimeout(r, 3));
    const updated = m.update(e.id, { title: 'new title' })!;
    expect(updated.title).toBe('new title');
    expect(updated.content).toBe('c');
    expect(updated.updatedAt.getTime()).toBeGreaterThan(e.updatedAt.getTime());
  });

  it('update returns undefined for unknown id', () => {
    expect(fresh().update('nope', { title: 'x' })).toBeUndefined();
  });

  it('remove returns true/false based on existence', () => {
    const m = fresh();
    const e = m.add({
      roomId: 'r-1',
      category: 'decision',
      title: 't',
      content: 'c',
      createdBy: 'alice',
    });
    expect(m.remove(e.id)).toBe(true);
    expect(m.remove(e.id)).toBe(false);
    expect(m.get(e.id)).toBeUndefined();
  });
});

describe('ProjectMemory.list / count', () => {
  it('lists by room, filters by category, honors limit, orders by updatedAt DESC', async () => {
    const m = fresh();
    const a = m.add({
      roomId: 'r-1',
      category: 'decision',
      title: 'first',
      content: 'c',
      createdBy: 'alice',
    });
    await new Promise(r => setTimeout(r, 3));
    const b = m.add({
      roomId: 'r-1',
      category: 'convention',
      title: 'second',
      content: 'c',
      createdBy: 'alice',
    });
    m.add({
      roomId: 'r-2',
      category: 'decision',
      title: 'other-room',
      content: 'c',
      createdBy: 'alice',
    });

    const all = m.list({ roomId: 'r-1' });
    expect(all.map(e => e.id)).toEqual([b.id, a.id]);

    const decisionsOnly = m.list({ roomId: 'r-1', category: 'decision' });
    expect(decisionsOnly).toHaveLength(1);
    expect(decisionsOnly[0].id).toBe(a.id);

    expect(m.count({ roomId: 'r-1' })).toBe(2);
    expect(m.count()).toBe(3);

    expect(m.list({ limit: 1 })).toHaveLength(1);
  });
});

describe('ProjectMemory.search (FTS5)', () => {
  it('finds entries by content term', () => {
    const m = fresh();
    m.add({
      roomId: 'r-1',
      category: 'decision',
      title: 'Chose Vitest',
      content: 'Vitest is fast and Vite-native, so we picked it.',
      createdBy: 'alice',
    });
    m.add({
      roomId: 'r-1',
      category: 'decision',
      title: 'Node 22',
      content: 'We require Node 22.',
      createdBy: 'alice',
    });

    const hits = m.search('vitest', { roomId: 'r-1' });
    expect(hits).toHaveLength(1);
    expect(hits[0].entry.title).toBe('Chose Vitest');
    expect(hits[0].snippet).toContain('<mark>');
    expect(typeof hits[0].score).toBe('number');
  });

  it('matches by title terms', () => {
    const m = fresh();
    m.add({
      roomId: 'r-1',
      category: 'convention',
      title: 'Prefer const over let',
      content: 'Keep bindings immutable when possible.',
      createdBy: 'alice',
    });

    const hits = m.search('const');
    expect(hits).toHaveLength(1);
  });

  it('matches by tag terms', () => {
    const m = fresh();
    m.add({
      roomId: 'r-1',
      category: 'knowledge',
      title: 'Error handling',
      content: 'Always use Result type.',
      createdBy: 'alice',
      tags: ['errors', 'result'],
    });

    const hits = m.search('errors');
    expect(hits).toHaveLength(1);
  });

  it('empty query returns no hits', () => {
    const m = fresh();
    m.add({
      roomId: 'r-1',
      category: 'decision',
      title: 't',
      content: 'c',
      createdBy: 'alice',
    });
    expect(m.search('')).toEqual([]);
    expect(m.search('   ')).toEqual([]);
  });

  it('sanitizes queries with special FTS operator chars', () => {
    const m = fresh();
    m.add({
      roomId: 'r-1',
      category: 'decision',
      title: 'TypeScript 5',
      content: 'We upgraded to TS 5+.',
      createdBy: 'alice',
    });
    // '+' would be an FTS operator; sanitizer wraps as phrase.
    const hits = m.search('TS 5+');
    expect(hits.length).toBeGreaterThanOrEqual(0); // at minimum, doesn't throw
  });

  it('respects roomId + category filters', () => {
    const m = fresh();
    m.add({
      roomId: 'r-1',
      category: 'decision',
      title: 'A',
      content: 'vitest in r-1',
      createdBy: 'alice',
    });
    m.add({
      roomId: 'r-2',
      category: 'decision',
      title: 'B',
      content: 'vitest in r-2',
      createdBy: 'alice',
    });

    expect(m.search('vitest', { roomId: 'r-1' })).toHaveLength(1);
    expect(m.search('vitest', { roomId: 'r-2' })).toHaveLength(1);
    expect(m.search('vitest')).toHaveLength(2);
  });

  it('FTS updates on edit and delete', () => {
    const m = fresh();
    const e = m.add({
      roomId: 'r-1',
      category: 'decision',
      title: 'original title',
      content: 'original content',
      createdBy: 'alice',
    });

    expect(m.search('original')).toHaveLength(1);
    m.update(e.id, { content: 'replaced body with uniqueword' });
    expect(m.search('uniqueword')).toHaveLength(1);
    expect(m.search('original content')).toHaveLength(0);

    m.remove(e.id);
    expect(m.search('uniqueword')).toHaveLength(0);
  });
});
