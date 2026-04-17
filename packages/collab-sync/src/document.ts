/**
 * Yjs document factory and utilities for OpenAgent Collab rooms.
 *
 * Creates and manages the Yjs Y.Doc with the standard shared type layout:
 * - files:    Y.Map<Y.Text>     — file contents
 * - fileMeta: Y.Map<FileMeta>   — file metadata
 * - tree:     Y.Array<TreeNode> — directory tree
 * - chat:     Y.Array<ChatMessage> — chat log
 * - claims:   Y.Map<string>     — file/zone claims
 * - softLocks: Y.Map<SoftLock>  — conflict-prevention locks
 */

import * as Y from 'yjs';
import type { FileMeta, TreeNode, ChatMessage, SoftLock } from './types.js';

// ============================================================================
// Document Factory
// ============================================================================

/**
 * Standard shared-type keys in a room document.
 */
export const DOC_KEYS = {
  FILES: 'files',
  FILE_META: 'fileMeta',
  TREE: 'tree',
  CHAT: 'chat',
  CLAIMS: 'claims',
  SOFT_LOCKS: 'softLocks',
} as const;

/**
 * Create a new Yjs document pre-initialised with all shared types.
 *
 * @param clientId  Optional client ID (defaults to Yjs auto-generated)
 * @returns A fresh Y.Doc ready for use
 */
export function createRoomDocument(clientId?: number): Y.Doc {
  const ydoc = new Y.Doc();
  if (clientId !== undefined) {
    ydoc.clientID = clientId;
  }

  // Touch every shared type so they exist even before the first update
  ydoc.getMap(DOC_KEYS.FILES);
  ydoc.getMap(DOC_KEYS.FILE_META);
  ydoc.getArray(DOC_KEYS.TREE);
  ydoc.getArray(DOC_KEYS.CHAT);
  ydoc.getMap(DOC_KEYS.CLAIMS);
  ydoc.getMap(DOC_KEYS.SOFT_LOCKS);

  return ydoc;
}

// ============================================================================
// Typed Accessors
// ============================================================================

/** Get the files map (path → Y.Text). */
export function getFiles(ydoc: Y.Doc): Y.Map<Y.Text> {
  return ydoc.getMap(DOC_KEYS.FILES) as Y.Map<Y.Text>;
}

/** Get the file-metadata map (path → FileMeta JSON). */
export function getFileMeta(ydoc: Y.Doc): Y.Map<FileMeta> {
  return ydoc.getMap(DOC_KEYS.FILE_META) as Y.Map<FileMeta>;
}

/** Get the directory tree array. */
export function getTree(ydoc: Y.Doc): Y.Array<TreeNode> {
  return ydoc.getArray(DOC_KEYS.TREE) as Y.Array<TreeNode>;
}

/** Get the chat messages array. */
export function getChat(ydoc: Y.Doc): Y.Array<ChatMessage> {
  return ydoc.getArray(DOC_KEYS.CHAT) as Y.Array<ChatMessage>;
}

/** Get the claims map (path → participantId). */
export function getClaims(ydoc: Y.Doc): Y.Map<string> {
  return ydoc.getMap(DOC_KEYS.CLAIMS) as Y.Map<string>;
}

/** Get the soft-locks map (path → SoftLock JSON). */
export function getSoftLocks(ydoc: Y.Doc): Y.Map<SoftLock> {
  return ydoc.getMap(DOC_KEYS.SOFT_LOCKS) as Y.Map<SoftLock>;
}

// ============================================================================
// Content Helpers
// ============================================================================

/**
 * Read the text content of a file.
 *
 * @returns The file content, or `undefined` if the file doesn't exist.
 */
export function getFileContent(ydoc: Y.Doc, path: string): string | undefined {
  const ytext = getFiles(ydoc).get(path);
  return ytext?.toString();
}

/**
 * Overwrite (or create) a file's text content inside a transaction.
 *
 * @param origin  Transaction origin (e.g. user ID or 'system')
 */
export function setFileContent(
  ydoc: Y.Doc,
  path: string,
  content: string,
  origin: string = 'system',
): void {
  ydoc.transact(() => {
    const filesMap = getFiles(ydoc);
    let ytext = filesMap.get(path);
    if (!ytext) {
      ytext = new Y.Text();
      filesMap.set(path, ytext);
    } else {
      ytext.delete(0, ytext.length);
    }
    ytext.insert(0, content);
  }, origin);
}

/**
 * Check whether a file exists in the document.
 */
export function hasFile(ydoc: Y.Doc, path: string): boolean {
  return getFiles(ydoc).has(path);
}

/**
 * List all file paths currently in the document.
 */
export function listFiles(ydoc: Y.Doc): string[] {
  const paths: string[] = [];
  getFiles(ydoc).forEach((_v, key) => paths.push(key));
  return paths.sort();
}

/**
 * Snapshot the entire document state as a Uint8Array.
 */
export function encodeDocumentState(ydoc: Y.Doc): Uint8Array {
  return Y.encodeStateAsUpdate(ydoc);
}

/**
 * Apply a remote update to the document.
 */
export function applyDocumentUpdate(ydoc: Y.Doc, update: Uint8Array): void {
  Y.applyUpdate(ydoc, update);
}

/**
 * Merge two documents by exchanging their state updates.
 * Useful for testing convergence.
 */
export function syncDocuments(docA: Y.Doc, docB: Y.Doc): void {
  const stateA = Y.encodeStateAsUpdate(docA);
  const stateB = Y.encodeStateAsUpdate(docB);
  Y.applyUpdate(docA, stateB);
  Y.applyUpdate(docB, stateA);
}
