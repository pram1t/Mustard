/**
 * @mustard/collab-sync
 *
 * Yjs CRDT document and WebSocket sync provider for OpenAgent Collab.
 */

// ── Types ───────────────────────────────────────────────────────────────────
export type {
  // Document structure
  RoomDocument,
  FileMeta,
  TreeNode,
  ChatMessage,
  ChatMessageType,
  SoftLock,

  // Sync provider
  WebSocketProviderConfig,
  SyncStatus,

  // Sync operations
  DocumentUpdate,
  Checkpoint,
  SyncConflict,

  // File operations
  FileOperation,
  FileCreateOperation,
  FileEditOperation,
  FileDeleteOperation,
  FileRenameOperation,

  // Undo/redo
  UndoManagerConfig,
  UndoRedoState,

  // Transactions
  TransactionOrigin,
  TransactionMeta,

  // Encoding
  EncodedState,
  StateDiff,
} from './types.js';

// ── Document ────────────────────────────────────────────────────────────────
export {
  DOC_KEYS,
  createRoomDocument,
  getFiles,
  getFileMeta,
  getTree,
  getChat,
  getClaims,
  getSoftLocks,
  getFileContent,
  setFileContent,
  hasFile,
  listFiles,
  encodeDocumentState,
  applyDocumentUpdate,
  syncDocuments,
} from './document.js';

// ── WebSocket Provider ──────────────────────────────────────────────────────
export { CollabWSProvider } from './ws-provider.js';
export type { WSProviderEvents, Unsubscribe } from './ws-provider.js';

// ── File Operations ─────────────────────────────────────────────────────────
export {
  createFile,
  deleteFile,
  renameFile,
  getFileText,
  insertText,
  deleteText,
  replaceText,
  buildNestedTree,
} from './file-ops.js';

// ── Undo/Redo ───────────────────────────────────────────────────────────────
export { CollabUndoManager } from './undo-manager.js';
