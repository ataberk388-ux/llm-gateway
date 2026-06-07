import type { FastifyInstance } from 'fastify';
import type { ApiKeyEntry } from '../config/types';

declare module 'fastify' {
  interface FastifyRequest {
    clientId: string;
  }
}

export async function registerApiKeyAuth(
  app: FastifyInstance,
  apiKeys: ApiKeyEntry[]
): Promise<void> {
  const keyMap = new Map(apiKeys.map((k) => [k.key, k.clientId]));

  app.addHook('onRequest', async (request, reply) => {
    if (request.url.startsWith('/health')) return;
    // Admin routes use their own X-Admin-Key authentication
    if (request.url.startsWith('/admin')) return;

    const key = request.headers['x-gateway-api-key'];
    if (!key || typeof key !== 'string') {
      return reply.code(401).send({ error: 'Missing X-Gateway-API-Key header' });
    }
    const clientId = keyMap.get(key);
    if (!clientId) {
      return reply.code(401).send({ error: 'Invalid API key' });
    }
    request.clientId = clientId;
  });
}
