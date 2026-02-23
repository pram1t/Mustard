/**
 * Worker routes.
 *
 * GET    /api/workers              — List all definitions + active instances
 * GET    /api/workers/:role        — Get definition for a role
 * GET    /api/workers/active       — List active worker instances
 */

import type { FastifyInstance } from 'fastify';
import type { AppContext } from '../server.js';

export function registerWorkerRoutes(app: FastifyInstance, ctx: AppContext): void {
  /**
   * GET /api/workers — List all worker definitions.
   */
  app.get('/api/workers', async () => {
    const definitions = ctx.registry.getAllDefinitions();
    const active = ctx.registry.getActiveWorkers();

    return {
      success: true,
      data: {
        definitions: definitions.map((d) => ({
          role: d.role,
          name: d.name,
          description: d.description,
          skills: d.skills.length,
          toolsAllowed: d.tools.allowed.length || 'all',
          toolsDenied: d.tools.denied.length,
        })),
        active: active.map((w) => ({
          id: w.id,
          role: w.role,
          name: w.name,
          status: w.getStatus(),
        })),
        totalDefinitions: definitions.length,
        totalActive: active.length,
      },
    };
  });

  /**
   * GET /api/workers/active — List active workers.
   */
  app.get('/api/workers/active', async () => {
    const active = ctx.registry.getActiveWorkers();

    return {
      success: true,
      data: active.map((w) => ({
        id: w.id,
        role: w.role,
        name: w.name,
        status: w.getStatus(),
      })),
    };
  });

  /**
   * GET /api/workers/:role — Get definition for a specific role.
   */
  app.get<{ Params: { role: string } }>('/api/workers/:role', async (request, reply) => {
    // Skip if this matches the "active" static route
    if (request.params.role === 'active') return;

    const def = ctx.registry.getDefinition(request.params.role as any);

    if (!def) {
      return reply.code(404).send({
        error: 'Not Found',
        message: `No worker definition found for role: ${request.params.role}`,
        statusCode: 404,
      });
    }

    return {
      success: true,
      data: {
        role: def.role,
        name: def.name,
        description: def.description,
        skills: def.skills,
        tools: def.tools,
        prompt: {
          expertise: def.prompt.expertise,
          responsibilities: def.prompt.responsibilities,
          artifacts: def.prompt.artifacts,
        },
      },
    };
  });
}
