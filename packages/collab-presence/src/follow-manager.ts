/**
 * Follow mode manager for OpenAgent Collab.
 *
 * Allows one participant to "follow" another — auto-switching files
 * and scrolling to the followed user's cursor position.
 */

import type { FollowModeState, AwarenessState } from './types.js';

// ============================================================================
// FollowManager
// ============================================================================

export class FollowManager {
  private state: FollowModeState = {
    enabled: false,
    targetUserId: null,
    autoSwitchFiles: true,
    autoScroll: true,
  };

  private readonly onFileSwitchFns = new Set<(file: string) => void>();
  private readonly onScrollFns = new Set<(line: number, column: number) => void>();

  // --------------------------------------------------------------------------
  // State
  // --------------------------------------------------------------------------

  /** Get current follow mode state. */
  getState(): FollowModeState {
    return { ...this.state };
  }

  /** Whether follow mode is active. */
  get isFollowing(): boolean {
    return this.state.enabled && this.state.targetUserId !== null;
  }

  // --------------------------------------------------------------------------
  // Actions
  // --------------------------------------------------------------------------

  /** Start following a user. */
  follow(targetUserId: string, opts?: { autoSwitchFiles?: boolean; autoScroll?: boolean }): void {
    this.state = {
      enabled: true,
      targetUserId,
      autoSwitchFiles: opts?.autoSwitchFiles ?? true,
      autoScroll: opts?.autoScroll ?? true,
    };
  }

  /** Stop following. */
  unfollow(): void {
    this.state = {
      enabled: false,
      targetUserId: null,
      autoSwitchFiles: true,
      autoScroll: true,
    };
  }

  /**
   * Process an awareness update from the followed user.
   * Triggers file switch and/or scroll callbacks if applicable.
   */
  processUpdate(targetState: AwarenessState): void {
    if (!this.state.enabled) return;
    if (targetState.user.id !== this.state.targetUserId) return;

    const cursor = targetState.cursor;
    if (!cursor) return;

    // File switch
    if (this.state.autoSwitchFiles && cursor.file) {
      for (const fn of this.onFileSwitchFns) {
        try { fn(cursor.file); } catch { /* swallow */ }
      }
    }

    // Scroll to cursor
    if (this.state.autoScroll) {
      for (const fn of this.onScrollFns) {
        try { fn(cursor.line, cursor.column); } catch { /* swallow */ }
      }
    }
  }

  // --------------------------------------------------------------------------
  // Events
  // --------------------------------------------------------------------------

  /** Register callback for file switches. */
  onFileSwitch(fn: (file: string) => void): () => void {
    this.onFileSwitchFns.add(fn);
    return () => this.onFileSwitchFns.delete(fn);
  }

  /** Register callback for scroll-to-cursor. */
  onScroll(fn: (line: number, column: number) => void): () => void {
    this.onScrollFns.add(fn);
    return () => this.onScrollFns.delete(fn);
  }

  /** Clean up. */
  destroy(): void {
    this.unfollow();
    this.onFileSwitchFns.clear();
    this.onScrollFns.clear();
  }
}
