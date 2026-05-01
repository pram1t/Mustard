/**
 * OpenAgent V2 - Worker Types
 *
 * Types for the worker infrastructure that enables specialized AI agents
 * with role-specific tools, prompts, and capabilities.
 */

import type { AgentEvent } from '@mustard/core';

// =============================================================================
// WORKER ROLES
// =============================================================================

/**
 * Available worker roles in the system.
 * Each role has a specific set of tools, expertise, and responsibilities.
 */
export type WorkerRole =
  | 'architect'
  | 'frontend'
  | 'backend'
  | 'qa'
  | 'devops'
  | 'security'
  | 'pm'
  | 'tech_writer'
  | 'ui_ux'
  | 'dba';

/**
 * Worker runtime status.
 */
export type WorkerStatus =
  | 'idle'
  | 'working'
  | 'reviewing'
  | 'waiting'
  | 'error'
  | 'offline';

// =============================================================================
// WORKER DEFINITION
// =============================================================================

/**
 * Static worker definition describing a role's capabilities.
 * Stored in the registry, used by the factory to create instances.
 */
export interface WorkerDefinition {
  /** Role identifier */
  role: WorkerRole;

  /** Display name */
  name: string;

  /** Description of the worker's purpose */
  description: string;

  /** System prompt sections */
  prompt: WorkerPrompt;

  /** Tool access configuration */
  tools: WorkerToolConfig;

  /** Skills and proficiency areas */
  skills: WorkerSkill[];
}

/**
 * System prompt configuration for a worker.
 */
export interface WorkerPrompt {
  /** Core identity statement */
  identity: string;

  /** Areas of expertise */
  expertise: string[];

  /** Key responsibilities */
  responsibilities: string[];

  /** Behavioral constraints */
  constraints: string[];

  /** Communication style */
  communication: string;

  /** What artifacts this worker produces and consumes */
  artifacts: {
    produces: string[];
    consumes: string[];
  };
}

/**
 * Tool access control for a worker.
 */
export interface WorkerToolConfig {
  /** Tool names this worker is allowed to use (empty = all tools) */
  allowed: string[];

  /** Tool names explicitly denied */
  denied: string[];
}

/**
 * A skill a worker possesses.
 */
export interface WorkerSkill {
  name: string;
  description: string;
  proficiency: 'beginner' | 'intermediate' | 'expert';
}

// =============================================================================
// WORKER CONFIG
// =============================================================================

/**
 * Runtime configuration for creating a worker instance.
 */
export interface WorkerConfig {
  /** Worker role to create */
  role: WorkerRole;

  /** Project-specific working directory */
  cwd?: string;

  /** Session ID for context tracking */
  sessionId?: string;

  /** Maximum iterations per run */
  maxIterations?: number;

  /** Additional system prompt text to prepend/append */
  systemPromptOverride?: string;

  /** Message bus for inter-worker communication (Phase 9) */
  bus?: import('@mustard/message-bus').IMessageBus;

  /** Memory store for cross-session persistence (Phase 11) */
  memoryStore?: import('@mustard/memory').IMemoryStore;

  /** Project ID for scoping memories (Phase 11) */
  projectId?: string;
}

// =============================================================================
// WORKER INTERFACE
// =============================================================================

/**
 * Interface for a running worker instance.
 */
export interface IWorker {
  /** Unique worker instance ID */
  readonly id: string;

  /** Worker role */
  readonly role: WorkerRole;

  /** Display name */
  readonly name: string;

  /** Current status */
  readonly status: WorkerStatus;

  /**
   * Run the worker with a prompt, yielding events as they occur.
   */
  run(prompt: string, taskId?: string): AsyncGenerator<AgentEvent>;

  /**
   * Get the worker's current status.
   */
  getStatus(): WorkerStatus;

  /**
   * Abort the current execution and reset to idle.
   */
  abort(): void;
}

// =============================================================================
// WORKER EVENTS
// =============================================================================

/**
 * Events emitted during worker lifecycle.
 */
export interface WorkerCreatedEvent {
  workerId: string;
  role: WorkerRole;
  name: string;
}

export interface WorkerTaskStartedEvent {
  workerId: string;
  taskId: string;
  prompt: string;
}

export interface WorkerTaskCompletedEvent {
  workerId: string;
  taskId: string;
  success: boolean;
  summary?: string;
}
