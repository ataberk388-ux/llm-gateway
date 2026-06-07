import type { FastifyInstance } from 'fastify';

export async function errorHandler(app: FastifyInstance): Promise<void> {
  app.setErrorHandler(async (error: unknown, request, reply) => {
    const err = error as { statusCode?: number; message?: string };
    const statusCode = err.statusCode ?? 500;
    app.log.error({ requestId: request.id, err: error }, 'Request error');
    return reply.code(statusCode).send({
      error: statusCode >= 500 ? 'Internal server error' : (err.message ?? 'Unknown error'),
    });
  });
}
