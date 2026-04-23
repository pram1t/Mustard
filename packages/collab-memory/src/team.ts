/**
 * Layer 4 — Team memory (V1 stub).
 *
 * Organization-wide shared knowledge: team conventions, templates,
 * cross-project learnings. The V1 scope ships basic CRUD scoped to a
 * teamId. Cross-project propagation, aggregation, and sync-to-cloud
 * are deferred to Super-V2 δ-14 (team-memory-sync).
 *
 * Same SQLite connection pattern as SessionMemory / ProjectMemory.
 */

import Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import type { TeamEntry } from './types.js';

// ============================================================================
// Config
// ============================================================================

export interface TeamMemoryOptions {
  dbPath?: string;
  db?: Database.Database;
}

export interface AddTeamEntryInput {
  teamId: string;
  category: string;
  content: string;
  createdBy: string;
}

export interface UpdateTeamEntryInput {
  category?: string;
  content?: string;
}

export interface ListTeamEntriesFilter {
  teamId?: string;
  category?: string;
  limit?: number;
}

// ============================================================================
// TeamMemory
// ============================================================================

export class TeamMemory {
  private readonly db: Database.Database;
  private readonly ownsDb: boolean;

  constructor(options: TeamMemoryOptions = {}) {
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

  private initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS team_entries (
        id TEXT PRIMARY KEY,
        team_id TEXT NOT NULL,
        category TEXT NOT NULL,
        content TEXT NOT NULL,
        created_by TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_team_entries_team
        ON team_entries(team_id);
      CREATE INDEX IF NOT EXISTS idx_team_entries_category
        ON team_entries(category);
      CREATE INDEX IF NOT EXISTS idx_team_entries_updated
        ON team_entries(updated_at);
    `);
  }

  // --------------------------------------------------------------------------
  // CRUD
  // --------------------------------------------------------------------------

  add(input: AddTeamEntryInput): TeamEntry {
    const id = randomUUID();
    const now = new Date();
    this.db
      .prepare(
        'INSERT INTO team_entries (id, team_id, category, content, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      )
      .run(
        id,
        input.teamId,
        input.category,
        input.content,
        input.createdBy,
        now.toISOString(),
        now.toISOString(),
      );
    return {
      id,
      teamId: input.teamId,
      category: input.category,
      content: input.content,
      createdBy: input.createdBy,
      createdAt: now,
      updatedAt: now,
    };
  }

  get(id: string): TeamEntry | undefined {
    const row = this.db
      .prepare('SELECT * FROM team_entries WHERE id = ?')
      .get(id) as RawRow | undefined;
    return row ? rowToEntry(row) : undefined;
  }

  update(id: string, patch: UpdateTeamEntryInput): TeamEntry | undefined {
    const current = this.get(id);
    if (!current) return undefined;
    const next: TeamEntry = {
      ...current,
      category: patch.category ?? current.category,
      content: patch.content ?? current.content,
      updatedAt: new Date(),
    };
    this.db
      .prepare(
        'UPDATE team_entries SET category = ?, content = ?, updated_at = ? WHERE id = ?',
      )
      .run(next.category, next.content, next.updatedAt.toISOString(), id);
    return next;
  }

  remove(id: string): boolean {
    const result = this.db
      .prepare('DELETE FROM team_entries WHERE id = ?')
      .run(id);
    return result.changes > 0;
  }

  list(filter?: ListTeamEntriesFilter): TeamEntry[] {
    const parts: string[] = [];
    const params: unknown[] = [];
    if (filter?.teamId) {
      parts.push('team_id = ?');
      params.push(filter.teamId);
    }
    if (filter?.category) {
      parts.push('category = ?');
      params.push(filter.category);
    }
    let sql = 'SELECT * FROM team_entries';
    if (parts.length) sql += ' WHERE ' + parts.join(' AND ');
    sql += ' ORDER BY updated_at DESC';
    if (filter?.limit && filter.limit > 0) {
      sql += ' LIMIT ?';
      params.push(filter.limit);
    }
    const rows = this.db.prepare(sql).all(...params) as RawRow[];
    return rows.map(rowToEntry);
  }

  /** Convenience — `list({ teamId, category: 'convention' })`. */
  getConventions(teamId: string, limit?: number): TeamEntry[] {
    return this.list({ teamId, category: 'convention', limit });
  }

  /** Convenience — `list({ teamId, category: 'template' })`. */
  getTemplates(teamId: string, limit?: number): TeamEntry[] {
    return this.list({ teamId, category: 'template', limit });
  }

  close(): void {
    if (this.ownsDb) this.db.close();
  }
}

// ============================================================================
// Helpers
// ============================================================================

interface RawRow {
  id: string;
  team_id: string;
  category: string;
  content: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

function rowToEntry(row: RawRow): TeamEntry {
  return {
    id: row.id,
    teamId: row.team_id,
    category: row.category,
    content: row.content,
    createdBy: row.created_by,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}
