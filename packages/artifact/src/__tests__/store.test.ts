import { describe, it, expect, beforeEach } from 'vitest';
import { ArtifactStore } from '../store.js';
import type { ArtifactCreateInput } from '../types.js';

describe('ArtifactStore', () => {
  let store: ArtifactStore;

  beforeEach(() => {
    store = new ArtifactStore();
  });

  function createInput(overrides: Partial<ArtifactCreateInput> = {}): ArtifactCreateInput {
    return {
      name: 'API Spec',
      type: 'api_spec',
      createdBy: 'architect-1',
      projectId: 'p1',
      content: { endpoints: [{ path: '/users', method: 'GET' }] },
      summary: 'Initial API specification',
      ...overrides,
    };
  }

  // ===========================================================================
  // CREATE
  // ===========================================================================

  describe('create', () => {
    it('should create an artifact with version 1', () => {
      const artifact = store.create(createInput());

      expect(artifact.id).toBeDefined();
      expect(artifact.name).toBe('API Spec');
      expect(artifact.type).toBe('api_spec');
      expect(artifact.status).toBe('draft');
      expect(artifact.versions).toHaveLength(1);
      expect(artifact.versions[0].version).toBe(1);
      expect(artifact.versions[0].content).toEqual({ endpoints: [{ path: '/users', method: 'GET' }] });
      expect(artifact.createdAt).toBeInstanceOf(Date);
    });

    it('should generate unique IDs', () => {
      const a1 = store.create(createInput({ name: 'Spec 1' }));
      const a2 = store.create(createInput({ name: 'Spec 2' }));
      expect(a1.id).not.toBe(a2.id);
    });
  });

  // ===========================================================================
  // GET
  // ===========================================================================

  describe('get', () => {
    it('should retrieve by ID', () => {
      const created = store.create(createInput());
      const retrieved = store.get(created.id);
      expect(retrieved).toBeDefined();
      expect(retrieved!.id).toBe(created.id);
    });

    it('should return undefined for non-existent ID', () => {
      expect(store.get('non-existent')).toBeUndefined();
    });
  });

  describe('getByName', () => {
    it('should retrieve by name within project', () => {
      store.create(createInput({ name: 'API Spec', projectId: 'p1' }));
      const found = store.getByName('API Spec', 'p1');
      expect(found).toBeDefined();
      expect(found!.name).toBe('API Spec');
    });

    it('should not find artifact from different project', () => {
      store.create(createInput({ name: 'API Spec', projectId: 'p1' }));
      expect(store.getByName('API Spec', 'p2')).toBeUndefined();
    });

    it('should return undefined for non-existent name', () => {
      expect(store.getByName('Non-existent', 'p1')).toBeUndefined();
    });
  });

  // ===========================================================================
  // VERSIONING
  // ===========================================================================

  describe('addVersion', () => {
    it('should add a new version', () => {
      const artifact = store.create(createInput());
      const v2 = store.addVersion(artifact.id, { endpoints: [{ path: '/users', method: 'POST' }] }, 'architect-1', 'Added POST endpoint');

      expect(v2.version).toBe(2);
      expect(v2.createdBy).toBe('architect-1');
      expect(v2.summary).toBe('Added POST endpoint');

      // Original artifact should have both versions
      const updated = store.get(artifact.id);
      expect(updated!.versions).toHaveLength(2);
    });

    it('should increment version numbers', () => {
      const artifact = store.create(createInput());
      store.addVersion(artifact.id, {}, 'w1');
      const v3 = store.addVersion(artifact.id, {}, 'w1');
      expect(v3.version).toBe(3);
    });

    it('should throw for non-existent artifact', () => {
      expect(() => store.addVersion('non-existent', {}, 'w1')).toThrow('Artifact not found');
    });

    it('should update the artifact updatedAt', () => {
      const artifact = store.create(createInput());
      const originalUpdate = artifact.updatedAt;

      // Small delay to ensure different timestamp
      store.addVersion(artifact.id, {}, 'w1');
      const updated = store.get(artifact.id);
      expect(updated!.updatedAt.getTime()).toBeGreaterThanOrEqual(originalUpdate.getTime());
    });
  });

  // ===========================================================================
  // STATUS
  // ===========================================================================

  describe('updateStatus', () => {
    it('should update status', () => {
      const artifact = store.create(createInput());
      const updated = store.updateStatus(artifact.id, 'ready_for_review');
      expect(updated).toBeDefined();
      expect(updated!.status).toBe('ready_for_review');
    });

    it('should return undefined for non-existent', () => {
      expect(store.updateStatus('non-existent', 'approved')).toBeUndefined();
    });
  });

  // ===========================================================================
  // LIST
  // ===========================================================================

  describe('list', () => {
    beforeEach(() => {
      store.create(createInput({ name: 'Spec 1', type: 'api_spec', projectId: 'p1' }));
      store.create(createInput({ name: 'Arch', type: 'architecture', projectId: 'p1' }));
      store.create(createInput({ name: 'Code', type: 'code', projectId: 'p2' }));
    });

    it('should list all artifacts for a project', () => {
      const list = store.list('p1');
      expect(list).toHaveLength(2);
    });

    it('should filter by type', () => {
      const list = store.list('p1', 'api_spec');
      expect(list).toHaveLength(1);
      expect(list[0].name).toBe('Spec 1');
    });

    it('should return empty for unknown project', () => {
      expect(store.list('unknown')).toHaveLength(0);
    });

    it('should sort by updatedAt desc', () => {
      const list = store.list('p1');
      expect(list[0].updatedAt.getTime()).toBeGreaterThanOrEqual(list[1].updatedAt.getTime());
    });
  });

  // ===========================================================================
  // DELETE
  // ===========================================================================

  describe('delete', () => {
    it('should delete an artifact', () => {
      const artifact = store.create(createInput());
      expect(store.delete(artifact.id)).toBe(true);
      expect(store.get(artifact.id)).toBeUndefined();
    });

    it('should remove from name index', () => {
      const artifact = store.create(createInput({ name: 'Test', projectId: 'p1' }));
      store.delete(artifact.id);
      expect(store.getByName('Test', 'p1')).toBeUndefined();
    });

    it('should return false for non-existent', () => {
      expect(store.delete('non-existent')).toBe(false);
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
      store.create(createInput({ name: 'A' }));
      store.create(createInput({ name: 'B' }));
      expect(store.count()).toBe(2);
    });

    it('should filter by project', () => {
      store.create(createInput({ name: 'A', projectId: 'p1' }));
      store.create(createInput({ name: 'B', projectId: 'p2' }));
      expect(store.count('p1')).toBe(1);
    });
  });
});
