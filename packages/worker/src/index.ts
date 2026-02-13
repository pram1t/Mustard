/**
 * @openagent/worker
 *
 * Specialized AI worker infrastructure for OpenAgent V2.
 */

// Core classes
export { BaseWorker } from './base-worker.js';
export { WorkerRegistry } from './registry.js';
export { WorkerFactory } from './factory.js';

// Definitions
export {
  architectDefinition,
  frontendDefinition,
  backendDefinition,
  builtinDefinitions,
} from './definitions.js';

// Prompt builder
export { buildWorkerPrompt } from './prompt-builder.js';

// Types
export type {
  WorkerRole,
  WorkerStatus,
  WorkerDefinition,
  WorkerPrompt,
  WorkerToolConfig,
  WorkerSkill,
  WorkerConfig,
  IWorker,
  WorkerCreatedEvent,
  WorkerTaskStartedEvent,
  WorkerTaskCompletedEvent,
} from './types.js';
