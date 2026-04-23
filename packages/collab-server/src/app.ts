/**
 * Fastify app factory for @openagent/collab-server.
 *
 * Composes middleware (CORS, error handler), mounts the health route,
 * wires JWT auth as a preHandler that routes can opt into via the
 * `auth: true` route-level config. The RoomRegistry + routes are
 * attached by `registerCollabRoutes()` in later steps.
 */

import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import {
  DEFAULT_COLLAB_SERVER_CONFIG,
  type CollabServerConfig,
  type ApiError,
  type LoginRequest,
  type LoginResponse,
} from './types.js';
import { sign, verify, type JwtPayload } from './jwt.js';
import { RoomRegistry } from './room-registry.js';
import { registerRoomRoutes } from './routes/rooms.js';
import { registerIntentRoutes } from './routes/intents.js';
import { registerWebSocket, type WebSocketBridge } from './ws.js';
import type { IMessageBus } from '@openagent/message-bus';
import { EventBus } from '@openagent/message-bus';
import type { AutoApprovalPolicy } from '@openagent/collab-ai';

// ============================================================================
// Augmentations
// ============================================================================

declare module 'fastify' {
  interface FastifyContextConfig {
    /** When true, the request must carry a valid JWT. */
    auth?: boolean;
  }
  interface FastifyRequest {
    jwtPayload?: JwtPayload;
  }
}

// ============================================================================
// App factory
// ============================================================================

export interface CreateAppOptions {
  config?: Partial<CollabServerConfig>;
  /** Optional pre-existing bus (for tests + multi-server hookups). */
  bus?: IMessageBus;
  /** Optional pre-existing registry (advanced; tests). */
  registry?: RoomRegistry;
  /** Auto-approval policy passed to the registry if it's constructed here. */
  autoApproval?: AutoApprovalPolicy;
}

export interface CreateAppResult {
  app: FastifyInstance;
  config: CollabServerConfig;
  registry: RoomRegistry;
  bus: IMessageBus;
  ws: WebSocketBridge;
}

export async function createApp(
  options: CreateAppOptions = {},
): Promise<CreateAppResult> {
  const config: CollabServerConfig = {
    ...DEFAULT_COLLAB_SERVER_CONFIG,
    ...options.config,
  };

  if (!config.jwtSecret) {
    throw new Error(
      'collab-server: `jwtSecret` is required — pass a non-empty string',
    );
  }

  const bus = options.bus ?? new EventBus();
  const registry =
    options.registry ?? new RoomRegistry({ bus, autoApproval: options.autoApproval });

  const app = Fastify({
    logger: false, // callers wire their own logger via hooks if desired
  });

  if (config.cors) {
    await app.register(cors, { origin: true, credentials: true });
  }
  await app.register(websocket);

  // ---- Error handler ----
  app.setErrorHandler((err: unknown, _req, reply) => {
    const fe = err as {
      statusCode?: number;
      code?: string;
      message?: string;
    };
    const status = fe.statusCode ?? 500;
    const body: ApiError = {
      error: {
        code: fe.code ?? 'INTERNAL',
        message: fe.message || 'Internal Server Error',
      },
    };
    reply.status(status).send(body);
  });

  // ---- Not-found handler ----
  app.setNotFoundHandler((_req, reply) => {
    const body: ApiError = {
      error: { code: 'NOT_FOUND', message: 'Route not found' },
    };
    reply.status(404).send(body);
  });

  // ---- Auth preHandler (opt-in per route) ----
  app.addHook('preHandler', async (req, reply) => {
    const routeOpts = req.routeOptions?.config;
    const needsAuth = Boolean(routeOpts?.auth);
    if (!needsAuth) return;

    const payload = extractBearer(req, config.jwtSecret);
    if (!payload) {
      const body: ApiError = {
        error: {
          code: 'UNAUTHORIZED',
          message: 'Missing or invalid authorization token',
        },
      };
      reply.status(401).send(body);
      return;
    }
    req.jwtPayload = payload;
  });

  // ---- Health ----
  app.get('/health', async () => ({ status: 'ok', timestamp: Date.now() }));

  // ---- Login ----
  app.post('/auth/login', async (req, reply) => {
    const body = req.body as Partial<LoginRequest> | undefined;
    if (!body || typeof body.participantId !== 'string' || !body.participantId) {
      reply.status(400);
      return {
        error: { code: 'INVALID_INPUT', message: 'participantId required' },
      } satisfies ApiError;
    }
    const token = sign(
      {
        sub: body.participantId,
        roomId: body.roomId,
      },
      config.jwtSecret,
      { expiresInSec: config.tokenLifetimeSec },
    );
    const response: LoginResponse = {
      token,
      expiresAt: Math.floor(Date.now() / 1000) + config.tokenLifetimeSec,
      participantId: body.participantId,
      roomId: body.roomId,
    };
    return response;
  });

  // ---- Collab REST routes ----
  registerRoomRoutes(app, registry);
  registerIntentRoutes(app, registry);

  // ---- WebSocket bridge ----
  const ws = registerWebSocket({ app, bus, config });

  return { app, config, registry, bus, ws };
}

// ============================================================================
// Auth helpers
// ============================================================================

/** Extract + verify a Bearer JWT. Returns payload or null. */
export function extractBearer(
  req: FastifyRequest,
  secret: string,
): JwtPayload | null {
  const header = req.headers.authorization;
  if (!header) return null;
  const m = /^Bearer\s+(.+)$/.exec(header);
  if (!m) return null;
  return verify(m[1], secret);
}
