/**
 * Per-user undo/redo manager for OpenAgent Collab.
 *
 * Wraps Y.UndoManager so that each participant can undo only their own
 * changes without affecting others.
 */

import * as Y from 'yjs';
import type { UndoManagerConfig, UndoRedoState } from './types.js';

// ============================================================================
// Defaults
// ============================================================================

const DEFAULT_CAPTURE_TIMEOUT = 500; // ms

// ============================================================================
// CollabUndoManager
// ============================================================================

/**
 * Per-user undo manager that wraps Y.UndoManager.
 *
 * ```ts
 * const undoMgr = new CollabUndoManager(ydoc, 'user-1', [ytext]);
 * // … user types …
 * undoMgr.undo();
 * undoMgr.redo();
 * ```
 */
export class CollabUndoManager {
  private readonly inner: Y.UndoManager;
  private readonly userId: string;

  constructor(
    ydoc: Y.Doc,
    userId: string,
    scope: Y.AbstractType<unknown>[],
    config?: Partial<UndoManagerConfig>,
  ) {
    this.userId = userId;

    const trackedOrigins = config?.trackedOrigins ?? new Set([userId]);
    const captureTimeout = config?.captureTimeout ?? DEFAULT_CAPTURE_TIMEOUT;

    this.inner = new Y.UndoManager(scope, {
      captureTimeout,
      trackedOrigins,
    });
  }

  // --------------------------------------------------------------------------
  // Actions
  // --------------------------------------------------------------------------

  /** Undo the last change by this user. */
  undo(): void {
    this.inner.undo();
  }

  /** Redo the last undone change by this user. */
  redo(): void {
    this.inner.redo();
  }

  /** Clear undo/redo history. */
  clear(): void {
    this.inner.clear();
  }

  /** Stop tracking and clean up. */
  destroy(): void {
    this.inner.destroy();
  }

  // --------------------------------------------------------------------------
  // State
  // --------------------------------------------------------------------------

  /** Whether undo is available. */
  get canUndo(): boolean {
    return this.inner.undoStack.length > 0;
  }

  /** Whether redo is available. */
  get canRedo(): boolean {
    return this.inner.redoStack.length > 0;
  }

  /** Snapshot of undo/redo state. */
  getState(): UndoRedoState {
    return {
      canUndo: this.canUndo,
      canRedo: this.canRedo,
      undoStackSize: this.inner.undoStack.length,
      redoStackSize: this.inner.redoStack.length,
    };
  }

  /** The user ID this manager tracks. */
  getUserId(): string {
    return this.userId;
  }

  // --------------------------------------------------------------------------
  // Event Hooks
  // --------------------------------------------------------------------------

  /**
   * Register a callback for stack changes.
   * Fires after every undo/redo/push.
   */
  onStackChange(fn: (state: UndoRedoState) => void): () => void {
    const handler = () => fn(this.getState());
    this.inner.on('stack-item-added', handler);
    this.inner.on('stack-item-popped', handler);
    return () => {
      this.inner.off('stack-item-added', handler);
      this.inner.off('stack-item-popped', handler);
    };
  }
}
