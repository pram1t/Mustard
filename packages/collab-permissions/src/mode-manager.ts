/**
 * ModeManager — holds the current permission mode for a room, exposes
 * capability queries, and emits events on mode change.
 *
 * One manager per room. Mode changes are local-first + event-driven;
 * broadcast to other rooms happens through the bus adapter.
 */

import type { PermissionMode } from '@openagent/collab-core';
import type {
  ModeCapabilities,
  ModeChangeEvent,
  ModeRules,
  ModeState,
} from './types.js';
import { DEFAULT_MODE_RULES } from './types.js';

type ModeEventName = 'changed';

export interface ModeManagerOptions {
  /** Room this manager belongs to. Stamped on every ModeChangeEvent. */
  roomId: string;

  /** Starting mode. Defaults to 'plan' (safest). */
  initialMode?: PermissionMode;

  /** Who set the initial mode. Defaults to 'system'. */
  initialSetBy?: string;

  /** Mode capability matrix. Defaults to DEFAULT_MODE_RULES. */
  rules?: ModeRules;
}

export class ModeManager {
  private readonly roomId: string;
  private readonly rules: ModeRules;
  private state: ModeState;
  private readonly listeners = new Map<
    ModeEventName,
    Set<(event: ModeChangeEvent) => void>
  >();

  constructor(options: ModeManagerOptions) {
    this.roomId = options.roomId;
    this.rules = options.rules ?? DEFAULT_MODE_RULES;
    this.state = {
      current: options.initialMode ?? 'plan',
      previous: undefined,
      setBy: options.initialSetBy ?? 'system',
      setAt: new Date(),
    };
  }

  // --------------------------------------------------------------------------
  // Queries
  // --------------------------------------------------------------------------

  /** Current mode string. */
  current(): PermissionMode {
    return this.state.current;
  }

  /** Full state snapshot (copy). */
  getState(): ModeState {
    return { ...this.state };
  }

  /** Capability block for the current mode. */
  capabilities(): ModeCapabilities {
    return this.rules[this.state.current];
  }

  /** Room id this manager belongs to. */
  getRoomId(): string {
    return this.roomId;
  }

  // --------------------------------------------------------------------------
  // Mutations
  // --------------------------------------------------------------------------

  /**
   * Switch to a new mode. Returns the emitted event (null if mode
   * unchanged).
   */
  setMode(next: PermissionMode, changedBy: string): ModeChangeEvent | null {
    if (next === this.state.current) return null;

    const event: ModeChangeEvent = {
      type: 'mode_changed',
      roomId: this.roomId,
      oldMode: this.state.current,
      newMode: next,
      changedBy,
      timestamp: Date.now(),
    };

    this.state = {
      current: next,
      previous: this.state.current,
      setBy: changedBy,
      setAt: new Date(event.timestamp),
    };

    this.emit('changed', event);
    return event;
  }

  /**
   * Switch back to the previous mode, if any. Returns the emitted event
   * (null when there is no previous mode or the room is already in it).
   */
  undo(changedBy: string): ModeChangeEvent | null {
    const previous = this.state.previous;
    if (!previous) return null;
    return this.setMode(previous, changedBy);
  }

  // --------------------------------------------------------------------------
  // Events
  // --------------------------------------------------------------------------

  on(
    event: ModeEventName,
    fn: (event: ModeChangeEvent) => void,
  ): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(fn);
    return () => this.listeners.get(event)?.delete(fn);
  }

  private emit(event: ModeEventName, payload: ModeChangeEvent): void {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const fn of set) {
      try {
        fn(payload);
      } catch {
        /* swallow — match IntentEngine.emit behavior */
      }
    }
  }
}
