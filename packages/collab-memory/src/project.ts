/**
 * Layer 3 — Project memory.
 *
 * Long-term knowledge about a project: architecture decisions,
 * conventions, recurring patterns, domain facts, pending todos.
 * SQLite-backed with an FTS5 virtual table for full-text search.
 *
 * Entries are keyed by roomId (each room maps to one project, for V1)
 * and categorized. Content is indexed for search alongside title +
 * tags. Same connection-sharing pattern as SessionMemory.
 */

import Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import type { ProjectCategory, ProjectEntry } from './types.js';

// ============================================================================
// Config
// ============================================================================

export interface ProjectMemoryOptions {
  dbPath?: string;
  db?: Database.Database;
}

export interface AddProjectEntryInput {
  roomId: string;
  category: ProjectCategory;
  title: string;
  content: string;
  createdBy: string;
  tags?: string[];
}

export interface UpdateProjectEntryInput {
  title?: string;
  content?: string;
  tags?: string[];
  category?: ProjectCategory;
}

export interface ProjectSearchOptions {
  roomId?: string;
  category?: ProjectCategory;
  limit?: number;
}

export interface ProjectSearchHit {
  entry: ProjectEntry;
  snippet: string;
  score: number;
}

// ============================================================================
// ProjectMemory
// ============================================================================

export class ProjectMemory {
  private readonly db: Database.Database;
  private readonly ownsDb: boolean;

  constructor(options: ProjectMemoryOptions = {}) {
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
      CREATE TABLE IF NOT EXISTS project_entries (
        id TEXT PRIMARY KEY,
        room_id TEXT NOT NULL,
        category TEXT NOT NULL,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        tags TEXT NOT NULL DEFAULT '[]',
        created_by TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_project_entries_room
        ON project_entries(room_id);
      CREATE INDEX IF NOT EXISTS idx_project_entries_category
        ON project_entries(category);
      CREATE INDEX IF NOT EXISTS idx_project_entries_updated
        ON project_entries(updated_at);

      CREATE VIRTUAL TABLE IF NOT EXISTS project_entries_fts USING fts5(
        title,
        content,
        tags,
        content=project_entries,
        content_rowid=rowid
      );

      CREATE TRIGGER IF NOT EXISTS project_entries_ai
        AFTER INSERT ON project_entries BEGIN
          INSERT INTO project_entries_fts(rowid, title, content, tags)
          VALUES (new.rowid, new.title, new.content, new.tags);
        END;

      CREATE TRIGGER IF NOT EXISTS project_entries_ad
        AFTER DELETE ON project_entries BEGIN
          INSERT INTO project_entries_fts(project_entries_fts, rowid, title, content, tags)
          VALUES ('delete', old.rowid, old.title, old.content, old.tags);
        END;

      CREATE TRIGGER IF NOT EXISTS project_entries_au
        AFTER UPDATE ON project_entries BEGIN
          INSERT INTO project_entries_fts(project_entries_fts, rowid, title, content, tags)
          VALUES ('delete', old.rowid, old.title, old.content, old.tags);
          INSERT INTO project_entries_fts(rowid, title, content, tags)
          VALUES (new.rowid, new.title, new.content, new.tags);
        END;
    `);
  }

  // --------------------------------------------------------------------------
  // CRUD
  // --------------------------------------------------------------------------

  add(input: AddProjectEntryInput): ProjectEntry {
    const id = randomUUID();
    const now = new Date();
    const tags = input.tags ?? [];

    this.db
      .prepare(
        'INSERT INTO project_entries (id, room_id, category, title, content, tags, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      )
      .run(
        id,
        input.roomId,
        input.category,
        input.title,
        input.content,
        JSON.stringify(tags),
        input.createdBy,
        now.toISOString(),
        now.toISOString(),
      );

    return {
      id,
      roomId: input.roomId,
      category: input.category,
      title: input.title,
      content: input.content,
      tags,
      createdBy: input.createdBy,
      createdAt: now,
      updatedAt: now,
    };
  }

  /** Convenience: add an architecture decision. */
  addDecision(roomId: string, createdBy: string, title: string, content: string, tags?: string[]): ProjectEntry {
    return this.add({ roomId, createdBy, title, content, tags, category: 'decision' });
  }

  /** Convenience: add a convention. */
  addConvention(roomId: string, createdBy: string, title: string, content: string, tags?: string[]): ProjectEntry {
    return this.add({ roomId, createdBy, title, content, tags, category: 'convention' });
  }

  /** Convenience: add domain knowledge. */
  addKnowledge(roomId: string, createdBy: string, title: string, content: string, tags?: string[]): ProjectEntry {
    return this.add({ roomId, createdBy, title, content, tags, category: 'knowledge' });
  }

  get(id: string): ProjectEntry | undefined {
    const row = this.db
      .prepare('SELECT * FROM project_entries WHERE id = ?')
      .get(id) as RawRow | undefined;
    return row ? rowToEntry(row) : undefined;
  }

  update(id: string, patch: UpdateProjectEntryInput): ProjectEntry | undefined {
    const current = this.get(id);
    if (!current) return undefined;

    const next: ProjectEntry = {
      ...current,
      title: patch.title ?? current.title,
      content: patch.content ?? current.content,
      tags: patch.tags ?? current.tags,
      category: patch.category ?? current.category,
      updatedAt: new Date(),
    };

    this.db
      .prepare(
        'UPDATE project_entries SET title = ?, content = ?, tags = ?, category = ?, updated_at = ? WHERE id = ?',
      )
      .run(
        next.title,
        next.content,
        JSON.stringify(next.tags),
        next.category,
        next.updatedAt.toISOString(),
        id,
      );

    return next;
  }

  remove(id: string): boolean {
    const result = this.db
      .prepare('DELETE FROM project_entries WHERE id = ?')
      .run(id);
    return result.changes > 0;
  }

  // --------------------------------------------------------------------------
  // Listing + search
  // --------------------------------------------------------------------------

  list(filter?: ProjectSearchOptions): ProjectEntry[] {
    const parts: string[] = [];
    const params: unknown[] = [];
    if (filter?.roomId) {
      parts.push('room_id = ?');
      params.push(filter.roomId);
    }
    if (filter?.category) {
      parts.push('category = ?');
      params.push(filter.category);
    }
    let sql = 'SELECT * FROM project_entries';
    if (parts.length) sql += ' WHERE ' + parts.join(' AND ');
    sql += ' ORDER BY updated_at DESC';
    if (filter?.limit && filter.limit > 0) {
      sql += ' LIMIT ?';
      params.push(filter.limit);
    }
    const rows = this.db.prepare(sql).all(...params) as RawRow[];
    return rows.map(rowToEntry);
  }

  count(filter?: ProjectSearchOptions): number {
    const parts: string[] = [];
    const params: unknown[] = [];
    if (filter?.roomId) {
      parts.push('room_id = ?');
      params.push(filter.roomId);
    }
    if (filter?.category) {
      parts.push('category = ?');
      params.push(filter.category);
    }
    let sql = 'SELECT COUNT(*) AS c FROM project_entries';
    if (parts.length) sql += ' WHERE ' + parts.join(' AND ');
    const row = this.db.prepare(sql).get(...params) as { c: number };
    return row.c;
  }

  /**
   * Full-text search across title/content/tags. FTS5 MATCH syntax is
   * accepted; free-form queries are sanitized to avoid syntax errors
   * (wrap as a phrase if any special char is present).
   */
  search(query: string, options: ProjectSearchOptions = {}): ProjectSearchHit[] {
    const safeQuery = sanitizeFtsQuery(query);
    if (!safeQuery) return [];

    const params: unknown[] = [safeQuery];
    const whereParts: string[] = ['project_entries_fts MATCH ?'];

    if (options.roomId) {
      whereParts.push('pe.room_id = ?');
      params.push(options.roomId);
    }
    if (options.category) {
      whereParts.push('pe.category = ?');
      params.push(options.category);
    }

    // MATCH and snippet() must live in the same query so FTS5 can
    // associate each row with its match context and highlight the
    // matched terms. `-1` tells snippet() to pick the best-matching
    // column automatically.
    let sql =
      "SELECT pe.*, snippet(project_entries_fts, -1, '<mark>', '</mark>', '…', 15) AS snippet, bm25(project_entries_fts) AS score " +
      'FROM project_entries_fts ' +
      'JOIN project_entries pe ON pe.rowid = project_entries_fts.rowid ' +
      'WHERE ' +
      whereParts.join(' AND ') +
      ' ORDER BY score ASC'; // bm25: lower is better
    if (options.limit && options.limit > 0) {
      sql += ' LIMIT ?';
      params.push(options.limit);
    }

    // The FTS MATCH parameter needs to bind twice — once for the subquery,
    // not again. The construction above uses one `?` at the top; the rest
    // bind at the WHERE level. Re-ordering params for the subquery binding:
    const rows = this.db.prepare(sql).all(...params) as Array<
      RawRow & { snippet: string; score: number }
    >;

    return rows.map(r => ({
      entry: rowToEntry(r),
      snippet: r.snippet,
      score: r.score,
    }));
  }

  // --------------------------------------------------------------------------
  // Lifecycle
  // --------------------------------------------------------------------------

  close(): void {
    if (this.ownsDb) this.db.close();
  }
}

// ============================================================================
// Helpers
// ============================================================================

interface RawRow {
  id: string;
  room_id: string;
  category: string;
  title: string;
  content: string;
  tags: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

function rowToEntry(row: RawRow): ProjectEntry {
  return {
    id: row.id,
    roomId: row.room_id,
    category: row.category as ProjectCategory,
    title: row.title,
    content: row.content,
    tags: safeParseStringArray(row.tags),
    createdBy: row.created_by,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function safeParseStringArray(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(x => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

/**
 * Accept free-form search text. FTS5 MATCH treats many characters as
 * operators; to keep the API simple we:
 *   - Strip double-quotes (they'd unbalance a phrase)
 *   - If any FTS-special character remains, wrap the whole thing in a
 *     phrase so bare symbols don't crash the parser
 *   - Reject empty-after-trim queries (returns empty string)
 */
function sanitizeFtsQuery(raw: string): string {
  const cleaned = raw.replace(/"/g, '').trim();
  if (!cleaned) return '';
  // If the query contains any FTS operator-ish character, wrap as phrase.
  if (/[:+\-^*()]/.test(cleaned)) {
    return `"${cleaned}"`;
  }
  return cleaned;
}
