/**
 * Request/Plan routes.
 *
 * POST /api/requests         — Submit a request → returns plan
 * POST /api/plans/:id/approve — Approve a plan → execute
 * POST /api/plans/:id/reject  — Reject a plan
 * GET  /api/plans/:id         — Get plan status
 */

import type { FastifyInstance } from 'fastify';
import type { AppContext } from '../server.js';
import type { ExecutionPlan, OrchestratorResult } from '@pram1t/mustard-orchestrator';

// In-memory plan store (plans live only for this server session)
const planStore = new Map<string, ExecutionPlan>();
const resultStore = new Map<string, OrchestratorResult>();

export function registerRequestRoutes(app: FastifyInstance, ctx: AppContext): void {
  /**
   * POST /api/requests — Submit a request, returns the generated plan.
   */
  app.post<{ Body: { prompt: string; context?: string } }>('/api/requests', async (request, reply) => {
    const { prompt, context } = request.body ?? {};

    if (!prompt || typeof prompt !== 'string') {
      return reply.code(400).send({
        error: 'Bad Request',
        message: 'A "prompt" string is required.',
        statusCode: 400,
      });
    }

    const plan = await ctx.orchestrator.plan(prompt, context);
    planStore.set(plan.id, plan);

    return {
      success: true,
      data: {
        planId: plan.id,
        request: plan.request,
        steps: plan.steps.map((s) => ({
          id: s.id,
          title: s.title,
          description: s.description,
          assignTo: s.assignTo,
          priority: s.priority,
          dependencies: s.dependencies,
        })),
        createdAt: plan.createdAt,
      },
    };
  });

  /**
   * GET /api/plans/:id — Get plan details.
   */
  app.get<{ Params: { id: string } }>('/api/plans/:id', async (request, reply) => {
    const plan = planStore.get(request.params.id);

    if (!plan) {
      return reply.code(404).send({
        error: 'Not Found',
        message: `Plan ${request.params.id} not found.`,
        statusCode: 404,
      });
    }

    const result = resultStore.get(plan.id);

    return {
      success: true,
      data: {
        planId: plan.id,
        request: plan.request,
        steps: plan.steps,
        createdAt: plan.createdAt,
        result: result ?? null,
      },
    };
  });

  /**
   * POST /api/plans/:id/approve — Approve and execute a plan.
   */
  app.post<{ Params: { id: string } }>('/api/plans/:id/approve', async (request, reply) => {
    const plan = planStore.get(request.params.id);

    if (!plan) {
      return reply.code(404).send({
        error: 'Not Found',
        message: `Plan ${request.params.id} not found.`,
        statusCode: 404,
      });
    }

    // Check if already executed
    if (resultStore.has(plan.id)) {
      return reply.code(409).send({
        error: 'Conflict',
        message: `Plan ${plan.id} has already been executed.`,
        statusCode: 409,
      });
    }

    const result = await ctx.orchestrator.executePlan(plan);
    resultStore.set(plan.id, result);

    return {
      success: true,
      data: result,
    };
  });

  /**
   * POST /api/plans/:id/reject — Reject a plan.
   */
  app.post<{ Params: { id: string } }>('/api/plans/:id/reject', async (request, reply) => {
    const plan = planStore.get(request.params.id);

    if (!plan) {
      return reply.code(404).send({
        error: 'Not Found',
        message: `Plan ${request.params.id} not found.`,
        statusCode: 404,
      });
    }

    planStore.delete(request.params.id);

    return {
      success: true,
      data: { planId: plan.id, status: 'rejected' },
    };
  });
}
