/**
 * `/yjs` upgrade endpoint — wires y-websocket's setupWSConnection onto
 * a JWT-auth'd Fastify route, with per-room SQLite persistence.
 *
 * Endpoint: GET /yjs?token=<JWT>&roomId=<id>
 *
 * Each room gets one logical Y.Doc keyed by roomId. y-websocket
 * handles the binary sync protocol; persistence (load on bind, save
 * on debounce + on disconnect) is delegated to SqliteYjsPersistence.
 *
 * Why a separate route from /ws (the JSON event bridge):
 * - /ws sends JSON event envelopes; clients use it to react to bus
 *   events (intent.proposed, mode.changed, etc.).
 * - /yjs speaks Yjs's binary sync + awareness protocols; clients use
 *   it for the live shared document only.
 *
 * Both can be open simultaneously from the same browser/CLI.
 */

import type { FastifyInstance } from 'fastify';
import type { CollabServerConfig } from './types.js';
import type { RoomRegistry } from './room-registry.js';
import { verify } from './jwt.js';
import {
  createYjsPersistence,
  type YjsPersistence,
  type SqliteYjsPersistenceOptions,
} from './yjs-persistence.js';

// y-websocket's setPersistence + setupWSConnection are CJS exports under
// y-websocket/bin/utils.js. Use createRequire so this ESM module can
// load them without bundler help.
import { createRequire } from 'node:module';
const localRequire = createRequire(import.meta.url);

type YwsUtils = {
  setPersistence: (p: unknown) => void;
  setupWSConnection: (
    conn: unknown,
    req: unknown,
    opts: { docName: string; gc?: boolean },
  ) => void;
};

function loadYwsUtils(): YwsUtils {
  // package.json `exports` map exposes this as './bin/utils' (no `.js`)
  return localRequire('y-websocket/bin/utils') as YwsUtils;
}

// ============================================================================
// Options + return type
// ============================================================================

export interface RegisterYjsRouteOptions {
  app: FastifyInstance;
  registry: RoomRegistry;
  config: CollabServerConfig;
  /** Path the Yjs upgrade endpoint listens on. Default '/yjs'. */
  path?: string;
  /** Persistence options (forwarded to SqliteYjsPersistence). */
  persistence?: SqliteYjsPersistenceOptions;
  /**
   * Pre-built persistence object — overrides `persistence`. Useful for
   * sharing one persistence across routes / tests.
   */
  customPersistence?: YjsPersistence;
}

export interface YjsRouteHandle {
  persistence: YjsPersistence;
  /** Tear down persistence (close db if owned). */
  dispose(): void;
}

// ============================================================================
// Register
// ============================================================================

export function registerYjsRoute(opts: RegisterYjsRouteOptions): YjsRouteHandle {
  const { app, registry, config } = opts;
  const path = opts.path ?? '/yjs';

  const persistence =
    opts.customPersistence ?? createYjsPersistence(opts.persistence ?? {});

  const utils = loadYwsUtils();
  utils.setPersistence(persistence);

  app.register(async function (fastify: FastifyInstance) {
    fastify.get(path, { websocket: true }, (socket, req) => {
      const url = new URL(req.url, 'http://localhost');
      const token = url.searchParams.get('token');
      const roomId = url.searchParams.get('roomId');

      if (!token) {
        try {
          (socket as unknown as { close(c: number, r: string): void }).close(
            1008,
            'missing token',
          );
        } catch {
          /* ignore */
        }
        return;
      }
      const payload = verify(token, config.jwtSecret);
      if (!payload) {
        try {
          (socket as unknown as { close(c: number, r: string): void }).close(
            1008,
            'invalid token',
          );
        } catch {
          /* ignore */
        }
        return;
      }
      if (!roomId) {
        try {
          (socket as unknown as { close(c: number, r: string): void }).close(
            1008,
            'missing roomId',
          );
        } catch {
          /* ignore */
        }
        return;
      }
      if (!registry.has(roomId)) {
        try {
          (socket as unknown as { close(c: number, r: string): void }).close(
            1008,
            'unknown room',
          );
        } catch {
          /* ignore */
        }
        return;
      }

      // Hand the raw socket to y-websocket. It will speak the Yjs
      // sync + awareness protocols, persist via SqliteYjsPersistence,
      // and broadcast updates to other connections holding the same
      // docName.
      try {
        utils.setupWSConnection(socket, req.raw, { docName: roomId });
      } catch (err) {
        try {
          (socket as unknown as { close(c: number, r: string): void }).close(
            1011,
            (err as Error).message ?? 'sync error',
          );
        } catch {
          /* ignore */
        }
      }
    });
  });

  return {
    persistence,
    dispose() {
      try {
        persistence.provider.destroy();
      } catch {
        /* ignore */
      }
    },
  };
}
