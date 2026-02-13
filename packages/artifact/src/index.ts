/**
 * @openagent/artifact
 *
 * Versioned artifact protocol with handoff state machine for OpenAgent V2.
 */

export { ArtifactStore } from './store.js';
export { HandoffManager } from './handoff.js';

export type {
  ArtifactType,
  ArtifactStatus,
  Artifact,
  ArtifactVersion,
  ArtifactCreateInput,
  HandoffStatus,
  Handoff,
  ReviewFeedback,
  IArtifactStore,
  IHandoffManager,
} from './types.js';
