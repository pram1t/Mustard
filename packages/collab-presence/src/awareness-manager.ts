/**
 * Awareness manager for OpenAgent Collab.
 *
 * Wraps Yjs Awareness protocol to track participant state:
 * - User info (name, color, type)
 * - Cursor position and selection
 * - Activity state
 * - AI intent broadcast
 * - Stale entry cleanup
 */

import type {
  AwarenessState,
  UserInfo,
  CursorState,
  ActivityState,
  IntentState,
  EditingRegion,
  AwarenessChangeEvent,
} from './types.js';

// ============================================================================
// Colour Palette (12 distinct colours for participants)
// ============================================================================

const PARTICIPANT_COLORS = [
  '#4f46e5', // indigo
  '#059669', // emerald
  '#d97706', // amber
  '#dc2626', // red
  '#7c3aed', // violet
  '#0891b2', // cyan
  '#c026d3', // fuchsia
  '#65a30d', // lime
  '#ea580c', // orange
  '#0284c7', // sky
  '#be185d', // pink
  '#4338ca', // blue
];

// ============================================================================
// AwarenessManager
// ============================================================================

/**
 * Manages participant awareness state for a collab room.
 *
 * This is a standalone manager that doesn't depend on Yjs Awareness directly,
 * so it can work with any transport. The server-side handler wires this to
 * actual Yjs awareness broadcasts.
 */
export class AwarenessManager {
  private readonly states = new Map<number, AwarenessState>();
  private readonly listeners = new Map<string, Set<(...args: unknown[]) => void>>();
  private colorIndex = 0;
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;
  private readonly staleTimeoutMs: number;

  constructor(opts?: { staleTimeoutMs?: number }) {
    this.staleTimeoutMs = opts?.staleTimeoutMs ?? 30_000;
  }

  // --------------------------------------------------------------------------
  // Lifecycle
  // --------------------------------------------------------------------------

  /** Start periodic cleanup of stale entries. */
  startCleanup(intervalMs = 10_000): void {
    this.stopCleanup();
    this.cleanupTimer = setInterval(() => this.removeStale(), intervalMs);
  }

  /** Stop periodic cleanup. */
  stopCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  /** Tear down everything. */
  destroy(): void {
    this.stopCleanup();
    this.states.clear();
    this.listeners.clear();
  }

  // --------------------------------------------------------------------------
  // State Management
  // --------------------------------------------------------------------------

  /** Set the full awareness state for a client. */
  setLocalState(clientId: number, state: AwarenessState): void {
    const prev = this.states.get(clientId);
    this.states.set(clientId, { ...state, clientId });
    this.emit('change', {
      added: prev ? [] : [clientId],
      updated: prev ? [clientId] : [],
      removed: [],
    } satisfies AwarenessChangeEvent);
  }

  /** Remove a client's state. */
  removeState(clientId: number): void {
    if (this.states.has(clientId)) {
      this.states.delete(clientId);
      this.emit('change', {
        added: [],
        updated: [],
        removed: [clientId],
      } satisfies AwarenessChangeEvent);
    }
  }

  /** Get a client's current state. */
  getState(clientId: number): AwarenessState | undefined {
    return this.states.get(clientId);
  }

  /** Get all current awareness states. */
  getAllStates(): Map<number, AwarenessState> {
    return new Map(this.states);
  }

  /** Number of tracked participants. */
  get size(): number {
    return this.states.size;
  }

  // --------------------------------------------------------------------------
  // Partial Updates
  // --------------------------------------------------------------------------

  /** Update just the cursor for a client. */
  updateCursor(clientId: number, cursor: CursorState | null): void {
    const state = this.states.get(clientId);
    if (state) {
      this.setLocalState(clientId, { ...state, cursor, lastActivity: Date.now() });
    }
  }

  /** Update just the activity for a client. */
  updateActivity(clientId: number, activity: ActivityState): void {
    const state = this.states.get(clientId);
    if (state) {
      this.setLocalState(clientId, { ...state, activity, lastActivity: Date.now() });
    }
  }

  /** Update the AI intent for a client. */
  updateIntent(clientId: number, intent: IntentState | undefined): void {
    const state = this.states.get(clientId);
    if (state) {
      this.setLocalState(clientId, { ...state, intent, lastActivity: Date.now() });
    }
  }

  /** Update the editing region for a client. */
  updateEditingRegion(clientId: number, region: EditingRegion | undefined): void {
    const state = this.states.get(clientId);
    if (state) {
      this.setLocalState(clientId, { ...state, editingRegion: region, lastActivity: Date.now() });
    }
  }

  // --------------------------------------------------------------------------
  // Colour Assignment
  // --------------------------------------------------------------------------

  /** Assign the next colour from the palette. */
  nextColor(): string {
    const color = PARTICIPANT_COLORS[this.colorIndex % PARTICIPANT_COLORS.length];
    this.colorIndex++;
    return color;
  }

  // --------------------------------------------------------------------------
  // User Helpers
  // --------------------------------------------------------------------------

  /** Create an initial awareness state for a new participant. */
  createInitialState(user: UserInfo, clientId: number): AwarenessState {
    return {
      user: { ...user, color: user.color || this.nextColor() },
      cursor: null,
      activity: 'active',
      lastActivity: Date.now(),
      clientId,
    };
  }

  /** Get all states for a specific file (who's viewing/editing it). */
  getStatesForFile(filePath: string): AwarenessState[] {
    const result: AwarenessState[] = [];
    for (const state of this.states.values()) {
      if (state.cursor?.file === filePath) {
        result.push(state);
      }
    }
    return result;
  }

  /** Get all AI participant states. */
  getAIStates(): AwarenessState[] {
    const result: AwarenessState[] = [];
    for (const state of this.states.values()) {
      if (state.user.type === 'ai') {
        result.push(state);
      }
    }
    return result;
  }

  // --------------------------------------------------------------------------
  // Stale Cleanup
  // --------------------------------------------------------------------------

  /** Remove entries that haven't been updated within the stale timeout. */
  removeStale(): number[] {
    const now = Date.now();
    const removed: number[] = [];
    for (const [clientId, state] of this.states) {
      if (now - state.lastActivity > this.staleTimeoutMs) {
        this.states.delete(clientId);
        removed.push(clientId);
      }
    }
    if (removed.length > 0) {
      this.emit('change', { added: [], updated: [], removed } satisfies AwarenessChangeEvent);
    }
    return removed;
  }

  // --------------------------------------------------------------------------
  // Events
  // --------------------------------------------------------------------------

  on(event: string, fn: (...args: unknown[]) => void): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(fn);
    return () => this.listeners.get(event)?.delete(fn);
  }

  private emit(event: string, ...args: unknown[]): void {
    const set = this.listeners.get(event);
    if (set) {
      for (const fn of set) {
        try { fn(...args); } catch { /* swallow */ }
      }
    }
  }
}
