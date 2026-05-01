/**
 * OpenAgent V2 - Worker Factory
 *
 * Creates worker instances from definitions in the registry.
 */

import type { LLMRouter } from '@pram1t/mustard-llm';
import type { IToolRegistry } from '@pram1t/mustard-tools';
import { BaseWorker } from './base-worker.js';
import { WorkerRegistry } from './registry.js';
import { WorkerChannel } from './communication.js';
import { WorkerMemory } from './memory-integration.js';
import type { WorkerConfig, IWorker } from './types.js';

/**
 * Factory for creating worker instances.
 */
export class WorkerFactory {
  private readonly registry: WorkerRegistry;
  private readonly router: LLMRouter;
  private readonly tools: IToolRegistry;

  constructor(registry: WorkerRegistry, router: LLMRouter, tools: IToolRegistry) {
    this.registry = registry;
    this.router = router;
    this.tools = tools;
  }

  /**
   * Create a new worker instance.
   * Looks up the definition from the registry by role, creates a BaseWorker,
   * and registers it as active.
   *
   * If config.bus is provided, creates a WorkerChannel for inter-worker communication.
   * If config.memoryStore + config.projectId are provided, creates a WorkerMemory.
   *
   * @throws Error if no definition exists for the role
   */
  create(config: WorkerConfig): IWorker {
    const definition = this.registry.getDefinition(config.role);
    if (!definition) {
      throw new Error(`No worker definition found for role: ${config.role}`);
    }

    const worker = new BaseWorker(definition, this.router, this.tools, config);

    // Create communication channel if bus is provided (Phase 9)
    if (config.bus) {
      const channel = new WorkerChannel(config.bus, worker.id, worker.role);
      worker.setChannel(channel);
    }

    // Create memory integration if memoryStore + projectId are provided (Phase 11)
    if (config.memoryStore && config.projectId) {
      const memory = new WorkerMemory(
        config.memoryStore,
        worker.id,
        worker.role,
        config.projectId,
      );
      worker.setMemory(memory);
    }

    // Track in registry
    this.registry.trackWorker(worker);

    return worker;
  }

  /**
   * Destroy a worker instance (remove from tracking).
   */
  destroy(workerId: string): boolean {
    return this.registry.untrackWorker(workerId);
  }
}
