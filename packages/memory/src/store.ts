/**
 * OpenAgent V2 - Memory Store
 *
 * SQLite-backed persistent memory with FTS5 full-text search.
 * Uses better-sqlite3 for synchronous, fast operations.
 */

import { randomUUID } from 'node:crypto';
import Database from 'better-sqlite3';
import type { MemoryEntry, MemoryInput, MemoryQuery, SearchResult, IMemoryStore } from './types.js';

/**
 * SQLite + FTS5 memory store implementation.
 */
export class MemoryStore implements IMemoryStore {
  private db: Database.Database;

  /**
   * @param dbPath - Path to SQLite database file, or ":memory:" for in-memory (default for tests)
   */
  constructor(dbPath: string = ':memory:') {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.initialize();
  }

  /**
   * Create tables and FTS5 virtual table.
   */
  private initialize(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS memories (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL CHECK(type IN ('decision', 'pattern', 'convention', 'failure')),
        worker_id TEXT NOT NULL,
        project_id TEXT NOT NULL,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        tags TEXT NOT NULL DEFAULT '[]',
        metadata TEXT,
        access_count INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        last_accessed TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_memories_type ON memories(type);
      CREATE INDEX IF NOT EXISTS idx_memories_worker ON memories(worker_id);
      CREATE INDEX IF NOT EXISTS idx_memories_project ON memories(project_id);
      CREATE INDEX IF NOT EXISTS idx_memories_created ON memories(created_at);

      CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
        title,
        content,
        tags,
        content=memories,
        content_rowid=rowid
      );

      -- Triggers to keep FTS in sync
      CREATE TRIGGER IF NOT EXISTS memories_ai AFTER INSERT ON memories BEGIN
        INSERT INTO memories_fts(rowid, title, content, tags)
        VALUES (new.rowid, new.title, new.content, new.tags);
      END;

      CREATE TRIGGER IF NOT EXISTS memories_ad AFTER DELETE ON memories BEGIN
        INSERT INTO memories_fts(memories_fts, rowid, title, content, tags)
        VALUES ('delete', old.rowid, old.title, old.content, old.tags);
      END;

      CREATE TRIGGER IF NOT EXISTS memories_au AFTER UPDATE ON memories BEGIN
        INSERT INTO memories_fts(memories_fts, rowid, title, content, tags)
        VALUES ('delete', old.rowid, old.title, old.content, old.tags);
        INSERT INTO memories_fts(rowid, title, content, tags)
        VALUES (new.rowid, new.title, new.content, new.tags);
      END;
    `);
  }

  /**
   * Store a new memory entry.
   */
  store(input: MemoryInput): MemoryEntry {
    const id = randomUUID();
    const now = new Date();
    const tags = JSON.stringify(input.tags ?? []);
    const metadata = input.metadata ? JSON.stringify(input.metadata) : null;

    this.db.prepare(`
      INSERT INTO memories (id, type, worker_id, project_id, title, content, tags, metadata, access_count, created_at, last_accessed)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
    `).run(id, input.type, input.workerId, input.projectId, input.title, input.content, tags, metadata, now.toISOString(), now.toISOString());

    return this.rowToEntry({
      id,
      type: input.type,
      worker_id: input.workerId,
      project_id: input.projectId,
      title: input.title,
      content: input.content,
      tags,
      metadata,
      access_count: 0,
      created_at: now.toISOString(),
      last_accessed: now.toISOString(),
    });
  }

  /**
   * Get a memory by ID. Increments access count.
   */
  get(id: string): MemoryEntry | null {
    const row = this.db.prepare('SELECT * FROM memories WHERE id = ?').get(id) as any;
    if (!row) return null;

    // Update access count and last_accessed
    const now = new Date();
    this.db.prepare('UPDATE memories SET access_count = access_count + 1, last_accessed = ? WHERE id = ?')
      .run(now.toISOString(), id);

    return this.rowToEntry({ ...row, access_count: row.access_count + 1, last_accessed: now.toISOString() });
  }

  /**
   * Query memories with filters.
   */
  query(opts: MemoryQuery): MemoryEntry[] {
    const conditions: string[] = [];
    const params: any[] = [];

    if (opts.type) {
      conditions.push('type = ?');
      params.push(opts.type);
    }

    if (opts.workerId) {
      conditions.push('worker_id = ?');
      params.push(opts.workerId);
    }

    if (opts.projectId) {
      conditions.push('project_id = ?');
      params.push(opts.projectId);
    }

    if (opts.tags && opts.tags.length > 0) {
      // Match any tag
      const tagConditions = opts.tags.map(() => "tags LIKE ?");
      conditions.push(`(${tagConditions.join(' OR ')})`);
      for (const tag of opts.tags) {
        params.push(`%"${tag}"%`);
      }
    }

    let sql = 'SELECT * FROM memories';
    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    // Order
    const orderCol = opts.orderBy === 'lastAccessed'
      ? 'last_accessed'
      : opts.orderBy === 'accessCount'
        ? 'access_count'
        : 'created_at';
    const orderDir = opts.order === 'asc' ? 'ASC' : 'DESC';
    sql += ` ORDER BY ${orderCol} ${orderDir}`;

    // Limit
    if (opts.limit) {
      sql += ' LIMIT ?';
      params.push(opts.limit);
    }

    const rows = this.db.prepare(sql).all(...params) as any[];
    return rows.map((row) => this.rowToEntry(row));
  }

  /**
   * Full-text search across titles and content.
   */
  search(text: string, limit: number = 10): SearchResult[] {
    if (!text.trim()) return [];

    const rows = this.db.prepare(`
      SELECT m.*, fts.rank
      FROM memories_fts fts
      JOIN memories m ON m.rowid = fts.rowid
      WHERE memories_fts MATCH ?
      ORDER BY fts.rank
      LIMIT ?
    `).all(text, limit) as any[];

    return rows.map((row) => ({
      entry: this.rowToEntry(row),
      score: Math.abs(row.rank ?? 0), // FTS5 rank is negative (lower = better), convert to positive
    }));
  }

  /**
   * Update an existing memory entry.
   */
  update(id: string, updates: Partial<MemoryInput>): MemoryEntry | null {
    const existing = this.db.prepare('SELECT * FROM memories WHERE id = ?').get(id) as any;
    if (!existing) return null;

    const sets: string[] = [];
    const params: any[] = [];

    if (updates.type !== undefined) {
      sets.push('type = ?');
      params.push(updates.type);
    }
    if (updates.title !== undefined) {
      sets.push('title = ?');
      params.push(updates.title);
    }
    if (updates.content !== undefined) {
      sets.push('content = ?');
      params.push(updates.content);
    }
    if (updates.tags !== undefined) {
      sets.push('tags = ?');
      params.push(JSON.stringify(updates.tags));
    }
    if (updates.metadata !== undefined) {
      sets.push('metadata = ?');
      params.push(JSON.stringify(updates.metadata));
    }

    if (sets.length === 0) return this.rowToEntry(existing);

    params.push(id);
    this.db.prepare(`UPDATE memories SET ${sets.join(', ')} WHERE id = ?`).run(...params);

    const updated = this.db.prepare('SELECT * FROM memories WHERE id = ?').get(id) as any;
    return this.rowToEntry(updated);
  }

  /**
   * Delete a memory entry.
   */
  delete(id: string): boolean {
    const result = this.db.prepare('DELETE FROM memories WHERE id = ?').run(id);
    return result.changes > 0;
  }

  /**
   * Get count of memories, optionally filtered by project.
   */
  count(projectId?: string): number {
    if (projectId) {
      const row = this.db.prepare('SELECT COUNT(*) as cnt FROM memories WHERE project_id = ?').get(projectId) as any;
      return row.cnt;
    }
    const row = this.db.prepare('SELECT COUNT(*) as cnt FROM memories').get() as any;
    return row.cnt;
  }

  /**
   * Close the database connection.
   */
  close(): void {
    this.db.close();
  }

  // ===========================================================================
  // PRIVATE HELPERS
  // ===========================================================================

  private rowToEntry(row: any): MemoryEntry {
    return {
      id: row.id,
      type: row.type,
      workerId: row.worker_id,
      projectId: row.project_id,
      title: row.title,
      content: row.content,
      tags: JSON.parse(row.tags || '[]'),
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      accessCount: row.access_count,
      createdAt: new Date(row.created_at),
      lastAccessed: new Date(row.last_accessed),
    };
  }
}
