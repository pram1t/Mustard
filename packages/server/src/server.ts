/**
 * OpenAgent V2 - Fastify Server
 *
 * HTTP/WebSocket API server setup.
 */

import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import { EventBus } from '@openagent/message-bus';
import { Orchestrator } from '@openagent/orchestrator';
import { WorkerRegistry } from '@openagent/worker';
import { registerRequestRoutes } from './routes/requests.js';
import { registerWorkerRoutes } from './routes/workers.js';
import { registerTaskRoutes } from './routes/tasks.js';
import { registerArtifactRoutes } from './routes/artifacts.js';
import { registerHealthRoutes } from './routes/health.js';
import { registerMetricsRoute } from './routes/metrics.js';
import { registerWebSocket } from './ws.js';
import type { ServerConfig, ServerDeps } from './types.js';
import { DEFAULT_SERVER_CONFIG } from './types.js';

/**
 * Application context shared across routes.
 */
export interface AppContext {
  orchestrator: Orchestrator;
  registry: WorkerRegistry;
  bus: EventBus;
  deps: ServerDeps;
  config: ServerConfig;
}

/**
 * Create and configure the Fastify server.
 */
export async function createServer(
  config: Partial<ServerConfig> = {},
  deps: ServerDeps,
): Promise<FastifyInstance> {
  const mergedConfig: ServerConfig = { ...DEFAULT_SERVER_CONFIG, ...config };
  const bus = deps.bus instanceof EventBus ? deps.bus : new EventBus();

  // Create orchestrator
  const orchestrator = new Orchestrator(
    { maxParallelWorkers: mergedConfig.maxParallelWorkers },
    {
      router: deps.router,
      tools: deps.tools,
      bus,
      memoryStore: deps.memoryStore,
      artifactStore: deps.artifactStore,
    },
  );

  const registry = new WorkerRegistry();

  const ctx: AppContext = {
    orchestrator,
    registry,
    bus,
    deps,
    config: mergedConfig,
  };

  // Create Fastify instance
  const app = Fastify({ logger: false });

  // Register plugins
  if (mergedConfig.cors) {
    await app.register(cors, { origin: true });
  }
  await app.register(websocket);

  // API key auth hook (optional)
  if (mergedConfig.apiKey) {
    app.addHook('onRequest', async (request, reply) => {
      // Skip auth for health endpoints and WebSocket upgrade
      if (request.url === '/health' || request.url === '/metrics' || request.url === '/api/ws') return;

      const authHeader = request.headers.authorization;
      const apiKey = authHeader?.startsWith('Bearer ')
        ? authHeader.slice(7)
        : request.headers['x-api-key'] as string;

      if (apiKey !== mergedConfig.apiKey) {
        reply.code(401).send({ error: 'Unauthorized', message: 'Invalid API key', statusCode: 401 });
      }
    });
  }

  // Decorate Fastify with app context
  app.decorate('ctx', ctx);

  // Register routes
  registerHealthRoutes(app, ctx);
  registerRequestRoutes(app, ctx);
  registerWorkerRoutes(app, ctx);
  registerTaskRoutes(app, ctx);
  registerArtifactRoutes(app, ctx);
  registerMetricsRoute(app, ctx);
  registerWebSocket(app, ctx);

  return app;
}

/**
 * Start the server.
 */
export async function startServer(
  config: Partial<ServerConfig> = {},
  deps: ServerDeps,
): Promise<FastifyInstance> {
  const app = await createServer(config, deps);
  const mergedConfig: ServerConfig = { ...DEFAULT_SERVER_CONFIG, ...config };

  await app.listen({ port: mergedConfig.port, host: mergedConfig.host });

  console.log(`OpenAgent API server listening on http://${mergedConfig.host}:${mergedConfig.port}`);

  return app;
}
