/**
 * OpenAgent V2 - Worker Memory Integration
 *
 * Wraps MemoryStore for worker-specific read/write operations.
 * Provides helpers for recording decisions, patterns, failures, and conventions,
 * and for building context from stored memories.
 */

import type { IMemoryStore, MemoryType, MemoryEntry } from '@openagent/memory';
import { ContextBuilder } from '@openagent/memory';
import type { WorkerRole } from './types.js';

/**
 * Worker-specific memory integration.
 * Each WorkerMemory instance is scoped to a particular worker + project.
 */
export class WorkerMemory {
  private readonly store: IMemoryStore;
  private readonly contextBuilder: ContextBuilder;
  private readonly workerId: string;
  private readonly workerRole: WorkerRole;
  private readonly projectId: string;

  constructor(
    store: IMemoryStore,
    workerId: string,
    workerRole: WorkerRole,
    projectId: string,
  ) {
    this.store = store;
    this.contextBuilder = new ContextBuilder(store);
    this.workerId = workerId;
    this.workerRole = workerRole;
    this.projectId = projectId;
  }

  /**
   * Build context from relevant memories for a task prompt.
   * Searches memories using the prompt text and returns formatted markdown.
   */
  buildTaskContext(prompt: string): string {
    return this.contextBuilder.buildContext({
      projectId: this.projectId,
      workerId: this.workerId,
      searchText: prompt,
      maxMemories: 10,
    });
  }

  /**
   * Record an architectural or implementation decision.
   */
  recordDecision(title: string, content: string, tags?: string[]): MemoryEntry {
    return this.record('decision', title, content, tags);
  }

  /**
   * Record a discovered pattern in the codebase.
   */
  recordPattern(title: string, content: string, tags?: string[]): MemoryEntry {
    return this.record('pattern', title, content, tags);
  }

  /**
   * Record a failure for future avoidance.
   */
  recordFailure(title: string, content: string, tags?: string[]): MemoryEntry {
    return this.record('failure', title, content, tags);
  }

  /**
   * Record a project convention.
   */
  recordConvention(title: string, content: string, tags?: string[]): MemoryEntry {
    return this.record('convention', title, content, tags);
  }

  /**
   * Get a summary of all memories for this worker + project.
   */
  getSummary(): string {
    return this.contextBuilder.buildSummary({
      projectId: this.projectId,
      workerId: this.workerId,
      maxMemories: 50,
    });
  }

  /**
   * Get the count of memories for this worker + project.
   */
  getMemoryCount(): number {
    const entries = this.store.query({
      projectId: this.projectId,
      workerId: this.workerId,
    });
    return entries.length;
  }

  /**
   * Get all memories for this worker + project.
   */
  getMemories(type?: MemoryType, limit?: number): MemoryEntry[] {
    return this.store.query({
      projectId: this.projectId,
      workerId: this.workerId,
      type,
      limit,
      orderBy: 'lastAccessed',
      order: 'desc',
    });
  }

  // ===========================================================================
  // PRIVATE
  // ===========================================================================

  private record(
    type: MemoryType,
    title: string,
    content: string,
    tags?: string[],
  ): MemoryEntry {
    return this.store.store({
      type,
      workerId: this.workerId,
      projectId: this.projectId,
      title,
      content,
      tags: tags ?? [this.workerRole],
      metadata: { role: this.workerRole },
    });
  }
}
