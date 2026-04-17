/**
 * File operations on a Yjs CRDT document.
 *
 * High-level CRUD API that operates within Yjs transactions:
 * - createFile / deleteFile / renameFile
 * - getContent / insertText / deleteText / replaceRange
 * - File metadata and tree helpers
 */

import * as Y from 'yjs';
import {
  getFiles,
  getFileMeta,
  getTree,
  getClaims,
  getSoftLocks,
} from './document.js';
import type { FileMeta, TreeNode } from './types.js';

// ============================================================================
// File CRUD
// ============================================================================

/**
 * Create a new file in the document with initial content.
 *
 * @throws If the file already exists
 */
export function createFile(
  ydoc: Y.Doc,
  path: string,
  content: string,
  participantId: string,
  language?: string,
): void {
  const files = getFiles(ydoc);
  if (files.has(path)) {
    throw new Error(`File already exists: ${path}`);
  }

  ydoc.transact(() => {
    // Create Y.Text for content
    const ytext = new Y.Text();
    ytext.insert(0, content);
    files.set(path, ytext);

    // Store metadata
    const meta: FileMeta = {
      path,
      language: language ?? detectLanguage(path),
      lastModifiedBy: participantId,
      lastModifiedAt: Date.now(),
      size: content.length,
    };
    getFileMeta(ydoc).set(path, meta);

    // Add to tree
    addToTree(ydoc, path);
  }, participantId);
}

/**
 * Delete a file from the document.
 *
 * @throws If the file does not exist
 */
export function deleteFile(
  ydoc: Y.Doc,
  path: string,
  participantId: string,
): void {
  const files = getFiles(ydoc);
  if (!files.has(path)) {
    throw new Error(`File not found: ${path}`);
  }

  ydoc.transact(() => {
    files.delete(path);
    getFileMeta(ydoc).delete(path);
    getClaims(ydoc).delete(path);
    getSoftLocks(ydoc).delete(path);
    removeFromTree(ydoc, path);
  }, participantId);
}

/**
 * Rename (move) a file in the document.
 *
 * @throws If the old path doesn't exist or new path already exists
 */
export function renameFile(
  ydoc: Y.Doc,
  oldPath: string,
  newPath: string,
  participantId: string,
): void {
  const files = getFiles(ydoc);
  const oldText = files.get(oldPath);
  if (!oldText) {
    throw new Error(`File not found: ${oldPath}`);
  }
  if (files.has(newPath)) {
    throw new Error(`File already exists: ${newPath}`);
  }

  ydoc.transact(() => {
    // Copy content to new path
    const content = oldText.toString();
    const newText = new Y.Text();
    newText.insert(0, content);
    files.set(newPath, newText);

    // Move metadata
    const metaMap = getFileMeta(ydoc);
    const oldMeta = metaMap.get(oldPath);
    const newMeta: FileMeta = {
      path: newPath,
      language: detectLanguage(newPath),
      lastModifiedBy: participantId,
      lastModifiedAt: Date.now(),
      size: oldMeta?.size ?? content.length,
    };
    metaMap.set(newPath, newMeta);
    metaMap.delete(oldPath);

    // Move claims
    const claims = getClaims(ydoc);
    const claimVal = claims.get(oldPath);
    if (claimVal) {
      claims.set(newPath, claimVal);
      claims.delete(oldPath);
    }

    // Remove old file + tree entry, add new tree entry
    files.delete(oldPath);
    getSoftLocks(ydoc).delete(oldPath);
    removeFromTree(ydoc, oldPath);
    addToTree(ydoc, newPath);
  }, participantId);
}

// ============================================================================
// Content Operations
// ============================================================================

/**
 * Get the Y.Text for a file path.
 *
 * @returns The Y.Text instance, or undefined if the file doesn't exist.
 */
export function getFileText(ydoc: Y.Doc, path: string): Y.Text | undefined {
  return getFiles(ydoc).get(path);
}

/**
 * Insert text at a position in a file's Y.Text.
 *
 * @throws If the file doesn't exist
 */
export function insertText(
  ydoc: Y.Doc,
  path: string,
  index: number,
  text: string,
  participantId: string,
): void {
  const ytext = getFileText(ydoc, path);
  if (!ytext) throw new Error(`File not found: ${path}`);

  ydoc.transact(() => {
    ytext.insert(index, text);
    touchFileMeta(ydoc, path, participantId);
  }, participantId);
}

/**
 * Delete a range of text from a file's Y.Text.
 *
 * @throws If the file doesn't exist
 */
export function deleteText(
  ydoc: Y.Doc,
  path: string,
  index: number,
  length: number,
  participantId: string,
): void {
  const ytext = getFileText(ydoc, path);
  if (!ytext) throw new Error(`File not found: ${path}`);

  ydoc.transact(() => {
    ytext.delete(index, length);
    touchFileMeta(ydoc, path, participantId);
  }, participantId);
}

/**
 * Replace a range of text (delete + insert) in a single transaction.
 *
 * @throws If the file doesn't exist
 */
export function replaceText(
  ydoc: Y.Doc,
  path: string,
  index: number,
  deleteLength: number,
  insertContent: string,
  participantId: string,
): void {
  const ytext = getFileText(ydoc, path);
  if (!ytext) throw new Error(`File not found: ${path}`);

  ydoc.transact(() => {
    ytext.delete(index, deleteLength);
    ytext.insert(index, insertContent);
    touchFileMeta(ydoc, path, participantId);
  }, participantId);
}

// ============================================================================
// Metadata
// ============================================================================

/**
 * Update the last-modified metadata for a file.
 */
function touchFileMeta(ydoc: Y.Doc, path: string, participantId: string): void {
  const metaMap = getFileMeta(ydoc);
  const existing = metaMap.get(path);
  if (existing) {
    const ytext = getFiles(ydoc).get(path);
    metaMap.set(path, {
      ...existing,
      lastModifiedBy: participantId,
      lastModifiedAt: Date.now(),
      size: ytext?.length ?? existing.size,
    });
  }
}

// ============================================================================
// Tree Helpers
// ============================================================================

/**
 * Add a file path to the tree array (flat list of TreeNode).
 */
function addToTree(ydoc: Y.Doc, path: string): void {
  const tree = getTree(ydoc);
  const name = path.split('/').pop() ?? path;
  const node: TreeNode = { name, type: 'file', path };
  tree.push([node]);
}

/**
 * Remove a file path from the tree array.
 */
function removeFromTree(ydoc: Y.Doc, path: string): void {
  const tree = getTree(ydoc);
  for (let i = 0; i < tree.length; i++) {
    const node = tree.get(i);
    if (node && node.path === path) {
      tree.delete(i, 1);
      return;
    }
  }
}

/**
 * Build a nested directory tree from the flat tree array.
 */
export function buildNestedTree(ydoc: Y.Doc): TreeNode {
  const flat = getTree(ydoc).toArray();
  const root: TreeNode = { name: '/', type: 'directory', path: '/', children: [] };

  for (const node of flat) {
    const parts = node.path.split('/').filter(Boolean);
    let current = root;
    for (let i = 0; i < parts.length - 1; i++) {
      const dirName = parts[i];
      const dirPath = '/' + parts.slice(0, i + 1).join('/');
      let child = current.children?.find(c => c.path === dirPath);
      if (!child) {
        child = { name: dirName, type: 'directory', path: dirPath, children: [] };
        current.children ??= [];
        current.children.push(child);
      }
      current = child;
    }
    current.children ??= [];
    current.children.push({ ...node });
  }

  return root;
}

// ============================================================================
// Language Detection (simple extension-based)
// ============================================================================

const EXTENSION_MAP: Record<string, string> = {
  ts: 'typescript',
  tsx: 'typescriptreact',
  js: 'javascript',
  jsx: 'javascriptreact',
  json: 'json',
  md: 'markdown',
  css: 'css',
  scss: 'scss',
  html: 'html',
  vue: 'vue',
  svelte: 'svelte',
  py: 'python',
  rs: 'rust',
  go: 'go',
  java: 'java',
  rb: 'ruby',
  yml: 'yaml',
  yaml: 'yaml',
  toml: 'toml',
  sh: 'shellscript',
  bash: 'shellscript',
  sql: 'sql',
  graphql: 'graphql',
  proto: 'protobuf',
  dockerfile: 'dockerfile',
};

function detectLanguage(path: string): string {
  const lower = path.toLowerCase();

  // Special filenames
  if (lower.endsWith('dockerfile') || lower.includes('dockerfile.')) return 'dockerfile';

  const ext = lower.split('.').pop() ?? '';
  return EXTENSION_MAP[ext] ?? 'plaintext';
}
