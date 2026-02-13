/**
 * OpenAgent V2 - Task Queue Types
 *
 * Types for the in-memory priority task queue with dependency resolution.
 */

// =============================================================================
// TASK PRIORITY
// =============================================================================

/**
 * Task priority levels.
 * Lower number = higher priority.
 */
export type TaskPriority = 'critical' | 'high' | 'normal' | 'low';

/**
 * Numeric priority values (lower = higher priority).
 */
export const PRIORITY_VALUES: Record<TaskPriority, number> = {
  critical: 0,
  high: 1,
  normal: 2,
  low: 3,
};

// =============================================================================
// TASK STATUS
// =============================================================================

/**
 * Task lifecycle status.
 */
export type TaskStatus =
  | 'pending'
  | 'ready'         // all deps satisfied, ready to run
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled';

// =============================================================================
// TASK
// =============================================================================

/**
 * A task in the queue.
 */
export interface QueueTask {
  /** Unique task ID */
  id: string;

  /** Human-readable title */
  title: string;

  /** Task description */
  description: string;

  /** Task priority */
  priority: TaskPriority;

  /** Current status */
  status: TaskStatus;

  /** IDs of tasks this task depends on */
  dependencies: string[];

  /** Which worker role should handle this */
  assignTo?: string;

  /** When the task was created */
  createdAt: Date;

  /** When the task started running */
  startedAt?: Date;

  /** When the task completed/failed */
  completedAt?: Date;

  /** Number of retry attempts */
  retryCount: number;

  /** Maximum retries allowed */
  maxRetries: number;

  /** Result data (on completion) */
  result?: unknown;

  /** Error message (on failure) */
  error?: string;

  /** Arbitrary metadata */
  metadata?: Record<string, unknown>;
}

// =============================================================================
// TASK INPUT
// =============================================================================

/**
 * Input for creating a new task.
 */
export interface TaskInput {
  id?: string;
  title: string;
  description: string;
  priority?: TaskPriority;
  dependencies?: string[];
  assignTo?: string;
  maxRetries?: number;
  metadata?: Record<string, unknown>;
}

// =============================================================================
// TASK QUEUE INTERFACE
// =============================================================================

/**
 * Interface for the task queue.
 */
export interface ITaskQueue {
  /** Add a task to the queue. */
  add(input: TaskInput): QueueTask;

  /** Get the next ready task (highest priority, all deps satisfied). */
  getNext(): QueueTask | null;

  /** Get a task by ID. */
  get(id: string): QueueTask | undefined;

  /** Mark a task as running. */
  start(id: string): QueueTask;

  /** Mark a task as completed. */
  complete(id: string, result?: unknown): QueueTask;

  /** Mark a task as failed. */
  fail(id: string, error: string): QueueTask;

  /** Cancel a task. */
  cancel(id: string): QueueTask;

  /** Get all tasks. */
  getAll(): QueueTask[];

  /** Get tasks by status. */
  getByStatus(status: TaskStatus): QueueTask[];

  /** Get queue statistics. */
  getStats(): QueueStats;

  /** Clear all tasks. */
  clear(): void;
}

/**
 * Queue statistics.
 */
export interface QueueStats {
  total: number;
  pending: number;
  ready: number;
  running: number;
  completed: number;
  failed: number;
  cancelled: number;
}

// =============================================================================
// DEPENDENCY RESOLUTION
// =============================================================================

/**
 * Dependency graph node.
 */
export interface DependencyNode {
  id: string;
  dependencies: string[];
}

// =============================================================================
// RETRY POLICY
// =============================================================================

/**
 * Retry policy configuration.
 */
export interface RetryConfig {
  /** Base delay in ms */
  baseDelay: number;

  /** Multiplier for exponential backoff */
  multiplier: number;

  /** Maximum delay in ms */
  maxDelay: number;

  /** Maximum number of retries */
  maxRetries: number;
}
