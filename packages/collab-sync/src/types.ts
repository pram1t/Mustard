/**
 * CRDT synchronization types for OpenAgent Collab.
 *
 * Types for Yjs integration, document structure, and sync operations.
 */

import type * as Y from 'yjs';
import type { Range } from '@openagent/collab-core';

// ============================================================================
// Document Structure
// ============================================================================

/**
 * Room document structure — the shape of our Yjs document.
 */
export interface RoomDocument {
  /** File contents — Y.Text for each file path */
  files: Y.Map<Y.Text>;

  /** File metadata */
  fileMeta: Y.Map<FileMeta>;

  /** Directory tree structure */
  tree: Y.Array<TreeNode>;

  /** Chat messages */
  chat: Y.Array<ChatMessage>;

  /** File claims (who's working on what) */
  claims: Y.Map<string>;

  /** Soft locks for conflict prevention */
  softLocks: Y.Map<SoftLock>;
}

/**
 * File metadata.
 */
export interface FileMeta {
  /** Full file path */
  path: string;

  /** Detected language */
  language: string;

  /** Last modifier's participant ID */
  lastModifiedBy: string;

  /** Last modification timestamp */
  lastModifiedAt: number;

  /** File size in bytes */
  size: number;

  /** File hash for change detection */
  hash?: string;
}

/**
 * Tree node for directory structure.
 */
export interface TreeNode {
  /** File or directory name */
  name: string;

  /** Node type */
  type: 'file' | 'directory';

  /** Full path */
  path: string;

  /** Children (for directories) */
  children?: TreeNode[];
}

/**
 * Chat message.
 */
export interface ChatMessage {
  /** Unique message ID */
  id: string;

  /** Sender's participant ID */
  participantId: string;

  /** Sender's display name */
  participantName: string;

  /** Sender type */
  participantType: 'human' | 'ai';

  /** Message content */
  content: string;

  /** Timestamp */
  timestamp: number;

  /** Message type */
  type: ChatMessageType;
}

/** Chat message types */
export type ChatMessageType = 'message' | 'system' | 'intent' | 'action';

/**
 * Soft lock for conflict prevention.
 */
export interface SoftLock {
  /** File path */
  file: string;

  /** Locked region */
  region: Range;

  /** Lock holder's participant ID */
  participantId: string;

  /** When lock was acquired */
  acquiredAt: number;
}

// ============================================================================
// Sync Provider Types
// ============================================================================

/**
 * WebSocket provider configuration.
 */
export interface WebSocketProviderConfig {
  /** WebSocket server URL */
  url: string;

  /** Room identifier */
  roomId: string;

  /** Authentication token */
  token: string;

  /** Whether to connect immediately */
  connect?: boolean;

  /** Resync interval in milliseconds */
  resyncInterval?: number;
}

/**
 * Sync status.
 */
export interface SyncStatus {
  /** Whether WebSocket is connected */
  wsConnected: boolean;

  /** Whether synced with server */
  wsSynced: boolean;

  /** Number of WebRTC peers (0 for V1) */
  rtcPeerCount: number;

  /** Last sync timestamp */
  lastSync: number;
}

// ============================================================================
// Sync Operations
// ============================================================================

/**
 * Document update.
 */
export interface DocumentUpdate {
  /** Yjs update blob */
  update: Uint8Array;

  /** Origin of the update */
  origin: string | null;

  /** Timestamp */
  timestamp: number;
}

/**
 * Checkpoint.
 */
export interface Checkpoint {
  /** Unique checkpoint ID */
  id: string;

  /** Room this checkpoint belongs to */
  roomId: string;

  /** Encoded Yjs state */
  state: Uint8Array;

  /** Size in bytes */
  size: number;

  /** Creation timestamp */
  createdAt: Date;
}

/**
 * Sync conflict information.
 */
export interface SyncConflict {
  /** File where conflict occurred */
  file: string;

  /** Conflicting region */
  region: Range;

  /** Participants involved */
  participants: string[];

  /** Local version */
  localContent: string;

  /** Remote version */
  remoteContent: string;

  /** Merged result */
  mergedContent: string;
}

// ============================================================================
// File Operations
// ============================================================================

/** File operation union */
export type FileOperation =
  | FileCreateOperation
  | FileEditOperation
  | FileDeleteOperation
  | FileRenameOperation;

export interface FileCreateOperation {
  type: 'create';
  path: string;
  content: string;
  participantId: string;
  timestamp: number;
}

export interface FileEditOperation {
  type: 'edit';
  path: string;
  range: Range;
  oldContent: string;
  newContent: string;
  participantId: string;
  timestamp: number;
}

export interface FileDeleteOperation {
  type: 'delete';
  path: string;
  participantId: string;
  timestamp: number;
}

export interface FileRenameOperation {
  type: 'rename';
  oldPath: string;
  newPath: string;
  participantId: string;
  timestamp: number;
}

// ============================================================================
// Undo/Redo
// ============================================================================

/**
 * Undo manager configuration.
 */
export interface UndoManagerConfig {
  /** Group edits within this timeout (ms) */
  captureTimeout: number;

  /** Origins to track */
  trackedOrigins: Set<string | null>;
}

/**
 * Undo/redo state.
 */
export interface UndoRedoState {
  /** Whether undo is available */
  canUndo: boolean;

  /** Whether redo is available */
  canRedo: boolean;

  /** Number of items in undo stack */
  undoStackSize: number;

  /** Number of items in redo stack */
  redoStackSize: number;
}

// ============================================================================
// Transaction Types
// ============================================================================

/** Transaction origin types */
export type TransactionOrigin =
  | 'local'
  | 'remote'
  | 'undo'
  | 'redo'
  | 'system'
  | string; // User ID for user-specific origins

/**
 * Transaction metadata.
 */
export interface TransactionMeta {
  /** Origin of transaction */
  origin: TransactionOrigin;

  /** Participant who made the change */
  participantId?: string;

  /** Description of the change */
  description?: string;

  /** Associated intent ID (for AI changes) */
  intentId?: string;
}

// ============================================================================
// Encoding/Decoding
// ============================================================================

/**
 * Encoded state for persistence.
 */
export interface EncodedState {
  /** State as base64 string */
  base64: string;

  /** Original byte length */
  byteLength: number;

  /** Compression used (if any) */
  compression?: 'gzip' | 'deflate' | 'none';
}

/**
 * State diff for incremental sync.
 */
export interface StateDiff {
  /** State vector of the sender */
  stateVector: Uint8Array;

  /** Diff to apply */
  diff: Uint8Array;

  /** Number of updates in diff */
  updateCount: number;
}
