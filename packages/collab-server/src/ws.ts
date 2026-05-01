/**
 * WebSocket bridge — fans bus events out to connected clients.
 *
 * Endpoint: GET /ws?token=<JWT>&roomId=<id>
 *
 * Auth: token validated on the upgrade handler. If `roomId` is supplied
 * (recommended), the client receives ONLY events whose envelope.source
 * matches that roomId. Without it, the client sees every event the
 * server publishes — useful for monitoring/admin scenarios.
 *
 * Subscribed topics:
 *   collab.ai.intent.*
 *   collab.permissions.mode.*
 *   collab.room.*
 *
 * The Yjs document sync handler (setupWSConnection) is intentionally
 * deferred to Phase 11 — that requires Yjs binary state encoding and
 * a richer integration with collab-sync.
 */

import type { FastifyInstance } from 'fastify';
import type { WebSocket } from '@fastify/websocket';
import type { IMessageBus, MessageEnvelope } from '@pram1t/mustard-message-bus';
import type { CollabServerConfig } from './types.js';
import { verify } from './jwt.js';

const TOPIC_PATTERNS: ReadonlyArray<string> = [
  'collab.ai.intent.*',
  'collab.permissions.mode.*',
  'collab.room.*',
];

export interface RegisterWebSocketOptions {
  app: FastifyInstance;
  bus: IMessageBus;
  config: CollabServerConfig;
  /** Path the WS server listens on. Default '/ws'. */
  path?: string;
}

interface ClientEntry {
  socket: WebSocket;
  /** Optional room filter — only forward envelopes with this `source`. */
  roomId?: string;
  /** Subject of the JWT for logging/identification. */
  sub: string;
}

/**
 * Internal state exposed for tests + lifecycle hooks.
 */
export interface WebSocketBridge {
  /** Live client set (test-only inspection). */
  clients: Set<ClientEntry>;
  /** Disposers for bus subscriptions. */
  dispose(): void;
}

export function registerWebSocket(
  options: RegisterWebSocketOptions,
): WebSocketBridge {
  const { app, bus, config } = options;
  const path = options.path ?? '/ws';
  const clients = new Set<ClientEntry>();

  const disposers: Array<() => void> = [];

  for (const pattern of TOPIC_PATTERNS) {
    const unsub = bus.subscribe(pattern, (env: MessageEnvelope<unknown>) => {
      const json = JSON.stringify({
        type: env.type,
        payload: env.payload,
        source: env.source,
        timestamp:
          typeof env.timestamp === 'object' &&
          env.timestamp instanceof Date
            ? env.timestamp.getTime()
            : env.timestamp,
      });
      for (const client of clients) {
        if (client.roomId && client.roomId !== env.source) continue;
        if (client.socket.readyState === 1 /* OPEN */) {
          try {
            client.socket.send(json);
          } catch {
            /* socket closing — drop on next sweep */
          }
        }
      }
    });
    disposers.push(unsub);
  }

  app.register(async function (fastify: FastifyInstance) {
    fastify.get(
      path,
      { websocket: true },
      (socket, req) => {
        const url = new URL(req.url, 'http://localhost');
        const token = url.searchParams.get('token');
        const roomId = url.searchParams.get('roomId') ?? undefined;

        if (!token) {
          socket.close(1008, 'missing token');
          return;
        }
        const payload = verify(token, config.jwtSecret);
        if (!payload) {
          socket.close(1008, 'invalid token');
          return;
        }

        const entry: ClientEntry = {
          socket,
          roomId,
          sub: payload.sub,
        };
        clients.add(entry);

        socket.on('close', () => clients.delete(entry));
        socket.on('error', () => clients.delete(entry));
      },
    );
  });

  return {
    clients,
    dispose() {
      for (const d of disposers) {
        try {
          d();
        } catch {
          /* swallow */
        }
      }
      for (const c of clients) {
        try {
          c.socket.close(1001, 'shutting down');
        } catch {
          /* swallow */
        }
      }
      clients.clear();
    },
  };
}
