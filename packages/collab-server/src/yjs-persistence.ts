/**
 * SQLite-backed Yjs persistence for the collab server.
 *
 * Implements the contract y-websocket's `setPersistence()` expects:
 *   bindState(docName, ydoc): load saved state into ydoc, subscribe to
 *                             updates and persist them
 *   writeState(docName, ydoc): final flush on shutdown
 *   provider: handle for advanced uses (rarely needed)
 *
 * Strategy: store the FULL encoded Y.Doc state per docName, replacing
 * on each persistence flush. Updates are debounced so we don't write
 * on every keystroke. Survives server restart by reloading the state
 * blob on bindState.
 */

import Database from 'better-sqlite3';
import * as Y from 'yjs';

// ============================================================================
// Persistence type matching y-websocket's expected shape
// ============================================================================

export interface YjsPersistence {
  bindState: (docName: string, ydoc: Y.Doc) => void | Promise<void>;
  writeState: (docName: string, ydoc: Y.Doc) => Promise<void>;
  provider: SqliteYjsPersistence;
}

// ============================================================================
// SqliteYjsPersistence
// ============================================================================

export interface SqliteYjsPersistenceOptions {
  /** ':memory:' or a file path. Default ':memory:'. */
  dbPath?: string;
  /** Pre-constructed db handle (shared). If supplied, we don't own it. */
  db?: Database.Database;
  /**
   * Debounce window for writes after each Y.Doc update, in ms.
   * Default 250 — balances write amplification vs durability.
   */
  flushDebounceMs?: number;
}

interface DocEntry {
  ydoc: Y.Doc;
  unsub: () => void;
  flushTimer: ReturnType<typeof setTimeout> | null;
}

export class SqliteYjsPersistence {
  private readonly db: Database.Database;
  private readonly ownsDb: boolean;
  private readonly flushDebounceMs: number;
  private readonly bound = new Map<string, DocEntry>();

  constructor(options: SqliteYjsPersistenceOptions = {}) {
    if (options.db) {
      this.db = options.db;
      this.ownsDb = false;
    } else {
      this.db = new Database(options.dbPath ?? ':memory:');
      this.db.pragma('journal_mode = WAL');
      this.db.pragma('foreign_keys = ON');
      this.ownsDb = true;
    }
    this.flushDebounceMs = options.flushDebounceMs ?? 250;
    this.initSchema();
  }

  private initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS yjs_docs (
        name TEXT PRIMARY KEY,
        state BLOB NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);
  }

  // --------------------------------------------------------------------------
  // y-websocket persistence interface
  // --------------------------------------------------------------------------

  /**
   * Hook a Y.Doc into persistence:
   * - Load any prior state from storage and apply it to the ydoc
   * - Subscribe to ydoc updates; persist them (debounced) as full
   *   state snapshots keyed by docName
   *
   * Idempotent on the same (docName, ydoc) pair — re-binding replaces
   * the previous subscription.
   */
  bindState(docName: string, ydoc: Y.Doc): void {
    // Tear down a prior binding for this name, if any.
    this.detach(docName);

    const existing = this.loadStateBytes(docName);
    if (existing) {
      Y.applyUpdate(ydoc, existing);
    }

    const handler = (_update: Uint8Array, _origin: unknown) => {
      this.scheduleFlush(docName, ydoc);
    };
    ydoc.on('update', handler);

    this.bound.set(docName, {
      ydoc,
      unsub: () => ydoc.off('update', handler),
      flushTimer: null,
    });
  }

  /**
   * Final flush — called when y-websocket is tearing down a doc
   * (e.g. last connection closed, with delete-after-disconnect logic).
   */
  async writeState(docName: string, ydoc: Y.Doc): Promise<void> {
    this.flushNow(docName, ydoc);
    this.detach(docName);
  }

  // --------------------------------------------------------------------------
  // Direct API (useful for tests + internal callers)
  // --------------------------------------------------------------------------

  /** Load the latest persisted snapshot bytes for docName, or null. */
  loadStateBytes(docName: string): Uint8Array | null {
    const row = this.db
      .prepare('SELECT state FROM yjs_docs WHERE name = ?')
      .get(docName) as { state: Buffer } | undefined;
    if (!row) return null;
    return new Uint8Array(row.state);
  }

  /** Whether a snapshot exists for docName. */
  has(docName: string): boolean {
    return Boolean(
      this.db.prepare('SELECT 1 FROM yjs_docs WHERE name = ?').get(docName),
    );
  }

  /** List all stored docnames. */
  list(): string[] {
    const rows = this.db
      .prepare('SELECT name FROM yjs_docs ORDER BY updated_at DESC')
      .all() as Array<{ name: string }>;
    return rows.map(r => r.name);
  }

  /** Delete a stored snapshot. Returns true if a row was removed. */
  remove(docName: string): boolean {
    const r = this.db.prepare('DELETE FROM yjs_docs WHERE name = ?').run(docName);
    return r.changes > 0;
  }

  /**
   * Force-flush a Y.Doc to storage immediately (no debounce). Useful
   * when the caller knows it's about to disconnect.
   */
  flushNow(docName: string, ydoc: Y.Doc): void {
    const state = Y.encodeStateAsUpdate(ydoc);
    const buf = Buffer.from(state.buffer, state.byteOffset, state.byteLength);
    const now = new Date().toISOString();
    this.db
      .prepare(
        'INSERT INTO yjs_docs (name, state, updated_at) VALUES (?, ?, ?) ' +
          'ON CONFLICT(name) DO UPDATE SET state = excluded.state, updated_at = excluded.updated_at',
      )
      .run(docName, buf, now);
  }

  /**
   * Tear down the bound listener + cancel any pending flush. The
   * snapshot is NOT removed from storage — call remove() for that.
   */
  detach(docName: string): void {
    const entry = this.bound.get(docName);
    if (!entry) return;
    if (entry.flushTimer) {
      clearTimeout(entry.flushTimer);
    }
    try {
      entry.unsub();
    } catch {
      /* ignore */
    }
    this.bound.delete(docName);
  }

  /** Tear down everything; close the db if owned. */
  destroy(): void {
    for (const name of Array.from(this.bound.keys())) this.detach(name);
    if (this.ownsDb) {
      try {
        this.db.close();
      } catch {
        /* ignore */
      }
    }
  }

  // --------------------------------------------------------------------------
  // Internals
  // --------------------------------------------------------------------------

  private scheduleFlush(docName: string, ydoc: Y.Doc): void {
    const entry = this.bound.get(docName);
    if (!entry) return;
    if (entry.flushTimer) clearTimeout(entry.flushTimer);
    entry.flushTimer = setTimeout(() => {
      entry.flushTimer = null;
      this.flushNow(docName, ydoc);
    }, this.flushDebounceMs);
  }
}

// ============================================================================
// Convenience factory matching y-websocket's persistence shape
// ============================================================================

export function createYjsPersistence(
  options: SqliteYjsPersistenceOptions = {},
): YjsPersistence {
  const provider = new SqliteYjsPersistence(options);
  return {
    provider,
    bindState: (docName, ydoc) => provider.bindState(docName, ydoc),
    writeState: (docName, ydoc) => provider.writeState(docName, ydoc),
  };
}
