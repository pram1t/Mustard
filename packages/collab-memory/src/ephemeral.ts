/**
 * Layer 1 — Ephemeral memory.
 *
 * Per-room, in-memory, cleared on leave. Stores the live conversation
 * thread, per-participant cursor snapshots, and pending-intent
 * snapshots. No persistence, no timers, no external dependencies.
 *
 * Intended wire-up (Phase 11): awareness feeds cursorSet, IntentEngine
 * feeds intentSet (via bus subscription), chat UI feeds appendMessage.
 * This class has no opinion about who calls what; it just holds state.
 */

import type {
  EphemeralMemorySnapshot,
  CursorSnapshot,
  IntentSnapshot,
  ThreadMessage,
} from './types.js';

// ============================================================================
// Config
// ============================================================================

export interface EphemeralMemoryOptions {
  /** Max messages kept in the thread ring buffer. Default: 200. */
  maxThreadMessages?: number;
}

type EventName =
  | 'cursor_set'
  | 'cursor_removed'
  | 'intent_set'
  | 'intent_removed'
  | 'message_appended'
  | 'cleared';

const DEFAULT_MAX_THREAD = 200;

// ============================================================================
// EphemeralMemory
// ============================================================================

export class EphemeralMemory {
  private readonly cursors = new Map<string, CursorSnapshot>();
  private readonly intents = new Map<string, IntentSnapshot>();
  private readonly thread: ThreadMessage[] = [];
  private readonly maxThread: number;
  private readonly listeners = new Map<
    EventName,
    Set<(payload: unknown) => void>
  >();

  constructor(options: EphemeralMemoryOptions = {}) {
    this.maxThread = options.maxThreadMessages ?? DEFAULT_MAX_THREAD;
  }

  // --------------------------------------------------------------------------
  // Cursors
  // --------------------------------------------------------------------------

  /** Set (or replace) a participant's cursor snapshot. */
  cursorSet(snapshot: CursorSnapshot): void {
    this.cursors.set(snapshot.participantId, { ...snapshot });
    this.emit('cursor_set', snapshot);
  }

  /** Remove a participant's cursor snapshot. No-op if absent. */
  cursorRemove(participantId: string): void {
    if (!this.cursors.has(participantId)) return;
    this.cursors.delete(participantId);
    this.emit('cursor_removed', { participantId });
  }

  /** Snapshot of all cursors keyed by participantId. */
  cursorList(): CursorSnapshot[] {
    return Array.from(this.cursors.values()).map(c => ({ ...c }));
  }

  cursorGet(participantId: string): CursorSnapshot | undefined {
    const c = this.cursors.get(participantId);
    return c ? { ...c } : undefined;
  }

  // --------------------------------------------------------------------------
  // Intents
  // --------------------------------------------------------------------------

  /** Set (or replace) an intent snapshot. Indexed by intentId. */
  intentSet(snapshot: IntentSnapshot): void {
    this.intents.set(snapshot.intentId, { ...snapshot });
    this.emit('intent_set', snapshot);
  }

  /** Remove an intent snapshot. No-op if absent. */
  intentRemove(intentId: string): void {
    if (!this.intents.has(intentId)) return;
    this.intents.delete(intentId);
    this.emit('intent_removed', { intentId });
  }

  intentList(): IntentSnapshot[] {
    return Array.from(this.intents.values()).map(i => ({ ...i }));
  }

  intentGet(intentId: string): IntentSnapshot | undefined {
    const i = this.intents.get(intentId);
    return i ? { ...i } : undefined;
  }

  // --------------------------------------------------------------------------
  // Thread
  // --------------------------------------------------------------------------

  /**
   * Append a message to the thread. Evicts oldest messages when the
   * ring-buffer max is exceeded.
   */
  appendMessage(message: ThreadMessage): void {
    this.thread.push({ ...message });
    while (this.thread.length > this.maxThread) {
      this.thread.shift();
    }
    this.emit('message_appended', message);
  }

  threadList(): ThreadMessage[] {
    return this.thread.map(m => ({ ...m }));
  }

  threadRecent(n: number): ThreadMessage[] {
    if (n <= 0) return [];
    return this.thread.slice(-n).map(m => ({ ...m }));
  }

  threadSize(): number {
    return this.thread.length;
  }

  // --------------------------------------------------------------------------
  // Snapshot + clear
  // --------------------------------------------------------------------------

  /**
   * Full snapshot in the shape declared by EphemeralMemorySnapshot.
   * Maps are fresh copies so callers can't mutate internal state.
   */
  snapshot(): EphemeralMemorySnapshot {
    return {
      cursors: new Map(
        Array.from(this.cursors.entries()).map(([k, v]) => [k, { ...v }]),
      ),
      intents: new Map(
        Array.from(this.intents.entries()).map(([k, v]) => [k, { ...v }]),
      ),
      thread: this.thread.map(m => ({ ...m })),
    };
  }

  /** Wipe everything. Emits 'cleared'. */
  clear(): void {
    this.cursors.clear();
    this.intents.clear();
    this.thread.length = 0;
    this.emit('cleared', null);
  }

  // --------------------------------------------------------------------------
  // Events
  // --------------------------------------------------------------------------

  on<T = unknown>(event: EventName, fn: (payload: T) => void): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    const set = this.listeners.get(event)! as Set<(payload: unknown) => void>;
    set.add(fn as (payload: unknown) => void);
    return () => set.delete(fn as (payload: unknown) => void);
  }

  private emit(event: EventName, payload: unknown): void {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const fn of set) {
      try {
        fn(payload);
      } catch {
        /* swallow — matches IntentEngine / ModeManager convention */
      }
    }
  }
}
