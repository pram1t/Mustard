/**
 * OpenAgent V2 - Worker Registry
 *
 * Manages worker definitions and tracks active worker instances.
 */

import type { WorkerDefinition, WorkerRole, IWorker } from './types.js';
import { builtinDefinitions } from './definitions.js';

/**
 * Registry for worker definitions and active instances.
 */
export class WorkerRegistry {
  private definitions = new Map<WorkerRole, WorkerDefinition>();
  private activeWorkers = new Map<string, IWorker>();

  constructor() {
    // Register all built-in definitions
    for (const def of Object.values(builtinDefinitions)) {
      this.definitions.set(def.role, def);
    }
  }

  // ===========================================================================
  // DEFINITIONS
  // ===========================================================================

  /**
   * Register a worker definition (or override an existing one).
   */
  registerDefinition(definition: WorkerDefinition): void {
    this.definitions.set(definition.role, definition);
  }

  /**
   * Get a worker definition by role.
   */
  getDefinition(role: WorkerRole): WorkerDefinition | undefined {
    return this.definitions.get(role);
  }

  /**
   * Get all registered definitions.
   */
  getAllDefinitions(): WorkerDefinition[] {
    return [...this.definitions.values()];
  }

  /**
   * Check if a definition exists for a role.
   */
  hasDefinition(role: WorkerRole): boolean {
    return this.definitions.has(role);
  }

  /**
   * Get all registered roles.
   */
  getRegisteredRoles(): WorkerRole[] {
    return [...this.definitions.keys()];
  }

  // ===========================================================================
  // ACTIVE WORKERS
  // ===========================================================================

  /**
   * Track an active worker instance.
   */
  trackWorker(worker: IWorker): void {
    this.activeWorkers.set(worker.id, worker);
  }

  /**
   * Remove an active worker from tracking.
   */
  untrackWorker(workerId: string): boolean {
    return this.activeWorkers.delete(workerId);
  }

  /**
   * Get an active worker by ID.
   */
  getWorker(workerId: string): IWorker | undefined {
    return this.activeWorkers.get(workerId);
  }

  /**
   * Get all active workers.
   */
  getActiveWorkers(): IWorker[] {
    return [...this.activeWorkers.values()];
  }

  /**
   * Get active workers by role.
   */
  getWorkersByRole(role: WorkerRole): IWorker[] {
    return [...this.activeWorkers.values()].filter((w) => w.role === role);
  }

  /**
   * Get the count of active workers.
   */
  getActiveCount(): number {
    return this.activeWorkers.size;
  }

  /**
   * Clear all active workers.
   */
  clearActiveWorkers(): void {
    this.activeWorkers.clear();
  }
}
