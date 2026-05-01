/**
 * REST routes for rooms + participants.
 *
 * All routes are JWT-authenticated. Room ownership is recorded as
 * jwtPayload.sub when a room is created. Participants join with their
 * JWT subject as userId.
 */

import type { FastifyInstance } from 'fastify';
import type { RoomRegistry } from '../room-registry.js';
import type {
  PermissionMode,
  RoomConfig,
  RoomVisibility,
} from '@pram1t/mustard-collab-core';

interface CreateRoomBody {
  name?: string;
  projectPath?: string;
  config?: Partial<RoomConfig>;
}

interface JoinBody {
  name?: string;
  type?: 'human' | 'ai';
  role?: 'owner' | 'admin' | 'member' | 'viewer';
}

const VALID_VISIBILITIES: ReadonlySet<RoomVisibility> = new Set([
  'private',
  'team',
  'public',
]);

const VALID_MODES: ReadonlySet<PermissionMode> = new Set([
  'plan',
  'code',
  'ask',
  'auto',
]);

export function registerRoomRoutes(
  app: FastifyInstance,
  registry: RoomRegistry,
): void {
  // ---- Create room ----
  app.post('/rooms', { config: { auth: true } }, async (req, reply) => {
    const body = (req.body ?? {}) as CreateRoomBody;
    if (!body.name || typeof body.name !== 'string') {
      reply.status(400);
      return { error: { code: 'INVALID_INPUT', message: 'name is required' } };
    }
    if (
      body.config?.visibility &&
      !VALID_VISIBILITIES.has(body.config.visibility)
    ) {
      reply.status(400);
      return {
        error: { code: 'INVALID_INPUT', message: 'invalid visibility' },
      };
    }
    if (
      body.config?.defaultMode &&
      !VALID_MODES.has(body.config.defaultMode)
    ) {
      reply.status(400);
      return { error: { code: 'INVALID_INPUT', message: 'invalid defaultMode' } };
    }

    const ctx = registry.create({
      name: body.name,
      projectPath: body.projectPath,
      config: body.config,
      ownerId: req.jwtPayload!.sub,
    });
    reply.status(201);
    return { room: ctx.room };
  });

  // ---- List rooms ----
  app.get('/rooms', { config: { auth: true } }, async () => ({
    rooms: registry.list().map(ctx => ctx.room),
  }));

  // ---- Get one room ----
  app.get<{ Params: { id: string } }>(
    '/rooms/:id',
    { config: { auth: true } },
    async (req, reply) => {
      const ctx = registry.get(req.params.id);
      if (!ctx) {
        reply.status(404);
        return { error: { code: 'NOT_FOUND', message: 'room not found' } };
      }
      return {
        room: ctx.room,
        participants: registry.listParticipants(ctx.room.id),
        mode: ctx.modeManager.current(),
      };
    },
  );

  // ---- Delete room ----
  app.delete<{ Params: { id: string } }>(
    '/rooms/:id',
    { config: { auth: true } },
    async (req, reply) => {
      const ctx = registry.get(req.params.id);
      if (!ctx) {
        reply.status(404);
        return { error: { code: 'NOT_FOUND', message: 'room not found' } };
      }
      if (ctx.room.ownerId !== req.jwtPayload!.sub) {
        reply.status(403);
        return { error: { code: 'FORBIDDEN', message: 'only owner can delete' } };
      }
      registry.destroy(req.params.id);
      reply.status(204).send();
    },
  );

  // ---- Join room ----
  app.post<{ Params: { id: string }; Body: JoinBody }>(
    '/rooms/:id/join',
    { config: { auth: true } },
    async (req, reply) => {
      if (!registry.has(req.params.id)) {
        reply.status(404);
        return { error: { code: 'NOT_FOUND', message: 'room not found' } };
      }
      const body = req.body ?? {};
      const participant = registry.addParticipant(req.params.id, {
        userId: req.jwtPayload!.sub,
        name: body.name ?? req.jwtPayload!.sub,
        type: body.type ?? 'human',
        role: body.role,
      });
      reply.status(201);
      return { participant };
    },
  );

  // ---- Leave room ----
  app.post<{ Params: { id: string; pid: string } }>(
    '/rooms/:id/participants/:pid/leave',
    { config: { auth: true } },
    async (req, reply) => {
      if (!registry.has(req.params.id)) {
        reply.status(404);
        return { error: { code: 'NOT_FOUND', message: 'room not found' } };
      }
      const ok = registry.removeParticipant(req.params.id, req.params.pid);
      if (!ok) {
        reply.status(404);
        return { error: { code: 'NOT_FOUND', message: 'participant not found' } };
      }
      reply.status(204).send();
    },
  );

  // ---- List participants ----
  app.get<{ Params: { id: string } }>(
    '/rooms/:id/participants',
    { config: { auth: true } },
    async (req, reply) => {
      if (!registry.has(req.params.id)) {
        reply.status(404);
        return { error: { code: 'NOT_FOUND', message: 'room not found' } };
      }
      return { participants: registry.listParticipants(req.params.id) };
    },
  );
}
