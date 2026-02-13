/**
 * OpenAgent V2 - Artifact Types
 *
 * Types for versioned artifacts and the handoff state machine.
 */

// =============================================================================
// ARTIFACT TYPES
// =============================================================================

/**
 * Types of artifacts that workers can produce.
 */
export type ArtifactType =
  | 'requirements'
  | 'architecture'
  | 'api_spec'
  | 'code'
  | 'test_plan'
  | 'security_audit'
  | 'documentation'
  | 'code_review';

/**
 * Status of an artifact in its lifecycle.
 */
export type ArtifactStatus =
  | 'draft'
  | 'ready_for_review'
  | 'in_review'
  | 'changes_requested'
  | 'approved'
  | 'consumed'
  | 'superseded';

// =============================================================================
// ARTIFACT
// =============================================================================

/**
 * A versioned artifact produced by a worker.
 */
export interface Artifact {
  /** Unique artifact ID */
  id: string;

  /** Human-readable name */
  name: string;

  /** Artifact type */
  type: ArtifactType;

  /** Current status */
  status: ArtifactStatus;

  /** Worker who created this artifact */
  createdBy: string;

  /** Project ID */
  projectId: string;

  /** All versions (latest last) */
  versions: ArtifactVersion[];

  /** When created */
  createdAt: Date;

  /** When last updated */
  updatedAt: Date;
}

/**
 * A single version of an artifact.
 */
export interface ArtifactVersion {
  /** Version number (1, 2, 3...) */
  version: number;

  /** The content of this version */
  content: unknown;

  /** Who created this version */
  createdBy: string;

  /** Optional change summary */
  summary?: string;

  /** When this version was created */
  createdAt: Date;
}

// =============================================================================
// ARTIFACT INPUT
// =============================================================================

/**
 * Input for creating a new artifact.
 */
export interface ArtifactCreateInput {
  name: string;
  type: ArtifactType;
  createdBy: string;
  projectId: string;
  content: unknown;
  summary?: string;
}

// =============================================================================
// HANDOFF
// =============================================================================

/**
 * Status of a handoff between workers.
 */
export type HandoffStatus =
  | 'pending'
  | 'accepted'
  | 'rejected'
  | 'changes_requested';

/**
 * A handoff record tracking artifact transfer between workers.
 */
export interface Handoff {
  /** Unique handoff ID */
  id: string;

  /** Artifact being handed off */
  artifactId: string;

  /** Worker sending the artifact */
  fromWorker: string;

  /** Worker receiving the artifact */
  toWorker: string;

  /** Current handoff status */
  status: HandoffStatus;

  /** Optional message from sender */
  message?: string;

  /** Feedback from reviewer */
  feedback?: ReviewFeedback;

  /** When the handoff was created */
  createdAt: Date;

  /** When the handoff was resolved */
  resolvedAt?: Date;
}

/**
 * Feedback from a review.
 */
export interface ReviewFeedback {
  /** Review decision */
  decision: 'approve' | 'request_changes' | 'reject';

  /** Comments from reviewer */
  comments: string[];

  /** Blocking issues */
  blockers?: string[];

  /** Non-blocking suggestions */
  suggestions?: string[];
}

// =============================================================================
// STORE INTERFACES
// =============================================================================

/**
 * Interface for artifact storage.
 */
export interface IArtifactStore {
  create(input: ArtifactCreateInput): Artifact;
  get(id: string): Artifact | undefined;
  getByName(name: string, projectId: string): Artifact | undefined;
  addVersion(id: string, content: unknown, createdBy: string, summary?: string): ArtifactVersion;
  updateStatus(id: string, status: ArtifactStatus): Artifact | undefined;
  list(projectId: string, type?: ArtifactType): Artifact[];
  delete(id: string): boolean;
  count(projectId?: string): number;
}

/**
 * Interface for handoff management.
 */
export interface IHandoffManager {
  create(artifactId: string, fromWorker: string, toWorker: string, message?: string): Handoff;
  get(id: string): Handoff | undefined;
  accept(id: string): Handoff;
  reject(id: string, feedback: ReviewFeedback): Handoff;
  requestChanges(id: string, feedback: ReviewFeedback): Handoff;
  resubmit(id: string, message?: string): Handoff;
  getByArtifact(artifactId: string): Handoff[];
  getByWorker(workerId: string, role: 'from' | 'to'): Handoff[];
  getPending(): Handoff[];
}
