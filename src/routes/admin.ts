import type { FastifyInstance } from 'fastify';
import type { StatsCollector } from '../stats/collector';
import type { SessionStore } from '../session/store';
import type { ComplianceReporter } from '../compliance/reporter';

export interface AdminRouteOptions {
  stats: StatsCollector;
  store: SessionStore;
  compliance: ComplianceReporter;
  adminKey?: string;
}

export async function adminRoute(
  app: FastifyInstance,
  opts: AdminRouteOptions
): Promise<void> {
  const { stats, store, compliance, adminKey } = opts;

  app.addHook('onRequest', async (request, reply) => {
    if (!adminKey) return; // No key configured → open in dev mode
    if (request.headers['x-admin-key'] !== adminKey) {
      return reply.code(403).send({ error: 'Invalid X-Admin-Key header' });
    }
  });

  app.get('/admin/stats', async () => {
    return stats.snapshot(store.activeSessionCount());
  });

  app.get('/admin/compliance-report', async () => {
    return compliance.generateReport();
  });
}
