/**
 * OpenAgent V2 - SQLite Handoff Manager
 *
 * Persistent handoff state machine backed by SQLite.
 */

import { randomUUID } from 'node:crypto';
import Database from 'better-sqlite3';
import type { Handoff, HandoffStatus, IHandoffManager, ReviewFeedback } from './types.js';

/**
 * Valid state transitions for handoffs.
 */
const VALID_TRANSITIONS: Record<HandoffStatus, HandoffStatus[]> = {
  pending: ['accepted', 'rejected', 'changes_requested'],
  accepted: [],
  rejected: [],
  changes_requested: ['pending'],
};

/**
 * SQLite-backed handoff manager with state machine enforcement.
 */
export class SqliteHandoffManager implements IHandoffManager {
  private db: Database.Database;

  /**
   * @param db - A better-sqlite3 Database instance (share with SqliteArtifactStore)
   */
  constructor(db: Database.Database) {
    this.db = db;
    this.initialize();
  }

  private initialize(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS handoffs (
        id TEXT PRIMARY KEY,
        artifact_id TEXT NOT NULL,
        from_worker TEXT NOT NULL,
        to_worker TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        message TEXT,
        feedback TEXT,
        created_at TEXT NOT NULL,
        resolved_at TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_handoffs_artifact ON handoffs(artifact_id);
      CREATE INDEX IF NOT EXISTS idx_handoffs_from ON handoffs(from_worker);
      CREATE INDEX IF NOT EXISTS idx_handoffs_to ON handoffs(to_worker);
      CREATE INDEX IF NOT EXISTS idx_handoffs_status ON handoffs(status);
    `);
  }

  create(artifactId: string, fromWorker: string, toWorker: string, message?: string): Handoff {
    const id = randomUUID();
    const now = new Date();

    this.db.prepare(`
      INSERT INTO handoffs (id, artifact_id, from_worker, to_worker, status, message, created_at)
      VALUES (?, ?, ?, ?, 'pending', ?, ?)
    `).run(id, artifactId, fromWorker, toWorker, message ?? null, now.toISOString());

    return {
      id,
      artifactId,
      fromWorker,
      toWorker,
      status: 'pending',
      message,
      createdAt: now,
    };
  }

  get(id: string): Handoff | undefined {
    const row = this.db.prepare('SELECT * FROM handoffs WHERE id = ?').get(id) as any;
    if (!row) return undefined;
    return this.rowToHandoff(row);
  }

  accept(id: string): Handoff {
    return this.transition(id, 'accepted');
  }

  reject(id: string, feedback: ReviewFeedback): Handoff {
    const handoff = this.transition(id, 'rejected');
    this.db.prepare('UPDATE handoffs SET feedback = ? WHERE id = ?')
      .run(JSON.stringify(feedback), id);
    handoff.feedback = feedback;
    return handoff;
  }

  requestChanges(id: string, feedback: ReviewFeedback): Handoff {
    const handoff = this.transition(id, 'changes_requested');
    this.db.prepare('UPDATE handoffs SET feedback = ? WHERE id = ?')
      .run(JSON.stringify(feedback), id);
    handoff.feedback = feedback;
    return handoff;
  }

  resubmit(id: string, message?: string): Handoff {
    const handoff = this.transition(id, 'pending');
    this.db.prepare('UPDATE handoffs SET message = ?, feedback = NULL, resolved_at = NULL WHERE id = ?')
      .run(message ?? null, id);
    handoff.message = message;
    handoff.feedback = undefined;
    handoff.resolvedAt = undefined;
    return handoff;
  }

  getByArtifact(artifactId: string): Handoff[] {
    const rows = this.db.prepare('SELECT * FROM handoffs WHERE artifact_id = ?').all(artifactId) as any[];
    return rows.map((row) => this.rowToHandoff(row));
  }

  getByWorker(workerId: string, role: 'from' | 'to'): Handoff[] {
    const col = role === 'from' ? 'from_worker' : 'to_worker';
    const rows = this.db.prepare(`SELECT * FROM handoffs WHERE ${col} = ?`).all(workerId) as any[];
    return rows.map((row) => this.rowToHandoff(row));
  }

  getPending(): Handoff[] {
    const rows = this.db.prepare("SELECT * FROM handoffs WHERE status = 'pending'").all() as any[];
    return rows.map((row) => this.rowToHandoff(row));
  }

  // ===========================================================================
  // PRIVATE
  // ===========================================================================

  private transition(id: string, newStatus: HandoffStatus): Handoff {
    const row = this.db.prepare('SELECT * FROM handoffs WHERE id = ?').get(id) as any;
    if (!row) {
      throw new Error(`Handoff not found: ${id}`);
    }

    const currentStatus = row.status as HandoffStatus;
    const validNext = VALID_TRANSITIONS[currentStatus];
    if (!validNext.includes(newStatus)) {
      throw new Error(
        `Invalid handoff transition: ${currentStatus} → ${newStatus}. ` +
        `Valid transitions from "${currentStatus}": [${validNext.join(', ')}]`
      );
    }

    const resolvedAt = (newStatus === 'accepted' || newStatus === 'rejected')
      ? new Date().toISOString()
      : null;

    this.db.prepare('UPDATE handoffs SET status = ?, resolved_at = ? WHERE id = ?')
      .run(newStatus, resolvedAt, id);

    const handoff = this.rowToHandoff({ ...row, status: newStatus, resolved_at: resolvedAt });
    return handoff;
  }

  private rowToHandoff(row: any): Handoff {
    return {
      id: row.id,
      artifactId: row.artifact_id,
      fromWorker: row.from_worker,
      toWorker: row.to_worker,
      status: row.status as HandoffStatus,
      message: row.message ?? undefined,
      feedback: row.feedback ? JSON.parse(row.feedback) : undefined,
      createdAt: new Date(row.created_at),
      resolvedAt: row.resolved_at ? new Date(row.resolved_at) : undefined,
    };
  }
}
