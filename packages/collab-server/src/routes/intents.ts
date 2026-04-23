/**
 * REST routes for intents + modes + agents.
 * All authenticated.
 */

import type { FastifyInstance } from 'fastify';
import type { RoomRegistry } from '../room-registry.js';
import type {
  IntentAction,
  IntentType,
  RiskLevel,
} from '@openagent/collab-ai';
import type { PermissionMode } from '@openagent/collab-core';

interface ProposeIntentBody {
  agentId?: string;
  summary?: string;
  type?: IntentType;
  action?: IntentAction;
  rationale?: string;
  confidence?: number;
  risk?: RiskLevel;
}

interface ApproveBody { approver?: string; }
interface RejectBody { rejecter?: string; reason?: string; }
interface ChangeModeBody { mode?: PermissionMode; }
interface RegisterAgentBody {
  agentId?: string;
  name?: string;
  model?: string;
  provider?: string;
  allowedActions?: string[];
}

const VALID_MODES: ReadonlySet<PermissionMode> = new Set([
  'plan', 'code', 'ask', 'auto',
]);

export function registerIntentRoutes(
  app: FastifyInstance,
  registry: RoomRegistry,
): void {
  // ---- List intents ----
  app.get<{ Params: { id: string } }>(
    '/rooms/:id/intents',
    { config: { auth: true } },
    async (req, reply) => {
      const ctx = registry.get(req.params.id);
      if (!ctx) {
        reply.status(404);
        return { error: { code: 'NOT_FOUND', message: 'room not found' } };
      }
      const status = (req.query as Record<string, string>)?.status;
      const intents = ctx.intentEngine.list(
        status ? { status: status as never } : undefined,
      );
      return { intents };
    },
  );

  // ---- Propose intent ----
  app.post<{ Params: { id: string }; Body: ProposeIntentBody }>(
    '/rooms/:id/intents',
    { config: { auth: true } },
    async (req, reply) => {
      const ctx = registry.get(req.params.id);
      if (!ctx) {
        reply.status(404);
        return { error: { code: 'NOT_FOUND', message: 'room not found' } };
      }
      const b = req.body ?? {};
      if (
        !b.agentId ||
        !b.summary ||
        !b.type ||
        !b.action ||
        !b.rationale ||
        typeof b.confidence !== 'number' ||
        !b.risk
      ) {
        reply.status(400);
        return {
          error: { code: 'INVALID_INPUT', message: 'missing required intent fields' },
        };
      }
      const intent = ctx.intentEngine.propose({
        agentId: b.agentId,
        summary: b.summary,
        type: b.type,
        action: b.action,
        rationale: b.rationale,
        confidence: b.confidence,
        risk: b.risk,
      });
      reply.status(201);
      return { intent };
    },
  );

  // ---- Approve intent (manual approval through the approval manager) ----
  app.post<{ Params: { id: string; iid: string }; Body: ApproveBody }>(
    '/rooms/:id/intents/:iid/approve',
    { config: { auth: true } },
    async (req, reply) => {
      const ctx = registry.get(req.params.id);
      if (!ctx) {
        reply.status(404);
        return { error: { code: 'NOT_FOUND', message: 'room not found' } };
      }
      const approver = req.body?.approver ?? req.jwtPayload!.sub;
      const reqRecord = ctx.approvalManager
        .list({ status: 'waiting' })
        .find(r => r.intentId === req.params.iid);
      if (!reqRecord) {
        reply.status(404);
        return {
          error: { code: 'NOT_FOUND', message: 'no waiting approval for this intent' },
        };
      }
      const updated = ctx.approvalManager.approve(reqRecord.id, approver);
      return { approval: updated };
    },
  );

  // ---- Reject intent ----
  app.post<{ Params: { id: string; iid: string }; Body: RejectBody }>(
    '/rooms/:id/intents/:iid/reject',
    { config: { auth: true } },
    async (req, reply) => {
      const ctx = registry.get(req.params.id);
      if (!ctx) {
        reply.status(404);
        return { error: { code: 'NOT_FOUND', message: 'room not found' } };
      }
      const rejecter = req.body?.rejecter ?? req.jwtPayload!.sub;
      const reqRecord = ctx.approvalManager
        .list({ status: 'waiting' })
        .find(r => r.intentId === req.params.iid);
      if (!reqRecord) {
        reply.status(404);
        return {
          error: { code: 'NOT_FOUND', message: 'no waiting approval for this intent' },
        };
      }
      const updated = ctx.approvalManager.reject(reqRecord.id, rejecter);
      return { approval: updated };
    },
  );

  // ---- Get current mode ----
  app.get<{ Params: { id: string } }>(
    '/rooms/:id/mode',
    { config: { auth: true } },
    async (req, reply) => {
      const ctx = registry.get(req.params.id);
      if (!ctx) {
        reply.status(404);
        return { error: { code: 'NOT_FOUND', message: 'room not found' } };
      }
      return {
        mode: ctx.modeManager.current(),
        capabilities: ctx.modeManager.capabilities(),
        state: ctx.modeManager.getState(),
      };
    },
  );

  // ---- Change mode ----
  app.post<{ Params: { id: string }; Body: ChangeModeBody }>(
    '/rooms/:id/mode',
    { config: { auth: true } },
    async (req, reply) => {
      const ctx = registry.get(req.params.id);
      if (!ctx) {
        reply.status(404);
        return { error: { code: 'NOT_FOUND', message: 'room not found' } };
      }
      const mode = req.body?.mode;
      if (!mode || !VALID_MODES.has(mode)) {
        reply.status(400);
        return { error: { code: 'INVALID_INPUT', message: 'invalid mode' } };
      }
      const event = ctx.modeManager.setMode(mode, req.jwtPayload!.sub);
      return { mode: ctx.modeManager.current(), event };
    },
  );

  // ---- Register an AI agent ----
  app.post<{ Params: { id: string }; Body: RegisterAgentBody }>(
    '/rooms/:id/agents',
    { config: { auth: true } },
    async (req, reply) => {
      const ctx = registry.get(req.params.id);
      if (!ctx) {
        reply.status(404);
        return { error: { code: 'NOT_FOUND', message: 'room not found' } };
      }
      const b = req.body ?? {};
      if (!b.agentId || !b.name || !b.model || !b.provider) {
        reply.status(400);
        return {
          error: {
            code: 'INVALID_INPUT',
            message: 'agentId, name, model, provider required',
          },
        };
      }
      try {
        const agent = ctx.agentRegistry.register({
          id: b.agentId,
          name: b.name,
          model: b.model,
          provider: b.provider,
          allowedActions: b.allowedActions,
        });
        reply.status(201);
        return { agent };
      } catch (err) {
        reply.status(409);
        return {
          error: {
            code: 'CONFLICT',
            message: (err as Error).message,
          },
        };
      }
    },
  );

  // ---- List agents ----
  app.get<{ Params: { id: string } }>(
    '/rooms/:id/agents',
    { config: { auth: true } },
    async (req, reply) => {
      const ctx = registry.get(req.params.id);
      if (!ctx) {
        reply.status(404);
        return { error: { code: 'NOT_FOUND', message: 'room not found' } };
      }
      return { agents: ctx.agentRegistry.list() };
    },
  );

  // ---- Unregister agent ----
  app.delete<{ Params: { id: string; aid: string } }>(
    '/rooms/:id/agents/:aid',
    { config: { auth: true } },
    async (req, reply) => {
      const ctx = registry.get(req.params.id);
      if (!ctx) {
        reply.status(404);
        return { error: { code: 'NOT_FOUND', message: 'room not found' } };
      }
      ctx.agentRegistry.unregister(req.params.aid);
      reply.status(204).send();
    },
  );
}
