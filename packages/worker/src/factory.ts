/**
 * OpenAgent V2 - Worker Factory
 *
 * Creates worker instances from definitions in the registry.
 */

import type { LLMRouter } from '@openagent/llm';
import type { IToolRegistry } from '@openagent/tools';
import { BaseWorker } from './base-worker.js';
import { WorkerRegistry } from './registry.js';
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
   * @throws Error if no definition exists for the role
   */
  create(config: WorkerConfig): IWorker {
    const definition = this.registry.getDefinition(config.role);
    if (!definition) {
      throw new Error(`No worker definition found for role: ${config.role}`);
    }

    const worker = new BaseWorker(definition, this.router, this.tools, config);

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
