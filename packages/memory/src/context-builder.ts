/**
 * OpenAgent V2 - Context Builder
 *
 * Formats memories into structured LLM prompt sections.
 */

import type { IMemoryStore, ContextBuildOptions, MemoryEntry, MemoryType } from './types.js';

/**
 * Builds context sections from stored memories for injection into LLM prompts.
 */
export class ContextBuilder {
  private readonly store: IMemoryStore;

  constructor(store: IMemoryStore) {
    this.store = store;
  }

  /**
   * Build a context string from memories matching the given options.
   * Returns a formatted markdown string ready for prompt injection.
   */
  buildContext(opts: ContextBuildOptions): string {
    const memories = this.gatherMemories(opts);

    if (memories.length === 0) {
      return '';
    }

    const sections: string[] = [];
    sections.push('# Relevant Context from Memory\n');

    // Group by type
    const grouped = this.groupByType(memories);

    for (const [type, entries] of Object.entries(grouped)) {
      if (entries.length === 0) continue;

      const header = this.typeToHeader(type as MemoryType);
      sections.push(`## ${header}\n`);

      for (const entry of entries) {
        sections.push(`### ${entry.title}`);
        sections.push(entry.content);
        if (entry.tags.length > 0) {
          sections.push(`*Tags: ${entry.tags.join(', ')}*`);
        }
        sections.push('');
      }
    }

    return sections.join('\n').trim();
  }

  /**
   * Build a concise summary string (shorter than full context).
   */
  buildSummary(opts: ContextBuildOptions): string {
    const memories = this.gatherMemories(opts);

    if (memories.length === 0) {
      return '';
    }

    const lines: string[] = [`Memory context (${memories.length} entries):`];

    for (const entry of memories) {
      lines.push(`- [${entry.type}] ${entry.title}`);
    }

    return lines.join('\n');
  }

  // ===========================================================================
  // PRIVATE
  // ===========================================================================

  private gatherMemories(opts: ContextBuildOptions): MemoryEntry[] {
    const limit = opts.maxMemories ?? 20;

    // If search text is provided, use FTS
    if (opts.searchText) {
      const results = this.store.search(opts.searchText, limit);
      let entries = results.map((r) => r.entry);

      // Further filter by project/worker/type
      entries = entries.filter((e) => {
        if (e.projectId !== opts.projectId) return false;
        if (opts.workerId && e.workerId !== opts.workerId) return false;
        if (opts.types && !opts.types.includes(e.type)) return false;
        return true;
      });

      return entries.slice(0, limit);
    }

    // Otherwise, query with filters
    return this.store.query({
      projectId: opts.projectId,
      workerId: opts.workerId,
      type: opts.types && opts.types.length === 1 ? opts.types[0] : undefined,
      limit,
      orderBy: 'lastAccessed',
      order: 'desc',
    });
  }

  private groupByType(entries: MemoryEntry[]): Record<MemoryType, MemoryEntry[]> {
    const grouped: Record<MemoryType, MemoryEntry[]> = {
      decision: [],
      pattern: [],
      convention: [],
      failure: [],
    };

    for (const entry of entries) {
      grouped[entry.type].push(entry);
    }

    return grouped;
  }

  private typeToHeader(type: MemoryType): string {
    switch (type) {
      case 'decision': return 'Past Decisions';
      case 'pattern': return 'Known Patterns';
      case 'convention': return 'Conventions';
      case 'failure': return 'Past Failures';
      default: return type;
    }
  }
}
