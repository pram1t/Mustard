import { describe, it, expect } from 'vitest';
import * as Y from 'yjs';
import { createRoomDocument, getFiles, getFileContent } from '../document.js';
import { CollabUndoManager } from '../undo-manager.js';

describe('CollabUndoManager', () => {
  function setup() {
    const ydoc = createRoomDocument(1);
    // Create a file to work with
    const files = getFiles(ydoc);
    const ytext = new Y.Text();
    files.set('test.ts', ytext);
    return { ydoc, ytext };
  }

  it('should start with empty undo/redo stacks', () => {
    const { ydoc, ytext } = setup();
    const mgr = new CollabUndoManager(ydoc, 'user-1', [ytext]);

    const state = mgr.getState();
    expect(state.canUndo).toBe(false);
    expect(state.canRedo).toBe(false);
    expect(state.undoStackSize).toBe(0);
    expect(state.redoStackSize).toBe(0);
  });

  it('should track user changes and undo them', () => {
    const { ydoc, ytext } = setup();
    const mgr = new CollabUndoManager(ydoc, 'user-1', [ytext]);

    // Make a change with the tracked origin
    ydoc.transact(() => ytext.insert(0, 'hello'), 'user-1');
    expect(ytext.toString()).toBe('hello');
    expect(mgr.canUndo).toBe(true);

    mgr.undo();
    expect(ytext.toString()).toBe('');
    expect(mgr.canUndo).toBe(false);
  });

  it('should redo undone changes', () => {
    const { ydoc, ytext } = setup();
    const mgr = new CollabUndoManager(ydoc, 'user-1', [ytext]);

    ydoc.transact(() => ytext.insert(0, 'hello'), 'user-1');
    mgr.undo();
    expect(mgr.canRedo).toBe(true);

    mgr.redo();
    expect(ytext.toString()).toBe('hello');
    expect(mgr.canRedo).toBe(false);
  });

  it('should NOT undo changes from other users', () => {
    const { ydoc, ytext } = setup();
    const mgr = new CollabUndoManager(ydoc, 'user-1', [ytext]);

    // Change by user-2 (different origin)
    ydoc.transact(() => ytext.insert(0, 'from-user-2'), 'user-2');
    expect(ytext.toString()).toBe('from-user-2');
    expect(mgr.canUndo).toBe(false);

    // Undo should be no-op (nothing to undo for user-1)
    mgr.undo();
    expect(ytext.toString()).toBe('from-user-2');
  });

  it('should undo only current user changes among mixed edits', () => {
    const { ydoc, ytext } = setup();
    // captureTimeout: 0 prevents grouping of separate transactions
    const mgr = new CollabUndoManager(ydoc, 'user-1', [ytext], { captureTimeout: 0 });

    // user-1 types 'A'
    ydoc.transact(() => ytext.insert(0, 'A'), 'user-1');
    // user-2 types 'B'
    ydoc.transact(() => ytext.insert(1, 'B'), 'user-2');
    // user-1 types 'C'
    ydoc.transact(() => ytext.insert(2, 'C'), 'user-1');

    expect(ytext.toString()).toBe('ABC');

    // Undo user-1's last edit (C) — B from user-2 stays
    mgr.undo();
    expect(ytext.toString()).toBe('AB');

    // Undo user-1's first edit (A) — B from user-2 stays
    mgr.undo();
    expect(ytext.toString()).toBe('B');
  });

  it('should clear undo/redo history', () => {
    const { ydoc, ytext } = setup();
    const mgr = new CollabUndoManager(ydoc, 'user-1', [ytext]);

    ydoc.transact(() => ytext.insert(0, 'hello'), 'user-1');
    expect(mgr.canUndo).toBe(true);

    mgr.clear();
    expect(mgr.canUndo).toBe(false);
    expect(mgr.canRedo).toBe(false);
  });

  it('should return userId via getUserId()', () => {
    const { ydoc, ytext } = setup();
    const mgr = new CollabUndoManager(ydoc, 'user-42', [ytext]);
    expect(mgr.getUserId()).toBe('user-42');
  });

  it('onStackChange fires on push and pop', () => {
    const { ydoc, ytext } = setup();
    const mgr = new CollabUndoManager(ydoc, 'user-1', [ytext]);

    const calls: { canUndo: boolean; canRedo: boolean }[] = [];
    const unsub = mgr.onStackChange(state => calls.push(state));

    ydoc.transact(() => ytext.insert(0, 'a'), 'user-1');
    mgr.undo();

    expect(calls.length).toBeGreaterThanOrEqual(2);
    unsub();

    // After unsubscribe, no more calls
    const callsBefore = calls.length;
    ydoc.transact(() => ytext.insert(0, 'b'), 'user-1');
    expect(calls.length).toBe(callsBefore);
  });

  it('destroy cleans up the inner UndoManager', () => {
    const { ydoc, ytext } = setup();
    const mgr = new CollabUndoManager(ydoc, 'user-1', [ytext]);

    ydoc.transact(() => ytext.insert(0, 'hello'), 'user-1');
    mgr.destroy();

    // After destroy, undo should be no-op (inner destroyed)
    // We just verify it doesn't throw
    expect(() => mgr.undo()).not.toThrow();
  });
});
