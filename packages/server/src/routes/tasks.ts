/**
 * Task routes.
 *
 * GET /api/tasks         — List tasks (with optional status filter)
 * GET /api/tasks/:id     — Get task details
 */

import type { FastifyInstance } from 'fastify';
import type { AppContext } from '../server.js';

interface TaskEntry {
  id: string;
  title: string;
  role?: string;
  status: string;
  startedAt?: Date;
  completedAt?: Date;
  duration?: number;
  error?: string;
}

// In-memory task event log (populated via bus subscription)
const taskLog = new Map<string, TaskEntry>();

/**
 * Initialize task tracking by subscribing to bus events.
 */
export function initTaskTracking(ctx: AppContext): void {
  ctx.bus.subscribe('task.created', (msg) => {
    const p = msg.payload as Record<string, any>;
    taskLog.set(p.taskId, {
      id: p.taskId,
      title: p.title ?? p.taskId,
      status: 'pending',
    });
  });

  ctx.bus.subscribe('task.started', (msg) => {
    const p = msg.payload as Record<string, any>;
    const existing: TaskEntry = taskLog.get(p.taskId) ?? { id: p.taskId, title: p.title ?? p.taskId, status: 'running' };
    existing.status = 'running';
    existing.role = p.role;
    existing.startedAt = new Date();
    taskLog.set(p.taskId, existing);
  });

  ctx.bus.subscribe('task.completed', (msg) => {
    const p = msg.payload as Record<string, any>;
    const existing: TaskEntry = taskLog.get(p.taskId) ?? { id: p.taskId, title: p.title ?? p.taskId, status: 'completed' };
    existing.status = 'completed';
    existing.completedAt = new Date();
    existing.duration = p.duration;
    taskLog.set(p.taskId, existing);
  });

  ctx.bus.subscribe('task.failed', (msg) => {
    const p = msg.payload as Record<string, any>;
    const existing: TaskEntry = taskLog.get(p.taskId) ?? { id: p.taskId, title: p.title ?? p.taskId, status: 'failed' };
    existing.status = 'failed';
    existing.error = p.error;
    taskLog.set(p.taskId, existing);
  });
}

export function registerTaskRoutes(app: FastifyInstance, ctx: AppContext): void {
  initTaskTracking(ctx);

  app.get<{ Querystring: { status?: string } }>('/api/tasks', async (request) => {
    let tasks = [...taskLog.values()];
    if (request.query.status) {
      tasks = tasks.filter((t) => t.status === request.query.status);
    }
    return { success: true, data: tasks, total: tasks.length };
  });

  app.get<{ Params: { id: string } }>('/api/tasks/:id', async (request, reply) => {
    const task = taskLog.get(request.params.id);
    if (!task) {
      return reply.code(404).send({ error: 'Not Found', message: `Task ${request.params.id} not found.`, statusCode: 404 });
    }
    return { success: true, data: task };
  });
}
