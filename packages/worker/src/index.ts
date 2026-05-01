/**
 * @pram1t/mustard-worker
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
  qaDefinition,
  devopsDefinition,
  securityDefinition,
  pmDefinition,
  techWriterDefinition,
  uiUxDefinition,
  dbaDefinition,
  builtinDefinitions,
} from './definitions.js';

// Prompt builder
export { buildWorkerPrompt } from './prompt-builder.js';

// Communication (Phase 9)
export { WorkerChannel } from './communication.js';
export type { WorkerMessage, WorkerMessageType } from './communication.js';

// Memory integration (Phase 11)
export { WorkerMemory } from './memory-integration.js';

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
