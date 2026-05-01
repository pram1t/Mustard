/**
 * Cursor tracker for OpenAgent Collab.
 *
 * Manages local cursor state and throttles broadcasts to the awareness layer.
 */

import type { CursorState, RemoteCursor, UserInfo, ActivityState } from './types.js';
import type { SelectionRange } from '@pram1t/mustard-collab-core';

// ============================================================================
// CursorTracker
// ============================================================================

const DEFAULT_THROTTLE_MS = 100;

/**
 * Tracks local cursor position and provides throttled updates.
 */
export class CursorTracker {
  private current: CursorState | null = null;
  private readonly throttleMs: number;
  private throttleTimer: ReturnType<typeof setTimeout> | null = null;
  private pending: CursorState | null = null;
  private broadcastFn: ((cursor: CursorState | null) => void) | null = null;

  constructor(throttleMs?: number) {
    this.throttleMs = throttleMs ?? DEFAULT_THROTTLE_MS;
  }

  // --------------------------------------------------------------------------
  // Local Cursor
  // --------------------------------------------------------------------------

  /** Set the broadcast callback. */
  onBroadcast(fn: (cursor: CursorState | null) => void): void {
    this.broadcastFn = fn;
  }

  /** Update the local cursor position (throttled broadcast). */
  setCursor(file: string | null, line: number, column: number, selection?: SelectionRange): void {
    this.current = { file, line, column, selection };
    this.throttledBroadcast();
  }

  /** Clear the local cursor (e.g. on blur). */
  clearCursor(): void {
    this.current = null;
    this.broadcastNow();
  }

  /** Get the current local cursor state. */
  getCursor(): CursorState | null {
    return this.current;
  }

  // --------------------------------------------------------------------------
  // Remote Cursors
  // --------------------------------------------------------------------------

  /**
   * Build a RemoteCursor for rendering from awareness state data.
   *
   * @param user      User info from awareness
   * @param cursor    Cursor state from awareness
   * @param activity  Activity state from awareness
   * @param staleMs   How old (ms) before considered stale
   * @param lastActivity  Last activity timestamp from awareness
   */
  static toRemoteCursor(
    user: UserInfo,
    cursor: CursorState,
    activity: ActivityState,
    lastActivity: number,
    staleMs = 30_000,
  ): RemoteCursor {
    return {
      user,
      line: cursor.line,
      column: cursor.column,
      selection: cursor.selection,
      activity,
      isStale: Date.now() - lastActivity > staleMs,
    };
  }

  // --------------------------------------------------------------------------
  // Lifecycle
  // --------------------------------------------------------------------------

  /** Clean up timers. */
  destroy(): void {
    if (this.throttleTimer) {
      clearTimeout(this.throttleTimer);
      this.throttleTimer = null;
    }
    this.broadcastFn = null;
  }

  // --------------------------------------------------------------------------
  // Internal
  // --------------------------------------------------------------------------

  private throttledBroadcast(): void {
    this.pending = this.current;
    if (this.throttleTimer) return;

    this.throttleTimer = setTimeout(() => {
      this.throttleTimer = null;
      if (this.pending !== null) {
        this.broadcastNow();
      }
    }, this.throttleMs);
  }

  private broadcastNow(): void {
    if (this.broadcastFn) {
      this.broadcastFn(this.current);
    }
    this.pending = null;
  }
}
