import { describe, it, expect } from 'vitest';
import { TeamMemory } from '../team.js';

function fresh() {
  return new TeamMemory({ dbPath: ':memory:' });
}

describe('TeamMemory CRUD', () => {
  it('add returns a full entry with timestamps', () => {
    const m = fresh();
    const e = m.add({
      teamId: 't-1',
      category: 'convention',
      content: 'prefer named exports',
      createdBy: 'alice',
    });
    expect(e.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(e.createdAt).toBeInstanceOf(Date);
    expect(e.updatedAt).toBeInstanceOf(Date);
  });

  it('get hydrates timestamps', () => {
    const m = fresh();
    const e = m.add({
      teamId: 't-1',
      category: 'convention',
      content: 'x',
      createdBy: 'alice',
    });
    const got = m.get(e.id)!;
    expect(got.createdAt).toBeInstanceOf(Date);
    expect(got.teamId).toBe('t-1');
  });

  it('get returns undefined for unknown id', () => {
    expect(fresh().get('nope')).toBeUndefined();
  });

  it('update patches category/content and bumps updatedAt', async () => {
    const m = fresh();
    const e = m.add({
      teamId: 't-1',
      category: 'convention',
      content: 'v1',
      createdBy: 'alice',
    });
    await new Promise(r => setTimeout(r, 3));
    const u = m.update(e.id, { content: 'v2' })!;
    expect(u.content).toBe('v2');
    expect(u.category).toBe('convention');
    expect(u.updatedAt.getTime()).toBeGreaterThan(e.updatedAt.getTime());
  });

  it('update returns undefined for unknown id', () => {
    expect(fresh().update('nope', { content: 'x' })).toBeUndefined();
  });

  it('remove returns bool based on existence', () => {
    const m = fresh();
    const e = m.add({
      teamId: 't-1',
      category: 'convention',
      content: 'x',
      createdBy: 'alice',
    });
    expect(m.remove(e.id)).toBe(true);
    expect(m.remove(e.id)).toBe(false);
  });
});

describe('TeamMemory.list and convenience getters', () => {
  it('filters by teamId and category, honors limit, sorts by updatedAt DESC', async () => {
    const m = fresh();
    const a = m.add({
      teamId: 't-1',
      category: 'convention',
      content: 'first',
      createdBy: 'alice',
    });
    await new Promise(r => setTimeout(r, 3));
    const b = m.add({
      teamId: 't-1',
      category: 'template',
      content: 'second',
      createdBy: 'alice',
    });
    m.add({
      teamId: 't-2',
      category: 'convention',
      content: 'other-team',
      createdBy: 'alice',
    });

    const t1 = m.list({ teamId: 't-1' });
    expect(t1.map(e => e.id)).toEqual([b.id, a.id]);

    expect(m.list({ teamId: 't-1', category: 'convention' })).toHaveLength(1);
    expect(m.list({ teamId: 't-1', limit: 1 })).toHaveLength(1);
    expect(m.list()).toHaveLength(3);
  });

  it('getConventions returns only convention entries for the team', () => {
    const m = fresh();
    m.add({ teamId: 't-1', category: 'convention', content: 'a', createdBy: 'u' });
    m.add({ teamId: 't-1', category: 'template', content: 'b', createdBy: 'u' });
    expect(m.getConventions('t-1')).toHaveLength(1);
  });

  it('getTemplates returns only template entries for the team', () => {
    const m = fresh();
    m.add({ teamId: 't-1', category: 'convention', content: 'a', createdBy: 'u' });
    m.add({ teamId: 't-1', category: 'template', content: 'b', createdBy: 'u' });
    expect(m.getTemplates('t-1')).toHaveLength(1);
  });
});
