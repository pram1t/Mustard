/**
 * Activity state machine for OpenAgent Collab.
 *
 * Tracks participant activity transitions:
 *   active → typing → idle → away (for humans)
 *   idle → thinking → executing → idle (for AI)
 *
 * Uses configurable timeouts for idle/away detection.
 */

import type { ActivityState, ActivityConfig } from './types.js';
import { DEFAULT_ACTIVITY_CONFIG } from './types.js';

// ============================================================================
// ActivityTracker
// ============================================================================

/**
 * Tracks a single participant's activity state.
 *
 * ```ts
 * const tracker = new ActivityTracker('human');
 * tracker.onStateChange(state => console.log(state));
 * tracker.recordKeystroke(); // → 'typing'
 * // after idleTimeout… → 'idle'
 * // after awayTimeout… → 'away'
 * ```
 */
export class ActivityTracker {
  private state: ActivityState;
  private readonly participantType: 'human' | 'ai';
  private readonly config: ActivityConfig;
  private lastAction: number;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private awayTimer: ReturnType<typeof setTimeout> | null = null;
  private changeListeners = new Set<(state: ActivityState) => void>();

  constructor(participantType: 'human' | 'ai', config?: Partial<ActivityConfig>) {
    this.participantType = participantType;
    this.config = { ...DEFAULT_ACTIVITY_CONFIG, ...config };
    this.state = 'active';
    this.lastAction = Date.now();
  }

  // --------------------------------------------------------------------------
  // State
  // --------------------------------------------------------------------------

  /** Current activity state. */
  getState(): ActivityState {
    return this.state;
  }

  /** How long since last action (ms). */
  getTimeSinceLastAction(): number {
    return Date.now() - this.lastAction;
  }

  // --------------------------------------------------------------------------
  // Human Activity Signals
  // --------------------------------------------------------------------------

  /** Record a keystroke → transitions to 'typing'. */
  recordKeystroke(): void {
    this.touch();
    this.setState('typing');
  }

  /** Record a cursor movement → transitions to 'active'. */
  recordCursorMove(): void {
    this.touch();
    this.setState('active');
  }

  /** Record a click → transitions to 'active'. */
  recordClick(): void {
    this.touch();
    this.setState('active');
  }

  /** Record a file open → transitions to 'viewing'. */
  recordFileOpen(): void {
    this.touch();
    this.setState('viewing');
  }

  /** Record tab blur → transitions to 'away'. */
  recordBlur(): void {
    this.clearTimers();
    this.setState('away');
  }

  /** Record tab focus → transitions to 'active'. */
  recordFocus(): void {
    this.touch();
    this.setState('active');
  }

  // --------------------------------------------------------------------------
  // AI Activity Signals
  // --------------------------------------------------------------------------

  /** AI starts thinking. */
  setThinking(): void {
    if (this.participantType !== 'ai') return;
    this.touch();
    this.setState('thinking');
  }

  /** AI starts executing an action. */
  setExecuting(): void {
    if (this.participantType !== 'ai') return;
    this.touch();
    this.setState('executing');
  }

  /** AI returns to idle. */
  setIdle(): void {
    this.touch();
    this.setState('idle');
  }

  // --------------------------------------------------------------------------
  // Lifecycle
  // --------------------------------------------------------------------------

  /** Clean up timers. */
  destroy(): void {
    this.clearTimers();
    this.changeListeners.clear();
  }

  // --------------------------------------------------------------------------
  // Events
  // --------------------------------------------------------------------------

  /** Register a state change callback. Returns unsubscribe function. */
  onStateChange(fn: (state: ActivityState) => void): () => void {
    this.changeListeners.add(fn);
    return () => this.changeListeners.delete(fn);
  }

  // --------------------------------------------------------------------------
  // Internal
  // --------------------------------------------------------------------------

  private setState(next: ActivityState): void {
    if (next === this.state) return;
    this.state = next;
    for (const fn of this.changeListeners) {
      try { fn(next); } catch { /* swallow */ }
    }
  }

  private touch(): void {
    this.lastAction = Date.now();
    this.resetTimers();
  }

  private resetTimers(): void {
    this.clearTimers();

    // Idle timer
    this.idleTimer = setTimeout(() => {
      if (this.state !== 'away') {
        this.setState('idle');

        // Away timer starts after going idle
        this.awayTimer = setTimeout(() => {
          if (this.state === 'idle') {
            this.setState('away');
          }
        }, this.config.awayTimeout - this.config.idleTimeout);
      }
    }, this.config.idleTimeout);
  }

  private clearTimers(): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
    if (this.awayTimer) {
      clearTimeout(this.awayTimer);
      this.awayTimer = null;
    }
  }
}
