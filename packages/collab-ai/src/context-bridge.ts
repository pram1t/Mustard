/**
 * ContextBridge — assembles AIContext for LLM prompts.
 *
 * Pulls from injected providers (room, participants, knowledge, task)
 * and keeps a ring buffer of recent actions. The bridge itself stores
 * no room or participant state — everything else lives behind provider
 * interfaces so consumers can back them with real Yjs docs, test
 * doubles, or plain object literals.
 *
 * Phase-5 scope: bounded-character truncation via `formatForPrompt`.
 * Smart LLM-based summarization is deferred post-V1.
 */

import type {
  AIContext,
  RoomContext,
  ParticipantContext,
  ActionContext,
  ProjectKnowledge,
  TaskContext,
} from './types.js';

// ============================================================================
// Providers (host-supplied)
// ============================================================================

/**
 * Source of truth for the current room's state. Implementations will
 * back this with Yjs docs or collab-core Room instances in Phase 11;
 * tests can pass plain object literals.
 */
export interface RoomProvider {
  getRoom(): Pick<RoomContext, 'id' | 'name' | 'projectPath' | 'currentMode'>;
  getFileStats(): { fileCount: number; activeFiles: string[] };
}

/** Source of truth for the current room participants. */
export interface ParticipantProvider {
  list(): ParticipantContext[];
}

/** Project-level knowledge. Stub-safe by default. */
export interface KnowledgeProvider {
  get(): ProjectKnowledge;
}

/** Current task / conversation context. Stub-safe by default. */
export interface TaskProvider {
  current(): TaskContext;
}

// ============================================================================
// Config
// ============================================================================

export interface ContextBridgeConfig {
  /**
   * Maximum number of ActionContext entries kept in the ring buffer.
   * Default: 50.
   */
  maxRecentActions?: number;

  /**
   * Hard character cap applied by formatForPrompt. Default: 8000.
   * Truncation is a suffix-cut with an indicator, not summarization.
   */
  maxContextChars?: number;
}

export interface ContextBridgeOptions {
  room: RoomProvider;
  participants: ParticipantProvider;
  /** Optional. When absent, the bridge reports empty project knowledge. */
  knowledge?: KnowledgeProvider;
  /** Optional. When absent, the bridge reports an empty task context. */
  task?: TaskProvider;
  config?: ContextBridgeConfig;
}

// ============================================================================
// Defaults
// ============================================================================

const DEFAULT_MAX_ACTIONS = 50;
const DEFAULT_MAX_CHARS = 8000;
const TRUNCATION_NOTICE = '\n\n[…truncated]';

const EMPTY_KNOWLEDGE: ProjectKnowledge = {
  summary: '',
  keyFiles: [],
  conventions: [],
  recentDecisions: [],
};

const EMPTY_TASK: TaskContext = {
  description: '',
  conversationSummary: '',
  relevantFiles: [],
};

// ============================================================================
// ContextBridge
// ============================================================================

export class ContextBridge {
  private readonly room: RoomProvider;
  private readonly participants: ParticipantProvider;
  private readonly knowledge: KnowledgeProvider;
  private readonly task: TaskProvider;
  private readonly maxRecentActions: number;
  private readonly maxContextChars: number;

  private readonly actions: ActionContext[] = [];

  constructor(opts: ContextBridgeOptions) {
    this.room = opts.room;
    this.participants = opts.participants;
    this.knowledge = opts.knowledge ?? { get: () => EMPTY_KNOWLEDGE };
    this.task = opts.task ?? { current: () => EMPTY_TASK };
    this.maxRecentActions = opts.config?.maxRecentActions ?? DEFAULT_MAX_ACTIONS;
    this.maxContextChars = opts.config?.maxContextChars ?? DEFAULT_MAX_CHARS;
  }

  // --------------------------------------------------------------------------
  // Recent-actions ring buffer
  // --------------------------------------------------------------------------

  /** Append an action. Evicts the oldest entry when the buffer is full. */
  recordAction(action: ActionContext): void {
    this.actions.push(action);
    while (this.actions.length > this.maxRecentActions) {
      this.actions.shift();
    }
  }

  /** Clear all recorded actions. */
  clearActions(): void {
    this.actions.length = 0;
  }

  /** Return a read-only snapshot of the action buffer (oldest first). */
  getActions(): readonly ActionContext[] {
    return this.actions.slice();
  }

  // --------------------------------------------------------------------------
  // Context assembly
  // --------------------------------------------------------------------------

  /** Gather current context from all providers + the action buffer. */
  build(): AIContext {
    const roomCore = this.room.getRoom();
    const stats = this.room.getFileStats();

    return {
      room: {
        id: roomCore.id,
        name: roomCore.name,
        projectPath: roomCore.projectPath,
        currentMode: roomCore.currentMode,
        fileCount: stats.fileCount,
        activeFiles: stats.activeFiles,
      },
      participants: this.participants.list(),
      recentActions: this.actions.slice(),
      projectKnowledge: this.knowledge.get(),
      currentTask: this.task.current(),
    };
  }

  // --------------------------------------------------------------------------
  // Prompt formatting
  // --------------------------------------------------------------------------

  /**
   * Render the context as a bounded XML-ish block suitable for injection
   * into a system or user prompt. Truncates once the output exceeds
   * `maxContextChars`; does not summarize.
   */
  formatForPrompt(ctx: AIContext = this.build()): string {
    const parts: string[] = [];

    parts.push('<room>');
    parts.push(`  <id>${ctx.room.id}</id>`);
    parts.push(`  <name>${escapeXml(ctx.room.name)}</name>`);
    if (ctx.room.projectPath) {
      parts.push(`  <project-path>${escapeXml(ctx.room.projectPath)}</project-path>`);
    }
    parts.push(`  <mode>${ctx.room.currentMode}</mode>`);
    parts.push(`  <file-count>${ctx.room.fileCount}</file-count>`);
    if (ctx.room.activeFiles.length) {
      parts.push('  <active-files>');
      for (const f of ctx.room.activeFiles) {
        parts.push(`    <file>${escapeXml(f)}</file>`);
      }
      parts.push('  </active-files>');
    }
    parts.push('</room>');

    if (ctx.participants.length) {
      parts.push('<participants>');
      for (const p of ctx.participants) {
        const attrs = [
          `id="${escapeXml(p.id)}"`,
          `name="${escapeXml(p.name)}"`,
          `type="${p.type}"`,
          `activity="${p.activity}"`,
        ];
        if (p.currentFile) attrs.push(`file="${escapeXml(p.currentFile)}"`);
        const inner = p.intent ? escapeXml(p.intent) : '';
        parts.push(`  <participant ${attrs.join(' ')}>${inner}</participant>`);
      }
      parts.push('</participants>');
    }

    if (ctx.recentActions.length) {
      parts.push('<recent-actions>');
      for (const a of ctx.recentActions) {
        const target = a.target ? ` target="${escapeXml(a.target)}"` : '';
        parts.push(
          `  <action ts="${a.timestamp}" by="${escapeXml(a.participantName)}"${target}>${escapeXml(a.action)}</action>`,
        );
      }
      parts.push('</recent-actions>');
    }

    if (
      ctx.projectKnowledge.summary ||
      ctx.projectKnowledge.keyFiles.length ||
      ctx.projectKnowledge.architecture ||
      ctx.projectKnowledge.conventions.length ||
      ctx.projectKnowledge.recentDecisions.length
    ) {
      parts.push('<project-knowledge>');
      if (ctx.projectKnowledge.summary) {
        parts.push(`  <summary>${escapeXml(ctx.projectKnowledge.summary)}</summary>`);
      }
      if (ctx.projectKnowledge.architecture) {
        parts.push(`  <architecture>${escapeXml(ctx.projectKnowledge.architecture)}</architecture>`);
      }
      if (ctx.projectKnowledge.keyFiles.length) {
        parts.push(`  <key-files>${ctx.projectKnowledge.keyFiles.map(escapeXml).join(', ')}</key-files>`);
      }
      if (ctx.projectKnowledge.conventions.length) {
        parts.push('  <conventions>');
        for (const c of ctx.projectKnowledge.conventions) {
          parts.push(`    <item>${escapeXml(c)}</item>`);
        }
        parts.push('  </conventions>');
      }
      if (ctx.projectKnowledge.recentDecisions.length) {
        parts.push('  <recent-decisions>');
        for (const d of ctx.projectKnowledge.recentDecisions) {
          parts.push(`    <item>${escapeXml(d)}</item>`);
        }
        parts.push('  </recent-decisions>');
      }
      parts.push('</project-knowledge>');
    }

    if (
      ctx.currentTask.description ||
      ctx.currentTask.conversationSummary ||
      ctx.currentTask.relevantFiles.length
    ) {
      parts.push('<task>');
      if (ctx.currentTask.description) {
        parts.push(`  <description>${escapeXml(ctx.currentTask.description)}</description>`);
      }
      if (ctx.currentTask.conversationSummary) {
        parts.push(`  <conversation-summary>${escapeXml(ctx.currentTask.conversationSummary)}</conversation-summary>`);
      }
      if (ctx.currentTask.relevantFiles.length) {
        parts.push(`  <relevant-files>${ctx.currentTask.relevantFiles.map(escapeXml).join(', ')}</relevant-files>`);
      }
      parts.push('</task>');
    }

    const full = parts.join('\n');
    if (full.length <= this.maxContextChars) return full;

    const budget = Math.max(0, this.maxContextChars - TRUNCATION_NOTICE.length);
    return full.slice(0, budget) + TRUNCATION_NOTICE;
  }
}

// ============================================================================
// Helpers
// ============================================================================

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
