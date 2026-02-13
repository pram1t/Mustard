import { describe, it, expect, beforeEach } from 'vitest';
import { WorkerRegistry } from '../registry.js';
import { architectDefinition } from '../definitions.js';
import type { IWorker, WorkerDefinition, WorkerStatus } from '../types.js';

/** Create a mock worker for testing. */
function createMockWorker(overrides: Partial<IWorker> = {}): IWorker {
  return {
    id: 'worker-1',
    role: 'backend',
    name: 'Backend Developer',
    status: 'idle' as WorkerStatus,
    getStatus: () => 'idle' as WorkerStatus,
    async *run() {
      // no-op
    },
    ...overrides,
  };
}

describe('WorkerRegistry', () => {
  let registry: WorkerRegistry;

  beforeEach(() => {
    registry = new WorkerRegistry();
  });

  // ===========================================================================
  // DEFINITIONS
  // ===========================================================================

  describe('definitions', () => {
    it('should auto-register built-in definitions', () => {
      expect(registry.hasDefinition('architect')).toBe(true);
      expect(registry.hasDefinition('frontend')).toBe(true);
      expect(registry.hasDefinition('backend')).toBe(true);
    });

    it('should return definition by role', () => {
      const def = registry.getDefinition('architect');
      expect(def).toBeDefined();
      expect(def!.role).toBe('architect');
    });

    it('should return undefined for unregistered role', () => {
      expect(registry.getDefinition('dba')).toBeUndefined();
    });

    it('should register custom definitions', () => {
      const customDef: WorkerDefinition = {
        ...architectDefinition,
        role: 'dba',
        name: 'DBA',
        description: 'Database administrator',
      };
      registry.registerDefinition(customDef);
      expect(registry.hasDefinition('dba')).toBe(true);
      expect(registry.getDefinition('dba')!.name).toBe('DBA');
    });

    it('should override existing definitions', () => {
      const override: WorkerDefinition = {
        ...architectDefinition,
        name: 'Super Architect',
      };
      registry.registerDefinition(override);
      expect(registry.getDefinition('architect')!.name).toBe('Super Architect');
    });

    it('should return all definitions', () => {
      const all = registry.getAllDefinitions();
      expect(all.length).toBe(3);
    });

    it('should return all registered roles', () => {
      const roles = registry.getRegisteredRoles();
      expect(roles).toContain('architect');
      expect(roles).toContain('frontend');
      expect(roles).toContain('backend');
    });
  });

  // ===========================================================================
  // ACTIVE WORKERS
  // ===========================================================================

  describe('active workers', () => {
    it('should start with no active workers', () => {
      expect(registry.getActiveCount()).toBe(0);
      expect(registry.getActiveWorkers()).toEqual([]);
    });

    it('should track a worker', () => {
      const worker = createMockWorker();
      registry.trackWorker(worker);

      expect(registry.getActiveCount()).toBe(1);
      expect(registry.getWorker('worker-1')).toBe(worker);
    });

    it('should untrack a worker', () => {
      const worker = createMockWorker();
      registry.trackWorker(worker);
      expect(registry.untrackWorker('worker-1')).toBe(true);
      expect(registry.getActiveCount()).toBe(0);
    });

    it('should return false when untracking non-existent worker', () => {
      expect(registry.untrackWorker('non-existent')).toBe(false);
    });

    it('should filter workers by role', () => {
      registry.trackWorker(createMockWorker({ id: 'w1', role: 'backend' }));
      registry.trackWorker(createMockWorker({ id: 'w2', role: 'frontend' }));
      registry.trackWorker(createMockWorker({ id: 'w3', role: 'backend' }));

      const backends = registry.getWorkersByRole('backend');
      expect(backends).toHaveLength(2);
    });

    it('should clear all active workers', () => {
      registry.trackWorker(createMockWorker({ id: 'w1' }));
      registry.trackWorker(createMockWorker({ id: 'w2' }));
      registry.clearActiveWorkers();
      expect(registry.getActiveCount()).toBe(0);
    });
  });
});
