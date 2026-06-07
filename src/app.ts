import Fastify from 'fastify';
import rateLimit from '@fastify/rate-limit';
import type { GatewayConfig, MaskingConfig } from './config/types';
import { registerApiKeyAuth } from './auth/apiKey';
import { errorHandler } from './middleware/errorHandler';
import { healthRoute } from './routes/health';
import { chatRoute } from './routes/chat';
import { adminRoute } from './routes/admin';
import { SessionStore } from './session/store';
import { RedisSessionStore } from './session/redis-store';
import { Tokenizer } from './masking/tokenizer';
import { MaskingEngine } from './masking/engine';
import { buildDetectors } from './masking/registry';
import { ProviderFactory } from './providers/factory';
import { AuditLogger } from './audit/logger';
import { StatsCollector } from './stats/collector';
import { ComplianceReporter } from './compliance/reporter';
import { WebhookAlerter } from './alerts/webhooks';
import { RoutingEngine } from './routing/engine';

export async function buildApp(
  gatewayConfig: GatewayConfig,
  maskingConfig: MaskingConfig
) {
  const app = Fastify({
    logger: {
      level: gatewayConfig.logging.level,
      transport: gatewayConfig.logging.prettyPrint
        ? { target: 'pino-pretty' }
        : undefined,
    },
    genReqId: () => crypto.randomUUID(),
  });

  await errorHandler(app);

  // Auth must be registered before rate-limit so clientId is available in keyGenerator
  await registerApiKeyAuth(app, gatewayConfig.auth.apiKeys);

  // Rate limiting — keyed per clientId (falls back to IP for health check)
  if (gatewayConfig.rateLimit?.enabled) {
    await app.register(rateLimit, {
      max: gatewayConfig.rateLimit.maxPerMinute,
      timeWindow: 60_000,
      keyGenerator: (request) => request.clientId ?? request.ip ?? 'anonymous',
      errorResponseBuilder: (_request, context) => ({
        error: 'Too many requests',
        retryAfter: context.after,
        limit: context.max,
      }),
      allowList: (request) =>
        request.url.startsWith('/health') || request.url.startsWith('/admin'),
    });
  }

  // Session store — Redis if configured, in-memory otherwise
  const redisUrl = gatewayConfig.redis?.url;
  const store: SessionStore = redisUrl
    ? new RedisSessionStore(gatewayConfig.session.ttlSeconds, redisUrl)
    : new SessionStore(gatewayConfig.session.ttlSeconds);

  const tokenizer = new Tokenizer(store);
  const detectors = buildDetectors(maskingConfig);
  const engine = new MaskingEngine(detectors, tokenizer, store);
  const provider = ProviderFactory.create(gatewayConfig);
  const auditLogger = new AuditLogger(app.log);

  // Observability & compliance
  const stats = new StatsCollector();
  const compliance = new ComplianceReporter();

  // Optional alerting
  const alerter = gatewayConfig.alerts?.enabled
    ? new WebhookAlerter(gatewayConfig.alerts)
    : undefined;

  // Optional routing engine
  const routing = gatewayConfig.routing
    ? new RoutingEngine(gatewayConfig.routing)
    : undefined;

  await app.register(healthRoute);

  // Admin dashboard (enabled by default, disable with admin.enabled=false)
  if (gatewayConfig.admin?.enabled !== false) {
    await app.register(adminRoute, {
      stats,
      store,
      compliance,
      adminKey: gatewayConfig.admin?.adminKey,
    });
  }

  await app.register(chatRoute, {
    engine,
    provider,
    auditLogger,
    store,
    defaultModel: ProviderFactory.getDefaultModel(gatewayConfig),
    stats,
    compliance,
    alerter,
    routing,
  });

  const cleanup = () => store.destroy();
  process.once('SIGINT', cleanup);
  process.once('SIGTERM', cleanup);

  return app;
}
