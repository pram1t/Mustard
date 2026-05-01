/**
 * OpenAgent V2 - SQLite Artifact Store
 *
 * Persistent artifact storage backed by SQLite.
 * Follows the same pattern as @mustard/memory's MemoryStore.
 */

import { randomUUID } from 'node:crypto';
import Database from 'better-sqlite3';
import type {
  Artifact,
  ArtifactCreateInput,
  ArtifactStatus,
  ArtifactType,
  ArtifactVersion,
  IArtifactStore,
} from './types.js';

/**
 * SQLite-backed artifact store with versioning support.
 */
export class SqliteArtifactStore implements IArtifactStore {
  private db: Database.Database;

  /**
   * @param dbPath - Path to SQLite database file, or ":memory:" for in-memory
   */
  constructor(dbPath: string = ':memory:') {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.initialize();
  }

  private initialize(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS artifacts (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'draft',
        created_by TEXT NOT NULL,
        project_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_artifacts_project ON artifacts(project_id);
      CREATE INDEX IF NOT EXISTS idx_artifacts_type ON artifacts(type);
      CREATE INDEX IF NOT EXISTS idx_artifacts_status ON artifacts(status);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_artifacts_name_project ON artifacts(name, project_id);

      CREATE TABLE IF NOT EXISTS artifact_versions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        artifact_id TEXT NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,
        version INTEGER NOT NULL,
        content TEXT NOT NULL,
        created_by TEXT NOT NULL,
        summary TEXT,
        created_at TEXT NOT NULL,
        UNIQUE(artifact_id, version)
      );

      CREATE INDEX IF NOT EXISTS idx_versions_artifact ON artifact_versions(artifact_id);
    `);
  }

  create(input: ArtifactCreateInput): Artifact {
    const id = randomUUID();
    const now = new Date();
    const nowISO = now.toISOString();

    const insertArtifact = this.db.prepare(`
      INSERT INTO artifacts (id, name, type, status, created_by, project_id, created_at, updated_at)
      VALUES (?, ?, ?, 'draft', ?, ?, ?, ?)
    `);

    const insertVersion = this.db.prepare(`
      INSERT INTO artifact_versions (artifact_id, version, content, created_by, summary, created_at)
      VALUES (?, 1, ?, ?, ?, ?)
    `);

    const txn = this.db.transaction(() => {
      insertArtifact.run(id, input.name, input.type, input.createdBy, input.projectId, nowISO, nowISO);
      insertVersion.run(id, JSON.stringify(input.content), input.createdBy, input.summary ?? null, nowISO);
    });

    txn();

    return {
      id,
      name: input.name,
      type: input.type,
      status: 'draft',
      createdBy: input.createdBy,
      projectId: input.projectId,
      versions: [{
        version: 1,
        content: input.content,
        createdBy: input.createdBy,
        summary: input.summary,
        createdAt: now,
      }],
      createdAt: now,
      updatedAt: now,
    };
  }

  get(id: string): Artifact | undefined {
    const row = this.db.prepare('SELECT * FROM artifacts WHERE id = ?').get(id) as any;
    if (!row) return undefined;
    return this.rowToArtifact(row);
  }

  getByName(name: string, projectId: string): Artifact | undefined {
    const row = this.db.prepare(
      'SELECT * FROM artifacts WHERE name = ? AND project_id = ?'
    ).get(name, projectId) as any;
    if (!row) return undefined;
    return this.rowToArtifact(row);
  }

  addVersion(id: string, content: unknown, createdBy: string, summary?: string): ArtifactVersion {
    const row = this.db.prepare('SELECT * FROM artifacts WHERE id = ?').get(id) as any;
    if (!row) {
      throw new Error(`Artifact not found: ${id}`);
    }

    const maxVersion = this.db.prepare(
      'SELECT MAX(version) as max_ver FROM artifact_versions WHERE artifact_id = ?'
    ).get(id) as any;
    const nextVersion = (maxVersion?.max_ver ?? 0) + 1;
    const now = new Date();
    const nowISO = now.toISOString();

    const txn = this.db.transaction(() => {
      this.db.prepare(`
        INSERT INTO artifact_versions (artifact_id, version, content, created_by, summary, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(id, nextVersion, JSON.stringify(content), createdBy, summary ?? null, nowISO);

      this.db.prepare('UPDATE artifacts SET updated_at = ? WHERE id = ?').run(nowISO, id);
    });

    txn();

    return {
      version: nextVersion,
      content,
      createdBy,
      summary,
      createdAt: now,
    };
  }

  updateStatus(id: string, status: ArtifactStatus): Artifact | undefined {
    const row = this.db.prepare('SELECT * FROM artifacts WHERE id = ?').get(id) as any;
    if (!row) return undefined;

    const nowISO = new Date().toISOString();
    this.db.prepare('UPDATE artifacts SET status = ?, updated_at = ? WHERE id = ?').run(status, nowISO, id);

    return this.rowToArtifact({ ...row, status, updated_at: nowISO });
  }

  list(projectId: string, type?: ArtifactType): Artifact[] {
    let sql = 'SELECT * FROM artifacts WHERE project_id = ?';
    const params: any[] = [projectId];

    if (type) {
      sql += ' AND type = ?';
      params.push(type);
    }

    sql += ' ORDER BY updated_at DESC';

    const rows = this.db.prepare(sql).all(...params) as any[];
    return rows.map((row) => this.rowToArtifact(row));
  }

  delete(id: string): boolean {
    const result = this.db.prepare('DELETE FROM artifacts WHERE id = ?').run(id);
    return result.changes > 0;
  }

  count(projectId?: string): number {
    if (projectId) {
      const row = this.db.prepare('SELECT COUNT(*) as cnt FROM artifacts WHERE project_id = ?').get(projectId) as any;
      return row.cnt;
    }
    const row = this.db.prepare('SELECT COUNT(*) as cnt FROM artifacts').get() as any;
    return row.cnt;
  }

  close(): void {
    this.db.close();
  }

  // ===========================================================================
  // PRIVATE HELPERS
  // ===========================================================================

  private rowToArtifact(row: any): Artifact {
    const versionRows = this.db.prepare(
      'SELECT * FROM artifact_versions WHERE artifact_id = ? ORDER BY version ASC'
    ).all(row.id) as any[];

    const versions: ArtifactVersion[] = versionRows.map((v) => ({
      version: v.version,
      content: JSON.parse(v.content),
      createdBy: v.created_by,
      summary: v.summary ?? undefined,
      createdAt: new Date(v.created_at),
    }));

    return {
      id: row.id,
      name: row.name,
      type: row.type as ArtifactType,
      status: row.status as ArtifactStatus,
      createdBy: row.created_by,
      projectId: row.project_id,
      versions,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }
}
