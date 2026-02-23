/**
 * Health check routes.
 */

import type { FastifyInstance } from 'fastify';
import type { AppContext } from '../server.js';

export function registerHealthRoutes(app: FastifyInstance, ctx: AppContext): void {
  app.get('/health', async () => ({
    status: 'ok',
    uptime: process.uptime(),
    version: '0.0.0',
    workers: ctx.registry.getActiveCount(),
  }));
}
