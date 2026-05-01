/**
 * Layer 2 — Session memory.
 *
 * SQLite-backed persistence for one working session: every meaningful
 * event (messages, decisions, actions, intent lifecycle, manual notes)
 * is recorded as a SessionEntry. When the session ends, the caller can
 * store a SessionSummary for future retrieval.
 *
 * Uses better-sqlite3 (same as @pram1t/mustard-memory, same as
 * @pram1t/mustard-artifact). All operations are synchronous — SQLite is
 * local and fast.
 *
 * Schema ships with the class and is idempotent; a new SessionMemory
 * instance against an existing database is safe.
 */

import Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import type {
  SessionEntry,
  SessionEntryType,
  SessionSummary,
} from './types.js';

// ============================================================================
// Config
// ============================================================================

export interface SessionMemoryOptions {
  /**
   * Path to the SQLite database. `':memory:'` for tests (default).
   * Relative paths are resolved relative to the process cwd by
   * better-sqlite3.
   */
  dbPath?: string;

  /**
   * Pre-constructed database handle. If provided, the class does NOT
   * own it (no close() on destroy). Useful when multiple layers share
   * one connection.
   */
  db?: Database.Database;
}

export interface CreateSessionInput {
  roomId: string;
  /** Optional pre-allocated id; generated if omitted. */
  sessionId?: string;
  startedAt?: Date;
  /** Participant ids present at session start. */
  participants?: string[];
}

export interface EndSessionInput {
  sessionId: string;
  endedAt?: Date;
}

export interface AppendEntryInput {
  sessionId: string;
  roomId: string;
  type: SessionEntryType;
  content: string;
  participantId: string;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// SessionMemory
// ============================================================================

export class SessionMemory {
  private readonly db: Database.Database;
  private readonly ownsDb: boolean;

  constructor(options: SessionMemoryOptions = {}) {
    if (options.db) {
      this.db = options.db;
      this.ownsDb = false;
    } else {
      this.db = new Database(options.dbPath ?? ':memory:');
      this.db.pragma('journal_mode = WAL');
      this.db.pragma('foreign_keys = ON');
      this.ownsDb = true;
    }
    this.initSchema();
  }

  // --------------------------------------------------------------------------
  // Schema
  // --------------------------------------------------------------------------

  private initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS session_records (
        id TEXT PRIMARY KEY,
        room_id TEXT NOT NULL,
        started_at TEXT NOT NULL,
        ended_at TEXT,
        participants TEXT NOT NULL DEFAULT '[]'
      );

      CREATE INDEX IF NOT EXISTS idx_session_records_room
        ON session_records(room_id);
      CREATE INDEX IF NOT EXISTS idx_session_records_started
        ON session_records(started_at);

      CREATE TABLE IF NOT EXISTS session_entries (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL REFERENCES session_records(id) ON DELETE CASCADE,
        room_id TEXT NOT NULL,
        type TEXT NOT NULL,
        content TEXT NOT NULL,
        metadata TEXT NOT NULL DEFAULT '{}',
        participant_id TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_session_entries_session
        ON session_entries(session_id);
      CREATE INDEX IF NOT EXISTS idx_session_entries_room
        ON session_entries(room_id);
      CREATE INDEX IF NOT EXISTS idx_session_entries_type
        ON session_entries(type);
      CREATE INDEX IF NOT EXISTS idx_session_entries_created
        ON session_entries(created_at);

      CREATE TABLE IF NOT EXISTS session_summaries (
        session_id TEXT PRIMARY KEY REFERENCES session_records(id) ON DELETE CASCADE,
        room_id TEXT NOT NULL,
        summary TEXT NOT NULL,
        decisions TEXT NOT NULL DEFAULT '[]',
        files_modified TEXT NOT NULL DEFAULT '[]',
        participants TEXT NOT NULL DEFAULT '[]',
        started_at TEXT NOT NULL,
        ended_at TEXT NOT NULL,
        duration_seconds INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_session_summaries_room
        ON session_summaries(room_id);
    `);
  }

  // --------------------------------------------------------------------------
  // Session lifecycle
  // --------------------------------------------------------------------------

  createSession(input: CreateSessionInput): string {
    const id = input.sessionId ?? randomUUID();
    const startedAt = (input.startedAt ?? new Date()).toISOString();
    const participants = JSON.stringify(input.participants ?? []);

    this.db
      .prepare(
        'INSERT INTO session_records (id, room_id, started_at, ended_at, participants) VALUES (?, ?, ?, NULL, ?)',
      )
      .run(id, input.roomId, startedAt, participants);

    return id;
  }

  endSession(input: EndSessionInput): void {
    const endedAt = (input.endedAt ?? new Date()).toISOString();
    this.db
      .prepare('UPDATE session_records SET ended_at = ? WHERE id = ?')
      .run(endedAt, input.sessionId);
  }

  hasSession(sessionId: string): boolean {
    return Boolean(
      this.db
        .prepare('SELECT 1 FROM session_records WHERE id = ?')
        .get(sessionId),
    );
  }

  listSessions(filter?: { roomId?: string; limit?: number }): Array<{
    id: string;
    roomId: string;
    startedAt: Date;
    endedAt: Date | null;
    participants: string[];
  }> {
    const params: unknown[] = [];
    let sql = 'SELECT id, room_id, started_at, ended_at, participants FROM session_records';
    if (filter?.roomId) {
      sql += ' WHERE room_id = ?';
      params.push(filter.roomId);
    }
    sql += ' ORDER BY started_at DESC';
    if (filter?.limit && filter.limit > 0) {
      sql += ' LIMIT ?';
      params.push(filter.limit);
    }
    const rows = this.db.prepare(sql).all(...params) as Array<{
      id: string;
      room_id: string;
      started_at: string;
      ended_at: string | null;
      participants: string;
    }>;
    return rows.map(r => ({
      id: r.id,
      roomId: r.room_id,
      startedAt: new Date(r.started_at),
      endedAt: r.ended_at ? new Date(r.ended_at) : null,
      participants: safeParseStringArray(r.participants),
    }));
  }

  // --------------------------------------------------------------------------
  // Entries
  // --------------------------------------------------------------------------

  appendEntry(input: AppendEntryInput): SessionEntry {
    const id = randomUUID();
    const createdAt = new Date();
    const metadata = JSON.stringify(input.metadata ?? {});

    this.db
      .prepare(
        'INSERT INTO session_entries (id, session_id, room_id, type, content, metadata, participant_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      )
      .run(
        id,
        input.sessionId,
        input.roomId,
        input.type,
        input.content,
        metadata,
        input.participantId,
        createdAt.toISOString(),
      );

    return {
      id,
      sessionId: input.sessionId,
      roomId: input.roomId,
      type: input.type,
      content: input.content,
      metadata: input.metadata ?? {},
      participantId: input.participantId,
      createdAt,
    };
  }

  /** Convenience shortcuts matching the spec's addMessage/addDecision. */
  addMessage(sessionId: string, roomId: string, participantId: string, content: string): SessionEntry {
    return this.appendEntry({
      sessionId,
      roomId,
      type: 'message',
      content,
      participantId,
    });
  }

  addDecision(sessionId: string, roomId: string, participantId: string, content: string, context?: string): SessionEntry {
    return this.appendEntry({
      sessionId,
      roomId,
      type: 'decision',
      content,
      participantId,
      metadata: context ? { context } : undefined,
    });
  }

  addAction(sessionId: string, roomId: string, participantId: string, content: string, metadata?: Record<string, unknown>): SessionEntry {
    return this.appendEntry({
      sessionId,
      roomId,
      type: 'action',
      content,
      participantId,
      metadata,
    });
  }

  getEntry(id: string): SessionEntry | undefined {
    const row = this.db
      .prepare('SELECT * FROM session_entries WHERE id = ?')
      .get(id) as RawEntryRow | undefined;
    return row ? rowToEntry(row) : undefined;
  }

  getHistory(
    sessionId: string,
    filter?: { type?: SessionEntryType; limit?: number },
  ): SessionEntry[] {
    const params: unknown[] = [sessionId];
    let sql = 'SELECT * FROM session_entries WHERE session_id = ?';
    if (filter?.type) {
      sql += ' AND type = ?';
      params.push(filter.type);
    }
    sql += ' ORDER BY created_at ASC';
    if (filter?.limit && filter.limit > 0) {
      sql += ' LIMIT ?';
      params.push(filter.limit);
    }
    const rows = this.db.prepare(sql).all(...params) as RawEntryRow[];
    return rows.map(rowToEntry);
  }

  countEntries(sessionId: string): number {
    const row = this.db
      .prepare('SELECT COUNT(*) AS c FROM session_entries WHERE session_id = ?')
      .get(sessionId) as { c: number };
    return row.c;
  }

  // --------------------------------------------------------------------------
  // Summaries
  // --------------------------------------------------------------------------

  storeSummary(summary: SessionSummary): void {
    this.db
      .prepare(
        'INSERT INTO session_summaries (session_id, room_id, summary, decisions, files_modified, participants, started_at, ended_at, duration_seconds) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)\n' +
          '  ON CONFLICT(session_id) DO UPDATE SET summary = excluded.summary, decisions = excluded.decisions, files_modified = excluded.files_modified, participants = excluded.participants, ended_at = excluded.ended_at, duration_seconds = excluded.duration_seconds',
      )
      .run(
        summary.sessionId,
        summary.roomId,
        summary.summary,
        JSON.stringify(summary.decisions),
        JSON.stringify(summary.filesModified),
        JSON.stringify(summary.participants),
        summary.startedAt.toISOString(),
        summary.endedAt.toISOString(),
        summary.durationSeconds,
      );
  }

  getSummary(sessionId: string): SessionSummary | undefined {
    const row = this.db
      .prepare('SELECT * FROM session_summaries WHERE session_id = ?')
      .get(sessionId) as RawSummaryRow | undefined;
    return row ? rowToSummary(row) : undefined;
  }

  listSummaries(roomId: string, limit = 20): SessionSummary[] {
    const rows = this.db
      .prepare(
        'SELECT * FROM session_summaries WHERE room_id = ? ORDER BY ended_at DESC LIMIT ?',
      )
      .all(roomId, limit) as RawSummaryRow[];
    return rows.map(rowToSummary);
  }

  // --------------------------------------------------------------------------
  // Lifecycle
  // --------------------------------------------------------------------------

  /** Delete a session and all its entries + summary (CASCADE). */
  deleteSession(sessionId: string): void {
    this.db.prepare('DELETE FROM session_records WHERE id = ?').run(sessionId);
  }

  /** Close the database connection if we own it. */
  close(): void {
    if (this.ownsDb) {
      this.db.close();
    }
  }
}

// ============================================================================
// Row helpers
// ============================================================================

interface RawEntryRow {
  id: string;
  session_id: string;
  room_id: string;
  type: string;
  content: string;
  metadata: string;
  participant_id: string;
  created_at: string;
}

interface RawSummaryRow {
  session_id: string;
  room_id: string;
  summary: string;
  decisions: string;
  files_modified: string;
  participants: string;
  started_at: string;
  ended_at: string;
  duration_seconds: number;
}

function rowToEntry(row: RawEntryRow): SessionEntry {
  return {
    id: row.id,
    sessionId: row.session_id,
    roomId: row.room_id,
    type: row.type as SessionEntryType,
    content: row.content,
    metadata: safeParseObject(row.metadata),
    participantId: row.participant_id,
    createdAt: new Date(row.created_at),
  };
}

function rowToSummary(row: RawSummaryRow): SessionSummary {
  return {
    sessionId: row.session_id,
    roomId: row.room_id,
    summary: row.summary,
    decisions: safeParseStringArray(row.decisions),
    filesModified: safeParseStringArray(row.files_modified),
    participants: safeParseStringArray(row.participants),
    startedAt: new Date(row.started_at),
    endedAt: new Date(row.ended_at),
    durationSeconds: row.duration_seconds,
  };
}

function safeParseObject(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function safeParseStringArray(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(x => typeof x === 'string') : [];
  } catch {
    return [];
  }
}
