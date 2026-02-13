/**
 * OpenAgent V2 - Artifact Store
 *
 * In-memory artifact storage with versioning.
 */

import { randomUUID } from 'node:crypto';
import type {
  Artifact,
  ArtifactCreateInput,
  ArtifactStatus,
  ArtifactType,
  ArtifactVersion,
  IArtifactStore,
} from './types.js';

/**
 * In-memory artifact store with versioning support.
 */
export class ArtifactStore implements IArtifactStore {
  private artifacts = new Map<string, Artifact>();
  /** Secondary index: "name::projectId" → artifact ID */
  private nameIndex = new Map<string, string>();

  /**
   * Create a new artifact with version 1.
   */
  create(input: ArtifactCreateInput): Artifact {
    const id = randomUUID();
    const now = new Date();

    const version: ArtifactVersion = {
      version: 1,
      content: input.content,
      createdBy: input.createdBy,
      summary: input.summary,
      createdAt: now,
    };

    const artifact: Artifact = {
      id,
      name: input.name,
      type: input.type,
      status: 'draft',
      createdBy: input.createdBy,
      projectId: input.projectId,
      versions: [version],
      createdAt: now,
      updatedAt: now,
    };

    this.artifacts.set(id, artifact);
    this.nameIndex.set(`${input.name}::${input.projectId}`, id);

    return artifact;
  }

  /**
   * Get an artifact by ID.
   */
  get(id: string): Artifact | undefined {
    return this.artifacts.get(id);
  }

  /**
   * Get an artifact by name within a project.
   */
  getByName(name: string, projectId: string): Artifact | undefined {
    const id = this.nameIndex.get(`${name}::${projectId}`);
    if (!id) return undefined;
    return this.artifacts.get(id);
  }

  /**
   * Add a new version to an existing artifact.
   */
  addVersion(id: string, content: unknown, createdBy: string, summary?: string): ArtifactVersion {
    const artifact = this.artifacts.get(id);
    if (!artifact) {
      throw new Error(`Artifact not found: ${id}`);
    }

    const version: ArtifactVersion = {
      version: artifact.versions.length + 1,
      content,
      createdBy,
      summary,
      createdAt: new Date(),
    };

    artifact.versions.push(version);
    artifact.updatedAt = new Date();

    return version;
  }

  /**
   * Update artifact status.
   */
  updateStatus(id: string, status: ArtifactStatus): Artifact | undefined {
    const artifact = this.artifacts.get(id);
    if (!artifact) return undefined;

    artifact.status = status;
    artifact.updatedAt = new Date();
    return artifact;
  }

  /**
   * List artifacts for a project, optionally filtered by type.
   */
  list(projectId: string, type?: ArtifactType): Artifact[] {
    const results: Artifact[] = [];
    for (const artifact of this.artifacts.values()) {
      if (artifact.projectId !== projectId) continue;
      if (type && artifact.type !== type) continue;
      results.push(artifact);
    }
    return results.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }

  /**
   * Delete an artifact.
   */
  delete(id: string): boolean {
    const artifact = this.artifacts.get(id);
    if (!artifact) return false;

    this.nameIndex.delete(`${artifact.name}::${artifact.projectId}`);
    return this.artifacts.delete(id);
  }

  /**
   * Get count of artifacts.
   */
  count(projectId?: string): number {
    if (!projectId) return this.artifacts.size;
    let n = 0;
    for (const a of this.artifacts.values()) {
      if (a.projectId === projectId) n++;
    }
    return n;
  }
}
