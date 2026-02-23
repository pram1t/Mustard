/**
 * OpenAgent V2 - SQLite Task Queue
 *
 * Persistent priority queue backed by SQLite.
 * Same interface as in-memory TaskQueue, but survives restarts.
 */

import { randomUUID } from 'node:crypto';
import Database from 'better-sqlite3';
import type { IMessageBus } from '@openagent/message-bus';
import type {
  ITaskQueue,
  QueueStats,
  QueueTask,
  TaskInput,
  TaskPriority,
  TaskStatus,
} from './types.js';
import { PRIORITY_VALUES } from './types.js';

/**
 * SQLite-backed priority task queue.
 */
export class SqliteTaskQueue implements ITaskQueue {
  private db: Database.Database;
  private bus?: IMessageBus;

  constructor(dbPath: string = ':memory:', bus?: IMessageBus) {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.bus = bus;
    this.initialize();
  }

  private initialize(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        priority TEXT NOT NULL DEFAULT 'normal',
        priority_value INTEGER NOT NULL DEFAULT 2,
        status TEXT NOT NULL DEFAULT 'pending',
        dependencies TEXT NOT NULL DEFAULT '[]',
        assign_to TEXT,
        created_at TEXT NOT NULL,
        started_at TEXT,
        completed_at TEXT,
        retry_count INTEGER NOT NULL DEFAULT 0,
        max_retries INTEGER NOT NULL DEFAULT 3,
        result TEXT,
        error TEXT,
        metadata TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
      CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority_value, created_at);
    `);
  }

  add(input: TaskInput): QueueTask {
    const id = input.id ?? randomUUID();
    const now = new Date();
    const priority = input.priority ?? 'normal';
    const deps = input.dependencies ?? [];
    const status: TaskStatus = deps.length === 0 ? 'ready' : 'pending';

    this.db.prepare(`
      INSERT INTO tasks (id, title, description, priority, priority_value, status, dependencies, assign_to, created_at, retry_count, max_retries, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
    `).run(
      id, input.title, input.description, priority, PRIORITY_VALUES[priority],
      status, JSON.stringify(deps), input.assignTo ?? null,
      now.toISOString(), input.maxRetries ?? 3,
      input.metadata ? JSON.stringify(input.metadata) : null
    );

    this.bus?.publish('task.created', { taskId: id, title: input.title, priority });

    return this.rowToTask(this.db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as any);
  }

  getNext(): QueueTask | null {
    this.updateReadyTasks();

    const row = this.db.prepare(`
      SELECT * FROM tasks WHERE status = 'ready'
      ORDER BY priority_value ASC, created_at ASC
      LIMIT 1
    `).get() as any;

    return row ? this.rowToTask(row) : null;
  }

  get(id: string): QueueTask | undefined {
    const row = this.db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as any;
    return row ? this.rowToTask(row) : undefined;
  }

  start(id: string): QueueTask {
    const task = this.getOrThrow(id);
    this.assertStatus(task, 'ready');

    const now = new Date().toISOString();
    this.db.prepare("UPDATE tasks SET status = 'running', started_at = ? WHERE id = ?").run(now, id);

    this.bus?.publish('task.started', { taskId: id });
    return this.rowToTask(this.db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as any);
  }

  complete(id: string, result?: unknown): QueueTask {
    const task = this.getOrThrow(id);
    this.assertStatus(task, 'running');

    const now = new Date().toISOString();
    this.db.prepare("UPDATE tasks SET status = 'completed', completed_at = ?, result = ? WHERE id = ?")
      .run(now, result !== undefined ? JSON.stringify(result) : null, id);

    this.bus?.publish('task.completed', { taskId: id, result });
    this.updateReadyTasks();

    return this.rowToTask(this.db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as any);
  }

  fail(id: string, error: string): QueueTask {
    const task = this.getOrThrow(id);
    this.assertStatus(task, 'running');

    const now = new Date().toISOString();
    this.db.prepare("UPDATE tasks SET status = 'failed', completed_at = ?, error = ? WHERE id = ?")
      .run(now, error, id);

    this.bus?.publish('task.failed', { taskId: id, error });
    return this.rowToTask(this.db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as any);
  }

  cancel(id: string): QueueTask {
    const task = this.getOrThrow(id);
    if (task.status === 'completed' || task.status === 'cancelled') {
      throw new Error(`Cannot cancel task in status: ${task.status}`);
    }

    const now = new Date().toISOString();
    this.db.prepare("UPDATE tasks SET status = 'cancelled', completed_at = ? WHERE id = ?").run(now, id);

    this.bus?.publish('task.cancelled', { taskId: id });
    return this.rowToTask(this.db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as any);
  }

  getAll(): QueueTask[] {
    const rows = this.db.prepare('SELECT * FROM tasks ORDER BY created_at ASC').all() as any[];
    return rows.map((r) => this.rowToTask(r));
  }

  getByStatus(status: TaskStatus): QueueTask[] {
    const rows = this.db.prepare('SELECT * FROM tasks WHERE status = ? ORDER BY created_at ASC').all(status) as any[];
    return rows.map((r) => this.rowToTask(r));
  }

  getStats(): QueueStats {
    const rows = this.db.prepare('SELECT status, COUNT(*) as cnt FROM tasks GROUP BY status').all() as any[];
    const stats: QueueStats = { total: 0, pending: 0, ready: 0, running: 0, completed: 0, failed: 0, cancelled: 0 };
    for (const row of rows) {
      stats[row.status as TaskStatus] = row.cnt;
      stats.total += row.cnt;
    }
    return stats;
  }

  clear(): void {
    this.db.prepare('DELETE FROM tasks').run();
  }

  close(): void {
    this.db.close();
  }

  // ===========================================================================
  // PRIVATE
  // ===========================================================================

  private updateReadyTasks(): void {
    // Get all pending tasks
    const pendingRows = this.db.prepare("SELECT id, dependencies FROM tasks WHERE status = 'pending'").all() as any[];

    for (const row of pendingRows) {
      const deps: string[] = JSON.parse(row.dependencies);
      if (deps.length === 0) {
        this.db.prepare("UPDATE tasks SET status = 'ready' WHERE id = ?").run(row.id);
        continue;
      }

      // Check if all deps are completed
      const placeholders = deps.map(() => '?').join(',');
      const completedCount = this.db.prepare(
        `SELECT COUNT(*) as cnt FROM tasks WHERE id IN (${placeholders}) AND status = 'completed'`
      ).get(...deps) as any;

      if (completedCount.cnt === deps.length) {
        this.db.prepare("UPDATE tasks SET status = 'ready' WHERE id = ?").run(row.id);
      }
    }
  }

  private getOrThrow(id: string): QueueTask {
    const task = this.get(id);
    if (!task) throw new Error(`Task not found: ${id}`);
    return task;
  }

  private assertStatus(task: QueueTask, expected: TaskStatus): void {
    if (task.status !== expected) {
      throw new Error(`Task ${task.id} is "${task.status}", expected "${expected}"`);
    }
  }

  private rowToTask(row: any): QueueTask {
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      priority: row.priority as TaskPriority,
      status: row.status as TaskStatus,
      dependencies: JSON.parse(row.dependencies),
      assignTo: row.assign_to ?? undefined,
      createdAt: new Date(row.created_at),
      startedAt: row.started_at ? new Date(row.started_at) : undefined,
      completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
      retryCount: row.retry_count,
      maxRetries: row.max_retries,
      result: row.result ? JSON.parse(row.result) : undefined,
      error: row.error ?? undefined,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    };
  }
}
