/**
 * Artifact routes.
 *
 * GET /api/artifacts          — List artifacts
 * GET /api/artifacts/:id      — Get artifact details
 */

import type { FastifyInstance } from 'fastify';
import type { AppContext } from '../server.js';

export function registerArtifactRoutes(app: FastifyInstance, ctx: AppContext): void {
  /**
   * GET /api/artifacts — List artifacts (requires artifactStore).
   */
  app.get<{ Querystring: { type?: string; projectId?: string } }>(
    '/api/artifacts',
    async (request, reply) => {
      const store = ctx.deps.artifactStore;

      if (!store) {
        return reply.code(501).send({
          error: 'Not Implemented',
          message: 'Artifact store not configured.',
          statusCode: 501,
        });
      }

      const artifacts = store.list(
        request.query.projectId ?? '',
        request.query.type as any,
      );

      return {
        success: true,
        data: artifacts,
        total: artifacts.length,
      };
    },
  );

  /**
   * GET /api/artifacts/:id — Get artifact by ID.
   */
  app.get<{ Params: { id: string } }>('/api/artifacts/:id', async (request, reply) => {
    const store = ctx.deps.artifactStore;

    if (!store) {
      return reply.code(501).send({
        error: 'Not Implemented',
        message: 'Artifact store not configured.',
        statusCode: 501,
      });
    }

    const artifact = store.get(request.params.id);

    if (!artifact) {
      return reply.code(404).send({
        error: 'Not Found',
        message: `Artifact ${request.params.id} not found.`,
        statusCode: 404,
      });
    }

    return {
      success: true,
      data: artifact,
    };
  });
}
