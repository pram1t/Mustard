/**
 * Metrics endpoint.
 *
 * GET /metrics — Returns basic runtime metrics in JSON format.
 */

import type { FastifyInstance } from 'fastify';
import type { AppContext } from '../server.js';

export interface ServerMetrics {
  uptime: number;
  memoryUsage: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
  };
  activeWorkers: number;
  busSubscriptions: number;
  busHistory: number;
  timestamp: string;
}

export function registerMetricsRoute(app: FastifyInstance, ctx: AppContext): void {
  app.get('/metrics', async () => {
    const mem = process.memoryUsage();

    const metrics: ServerMetrics = {
      uptime: process.uptime(),
      memoryUsage: {
        rss: mem.rss,
        heapTotal: mem.heapTotal,
        heapUsed: mem.heapUsed,
        external: mem.external,
      },
      activeWorkers: ctx.registry.getActiveCount(),
      busSubscriptions: ctx.bus.getSubscriptionCount(),
      busHistory: ctx.bus.getHistory().length,
      timestamp: new Date().toISOString(),
    };

    return metrics;
  });
}
