/**
 * Context assembler — pulls information from all four memory layers and
 * formats it as a bounded string suitable for injection into an LLM
 * system or user prompt.
 *
 * The assembler owns no state; it holds references to the layer
 * instances and re-queries on every `build()`. A cheap hash of the
 * resulting AssembledContext lets consumers short-circuit renders when
 * nothing changed (see `buildCacheKey`).
 *
 * Token counting here is a character-based approximation (4 chars per
 * token) — good enough for budgeting; consumers can pass a smarter
 * counter if they have one.
 */

import type {
  AssembledContext,
  ContextAssemblyConfig,
  MemoryLayer,
  ThreadMessage,
} from './types.js';
import { DEFAULT_CONTEXT_CONFIG } from './types.js';
import type { EphemeralMemory } from './ephemeral.js';
import type { SessionMemory } from './session.js';
import type { ProjectMemory } from './project.js';
import type { TeamMemory } from './team.js';

// ============================================================================
// Config
// ============================================================================

export interface ContextAssemblerOptions {
  ephemeral?: EphemeralMemory;
  session?: SessionMemory;
  project?: ProjectMemory;
  team?: TeamMemory;

  /**
   * Which room this context is for. Required if session or project
   * layers are provided (they scope queries by roomId).
   */
  roomId?: string;

  /** Required if team layer is provided. */
  teamId?: string;

  /** Config. Defaults to DEFAULT_CONTEXT_CONFIG. */
  config?: Partial<ContextAssemblyConfig>;

  /**
   * Optional custom token counter. Default: `Math.ceil(chars / 4)`.
   */
  tokenCount?: (text: string) => number;
}

/** Approximate token count (4 chars ≈ 1 token). */
export function approxTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// ============================================================================
// ContextAssembler
// ============================================================================

export class ContextAssembler {
  private readonly ephemeral?: EphemeralMemory;
  private readonly session?: SessionMemory;
  private readonly project?: ProjectMemory;
  private readonly team?: TeamMemory;
  private readonly roomId?: string;
  private readonly teamId?: string;
  private readonly config: ContextAssemblyConfig;
  private readonly count: (text: string) => number;

  constructor(options: ContextAssemblerOptions = {}) {
    this.ephemeral = options.ephemeral;
    this.session = options.session;
    this.project = options.project;
    this.team = options.team;
    this.roomId = options.roomId;
    this.teamId = options.teamId;
    this.config = { ...DEFAULT_CONTEXT_CONFIG, ...options.config };
    this.count = options.tokenCount ?? approxTokens;
  }

  // --------------------------------------------------------------------------
  // Build
  // --------------------------------------------------------------------------

  build(): AssembledContext {
    const layers: AssembledContext['layers'] = {};

    if (this.config.includeEphemeral && this.ephemeral) {
      layers.ephemeral = this.formatEphemeral(
        this.config.layerBudgets.ephemeral,
      );
    }

    if (this.session && this.roomId) {
      layers.session = this.formatSession(
        this.config.layerBudgets.session,
      );
    }

    if (this.project && this.roomId) {
      layers.project = this.formatProject(
        this.config.layerBudgets.project,
      );
    }

    if (this.team && this.teamId) {
      layers.team = this.formatTeam(this.config.layerBudgets.team);
    }

    const total = this.sumTokens(layers);
    // If total exceeds maxTokens, trim from the back: team first,
    // then project, then session, then ephemeral — ephemeral is the
    // most current and cheapest to keep.
    const order: MemoryLayer[] = ['team', 'project', 'session', 'ephemeral'];
    let running = total;
    for (const layer of order) {
      if (running <= this.config.maxTokens) break;
      const content = layers[layer];
      if (!content) continue;
      const freed = this.count(content);
      layers[layer] = undefined;
      running -= freed;
    }

    return {
      layers,
      tokenCount: running,
      assembledAt: new Date(),
    };
  }

  /**
   * Render the assembled context as a single prompt-ready string.
   * Layers rendered in a deterministic order (project → team →
   * session → ephemeral) with XML-ish wrappers so the LLM can parse
   * them.
   */
  format(ctx: AssembledContext = this.build()): string {
    const parts: string[] = [];
    if (ctx.layers.project) {
      parts.push('<project-memory>');
      parts.push(ctx.layers.project);
      parts.push('</project-memory>');
    }
    if (ctx.layers.team) {
      parts.push('<team-memory>');
      parts.push(ctx.layers.team);
      parts.push('</team-memory>');
    }
    if (ctx.layers.session) {
      parts.push('<session-memory>');
      parts.push(ctx.layers.session);
      parts.push('</session-memory>');
    }
    if (ctx.layers.ephemeral) {
      parts.push('<ephemeral>');
      parts.push(ctx.layers.ephemeral);
      parts.push('</ephemeral>');
    }
    return parts.join('\n');
  }

  /**
   * Cheap hash of the rendered context. Useful for cache-invalidation.
   */
  buildCacheKey(ctx: AssembledContext = this.build()): string {
    return hashString(this.format(ctx));
  }

  // --------------------------------------------------------------------------
  // Per-layer formatters
  // --------------------------------------------------------------------------

  private formatEphemeral(budget: number): string {
    if (!this.ephemeral) return '';

    const cursors = this.ephemeral.cursorList();
    const intents = this.ephemeral.intentList();
    const thread = this.ephemeral.threadRecent(10);

    const lines: string[] = [];
    if (cursors.length) {
      lines.push(
        `Active cursors: ${cursors
          .map(c => `${c.participantId}@${c.file ?? '?'}:${c.line}`)
          .join(', ')}`,
      );
    }
    if (intents.length) {
      lines.push(
        `Pending intents: ${intents
          .map(i => `${i.intentId.slice(0, 8)}(${i.status}: ${i.summary})`)
          .join(' | ')}`,
      );
    }
    if (thread.length) {
      lines.push('Recent messages:');
      for (const m of thread) {
        lines.push(`  [${m.participantName}] ${m.content}`);
      }
    }
    return this.truncate(lines.join('\n'), budget);
  }

  private formatSession(budget: number): string {
    if (!this.session || !this.roomId) return '';
    const sessions = this.session.listSessions({
      roomId: this.roomId,
      limit: this.config.recentSessionCount,
    });
    if (!sessions.length) return '';

    const lines: string[] = [];
    for (const s of sessions) {
      const summary = this.session.getSummary(s.id);
      const header = `Session ${s.id.slice(0, 8)} (${formatDate(s.startedAt)}${s.endedAt ? ' → ' + formatDate(s.endedAt) : ' — ongoing'})`;
      lines.push(header);
      if (summary) {
        lines.push(`  Summary: ${summary.summary}`);
        if (summary.decisions.length) {
          lines.push(`  Decisions: ${summary.decisions.join('; ')}`);
        }
        if (summary.filesModified.length) {
          lines.push(`  Files: ${summary.filesModified.join(', ')}`);
        }
      } else {
        const recent = this.session.getHistory(s.id, { limit: 5 });
        if (recent.length) {
          lines.push('  Recent activity:');
          for (const e of recent) {
            lines.push(`    [${e.type}] ${oneLine(e.content, 120)}`);
          }
        }
      }
    }
    return this.truncate(lines.join('\n'), budget);
  }

  private formatProject(budget: number): string {
    if (!this.project || !this.roomId) return '';

    const entries = this.project.list({ roomId: this.roomId, limit: 15 });
    if (!entries.length) return '';

    const byCategory = new Map<string, typeof entries>();
    for (const e of entries) {
      const list = byCategory.get(e.category) ?? [];
      list.push(e);
      byCategory.set(e.category, list);
    }

    const lines: string[] = [];
    for (const [cat, items] of byCategory) {
      lines.push(`${cat}:`);
      for (const e of items) {
        lines.push(`  - ${e.title}: ${oneLine(e.content, 140)}`);
      }
    }
    return this.truncate(lines.join('\n'), budget);
  }

  private formatTeam(budget: number): string {
    if (!this.team || !this.teamId) return '';
    const entries = this.team.list({ teamId: this.teamId, limit: 10 });
    if (!entries.length) return '';
    const lines: string[] = [];
    for (const e of entries) {
      lines.push(`[${e.category}] ${oneLine(e.content, 140)}`);
    }
    return this.truncate(lines.join('\n'), budget);
  }

  // --------------------------------------------------------------------------
  // Helpers
  // --------------------------------------------------------------------------

  private truncate(text: string, budgetTokens: number): string {
    if (this.count(text) <= budgetTokens) return text;
    // Approximate char budget; slice + indicator.
    const charBudget = Math.max(0, budgetTokens * 4 - 16);
    return text.slice(0, charBudget) + '\n[…truncated]';
  }

  private sumTokens(layers: AssembledContext['layers']): number {
    return (
      (layers.ephemeral ? this.count(layers.ephemeral) : 0) +
      (layers.session ? this.count(layers.session) : 0) +
      (layers.project ? this.count(layers.project) : 0) +
      (layers.team ? this.count(layers.team) : 0)
    );
  }
}

// ============================================================================
// Utilities
// ============================================================================

function oneLine(s: string, max: number): string {
  const line = s.replace(/\s+/g, ' ').trim();
  return line.length > max ? line.slice(0, max - 1) + '…' : line;
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 16).replace('T', ' ');
}

/**
 * FNV-1a 32-bit hash, rendered as a lowercase hex string.
 * Deterministic, dependency-free, good enough for cache keys.
 */
function hashString(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

// Re-export so callers can construct ThreadMessage easily without a separate import.
export type { ThreadMessage };
