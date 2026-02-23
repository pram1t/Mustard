import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SqliteArtifactStore } from '../sqlite-store.js';
import type { ArtifactCreateInput } from '../types.js';

describe('SqliteArtifactStore', () => {
  let store: SqliteArtifactStore;

  beforeEach(() => {
    store = new SqliteArtifactStore(':memory:');
  });

  afterEach(() => {
    store.close();
  });

  const sampleInput: ArtifactCreateInput = {
    name: 'auth-requirements',
    type: 'requirements',
    createdBy: 'worker-architect',
    projectId: 'proj-1',
    content: { stories: ['As a user, I can log in'] },
    summary: 'Initial requirements',
  };

  describe('create', () => {
    it('should create an artifact with version 1', () => {
      const artifact = store.create(sampleInput);
      expect(artifact.id).toBeDefined();
      expect(artifact.name).toBe('auth-requirements');
      expect(artifact.type).toBe('requirements');
      expect(artifact.status).toBe('draft');
      expect(artifact.createdBy).toBe('worker-architect');
      expect(artifact.projectId).toBe('proj-1');
      expect(artifact.versions).toHaveLength(1);
      expect(artifact.versions[0].version).toBe(1);
      expect(artifact.versions[0].content).toEqual({ stories: ['As a user, I can log in'] });
      expect(artifact.versions[0].summary).toBe('Initial requirements');
    });

    it('should persist across get calls', () => {
      const created = store.create(sampleInput);
      const fetched = store.get(created.id);
      expect(fetched).toBeDefined();
      expect(fetched!.id).toBe(created.id);
      expect(fetched!.name).toBe('auth-requirements');
      expect(fetched!.versions[0].content).toEqual({ stories: ['As a user, I can log in'] });
    });
  });

  describe('get', () => {
    it('should return undefined for non-existent ID', () => {
      expect(store.get('non-existent')).toBeUndefined();
    });
  });

  describe('getByName', () => {
    it('should find artifact by name and project', () => {
      const created = store.create(sampleInput);
      const found = store.getByName('auth-requirements', 'proj-1');
      expect(found).toBeDefined();
      expect(found!.id).toBe(created.id);
    });

    it('should return undefined for wrong project', () => {
      store.create(sampleInput);
      expect(store.getByName('auth-requirements', 'proj-999')).toBeUndefined();
    });
  });

  describe('addVersion', () => {
    it('should add a new version', () => {
      const artifact = store.create(sampleInput);
      const v2 = store.addVersion(artifact.id, { stories: ['Updated'] }, 'worker-frontend', 'v2 update');
      expect(v2.version).toBe(2);
      expect(v2.content).toEqual({ stories: ['Updated'] });
      expect(v2.createdBy).toBe('worker-frontend');
      expect(v2.summary).toBe('v2 update');
    });

    it('should reflect in get()', () => {
      const artifact = store.create(sampleInput);
      store.addVersion(artifact.id, { v: 2 }, 'worker-2');
      store.addVersion(artifact.id, { v: 3 }, 'worker-3');
      const fetched = store.get(artifact.id)!;
      expect(fetched.versions).toHaveLength(3);
      expect(fetched.versions[2].version).toBe(3);
    });

    it('should throw for non-existent artifact', () => {
      expect(() => store.addVersion('bad-id', {}, 'w')).toThrow('Artifact not found: bad-id');
    });
  });

  describe('updateStatus', () => {
    it('should update status', () => {
      const artifact = store.create(sampleInput);
      const updated = store.updateStatus(artifact.id, 'approved');
      expect(updated).toBeDefined();
      expect(updated!.status).toBe('approved');
    });

    it('should return undefined for non-existent artifact', () => {
      expect(store.updateStatus('bad', 'approved')).toBeUndefined();
    });

    it('should persist status change', () => {
      const artifact = store.create(sampleInput);
      store.updateStatus(artifact.id, 'in_review');
      const fetched = store.get(artifact.id)!;
      expect(fetched.status).toBe('in_review');
    });
  });

  describe('list', () => {
    it('should list artifacts for a project', () => {
      store.create(sampleInput);
      store.create({ ...sampleInput, name: 'api-spec', type: 'api_spec' });
      store.create({ ...sampleInput, name: 'other', projectId: 'proj-2' });
      const results = store.list('proj-1');
      expect(results).toHaveLength(2);
    });

    it('should filter by type', () => {
      store.create(sampleInput);
      store.create({ ...sampleInput, name: 'api-spec', type: 'api_spec' });
      const results = store.list('proj-1', 'requirements');
      expect(results).toHaveLength(1);
      expect(results[0].type).toBe('requirements');
    });

    it('should sort by updatedAt desc', () => {
      const a1 = store.create(sampleInput);
      store.create({ ...sampleInput, name: 'second' });
      // Update first to make it most recent
      store.updateStatus(a1.id, 'approved');
      const results = store.list('proj-1');
      expect(results[0].id).toBe(a1.id);
    });
  });

  describe('delete', () => {
    it('should delete an artifact', () => {
      const artifact = store.create(sampleInput);
      expect(store.delete(artifact.id)).toBe(true);
      expect(store.get(artifact.id)).toBeUndefined();
    });

    it('should cascade delete versions', () => {
      const artifact = store.create(sampleInput);
      store.addVersion(artifact.id, { v: 2 }, 'w');
      store.delete(artifact.id);
      expect(store.get(artifact.id)).toBeUndefined();
    });

    it('should return false for non-existent', () => {
      expect(store.delete('bad')).toBe(false);
    });
  });

  describe('count', () => {
    it('should count all artifacts', () => {
      store.create(sampleInput);
      store.create({ ...sampleInput, name: 'second', projectId: 'proj-2' });
      expect(store.count()).toBe(2);
    });

    it('should count by project', () => {
      store.create(sampleInput);
      store.create({ ...sampleInput, name: 'second', projectId: 'proj-2' });
      expect(store.count('proj-1')).toBe(1);
    });
  });
});
