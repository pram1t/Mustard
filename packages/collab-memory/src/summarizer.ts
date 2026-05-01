/**
 * Session summarizer — feeds session entries to an LLM (or any
 * caller-supplied completion callback) and produces a SessionSummary.
 *
 * Test-friendly: the callback contract is just `(prompt) => text`.
 * Consumers can wire it to @mustard/llm or pass a mock.
 *
 * Extracts decisions and files-modified deterministically from the
 * entry stream; the LLM is only responsible for the free-form summary
 * paragraph.
 */

import type { SessionEntry, SessionSummary } from './types.js';
import type { SessionMemory } from './session.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Minimal completion interface. A function that turns a prompt into
 * text. Sync or async.
 */
export type CompleteFn = (prompt: string) => Promise<string> | string;

export interface SummarizerOptions {
  /**
   * Completion callback. Required for LLM-driven summaries. If omitted,
   * the summarizer produces a deterministic "heuristic" summary from
   * the entry stream without calling any model (useful as a fallback).
   */
  complete?: CompleteFn;

  /**
   * Max tokens (chars/4 approximation) of entry content to include in
   * the prompt. Older entries trimmed first. Default 3000.
   */
  maxPromptTokens?: number;

  /**
   * Which session memory to pull entries/metadata from. Required.
   */
  session: SessionMemory;
}

export interface SummarizeInput {
  sessionId: string;
  /**
   * Optional override for the ended-at timestamp. Defaults to now.
   * Useful when summarizing closed sessions after the fact.
   */
  endedAt?: Date;
  /** If true, also persist the result via session.storeSummary(). */
  persist?: boolean;
}

// ============================================================================
// Summarizer
// ============================================================================

export class Summarizer {
  private readonly session: SessionMemory;
  private readonly complete?: CompleteFn;
  private readonly maxPromptTokens: number;

  constructor(options: SummarizerOptions) {
    this.session = options.session;
    this.complete = options.complete;
    this.maxPromptTokens = options.maxPromptTokens ?? 3000;
  }

  async summarize(input: SummarizeInput): Promise<SessionSummary> {
    const sessions = this.session.listSessions().filter(s => s.id === input.sessionId);
    if (sessions.length === 0) {
      throw new Error(`Session not found: ${input.sessionId}`);
    }
    const record = sessions[0];
    const entries = this.session.getHistory(input.sessionId);

    const endedAt = input.endedAt ?? record.endedAt ?? new Date();
    const startedAt = record.startedAt;
    const durationSeconds = Math.max(
      0,
      Math.floor((endedAt.getTime() - startedAt.getTime()) / 1000),
    );

    const decisions = this.extractDecisions(entries);
    const filesModified = this.extractFilesModified(entries);
    const participants = this.extractParticipants(entries, record.participants);

    const summaryText = await this.renderSummaryText(entries, record.roomId);

    const summary: SessionSummary = {
      sessionId: input.sessionId,
      roomId: record.roomId,
      summary: summaryText,
      decisions,
      filesModified,
      participants,
      startedAt,
      endedAt,
      durationSeconds,
    };

    if (input.persist) {
      this.session.storeSummary(summary);
    }
    return summary;
  }

  // --------------------------------------------------------------------------
  // Internals
  // --------------------------------------------------------------------------

  private async renderSummaryText(
    entries: SessionEntry[],
    roomId: string,
  ): Promise<string> {
    const body = this.buildPromptBody(entries);

    if (!this.complete) {
      // Heuristic fallback: count entry types + list top decisions.
      return this.heuristicSummary(entries);
    }

    const prompt =
      `Summarize the following coding session in room ${roomId}. ` +
      `Focus on (1) what was accomplished, (2) key decisions made, and (3) any issues encountered.\n` +
      `Keep the summary under 4 sentences.\n\n` +
      `Session events:\n${body}`;

    const result = await this.complete(prompt);
    return (result ?? '').trim() || this.heuristicSummary(entries);
  }

  private heuristicSummary(entries: SessionEntry[]): string {
    if (!entries.length) return 'Session recorded no activity.';

    const counts = new Map<string, number>();
    for (const e of entries) {
      counts.set(e.type, (counts.get(e.type) ?? 0) + 1);
    }
    const countStr = Array.from(counts.entries())
      .map(([t, n]) => `${n} ${t}${n === 1 ? '' : 's'}`)
      .join(', ');
    const firstDecision = entries.find(e => e.type === 'decision');
    const decisionStr = firstDecision ? ` First decision: ${firstDecision.content}.` : '';
    return `Session contained ${countStr}.${decisionStr}`;
  }

  private buildPromptBody(entries: SessionEntry[]): string {
    const lines = entries.map(
      e => `[${e.createdAt.toISOString()}] [${e.type}] ${e.participantId}: ${e.content}`,
    );
    const budget = this.maxPromptTokens * 4; // approx chars
    let body = lines.join('\n');
    if (body.length <= budget) return body;

    // Trim from the top (older entries first) until we fit.
    while (body.length > budget && lines.length > 1) {
      lines.shift();
      body = lines.join('\n');
    }
    return `[… earlier events truncated …]\n${body}`;
  }

  private extractDecisions(entries: SessionEntry[]): string[] {
    return entries.filter(e => e.type === 'decision').map(e => e.content);
  }

  private extractFilesModified(entries: SessionEntry[]): string[] {
    const files = new Set<string>();
    for (const e of entries) {
      if (e.type !== 'action') continue;
      // Look for `metadata.file` first.
      const metaFile = e.metadata?.file;
      if (typeof metaFile === 'string') {
        files.add(metaFile);
        continue;
      }
      const metaPath = e.metadata?.path;
      if (typeof metaPath === 'string') {
        files.add(metaPath);
        continue;
      }
      // Fall back to `metadata.files` if it's a string[].
      const metaFiles = e.metadata?.files;
      if (Array.isArray(metaFiles)) {
        for (const f of metaFiles) {
          if (typeof f === 'string') files.add(f);
        }
      }
    }
    return Array.from(files).sort();
  }

  private extractParticipants(
    entries: SessionEntry[],
    seed: string[],
  ): string[] {
    const set = new Set<string>(seed);
    for (const e of entries) set.add(e.participantId);
    return Array.from(set).sort();
  }
}
