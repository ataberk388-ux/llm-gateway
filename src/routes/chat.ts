import type { FastifyInstance } from 'fastify';
import type { MaskingEngine } from '../masking/engine';
import type { ILLMAdapter, LLMMessage } from '../providers/adapter';
import type { AuditLogger } from '../audit/logger';
import type { SessionStore } from '../session/store';
import type { StatsCollector } from '../stats/collector';
import type { ComplianceReporter } from '../compliance/reporter';
import type { WebhookAlerter } from '../alerts/webhooks';
import type { RoutingEngine } from '../routing/engine';
import type { AuditRecord } from '../audit/types';
import { StreamingRestorer } from '../masking/streaming-restorer';
import { assessRisk } from '../masking/risk-scorer';

interface ChatBody {
  conversationId?: string;
  model?: string;
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
  maxTokens?: number;
  temperature?: number;
  stream?: boolean;
}

export interface ChatRouteOptions {
  engine: MaskingEngine;
  provider: ILLMAdapter;
  auditLogger: AuditLogger;
  store: SessionStore;
  defaultModel: string;
  stats: StatsCollector;
  compliance: ComplianceReporter;
  alerter?: WebhookAlerter;
  routing?: RoutingEngine;
}

const bodySchema = {
  type: 'object',
  required: ['messages'],
  properties: {
    conversationId: { type: 'string' },
    model: { type: 'string' },
    messages: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        required: ['role', 'content'],
        properties: {
          role: { type: 'string', enum: ['user', 'assistant', 'system'] },
          content: { type: 'string' },
        },
      },
    },
    maxTokens: { type: 'number', minimum: 1 },
    temperature: { type: 'number', minimum: 0, maximum: 2 },
    stream: { type: 'boolean' },
  },
};

export async function chatRoute(
  app: FastifyInstance,
  opts: ChatRouteOptions
): Promise<void> {
  const {
    engine,
    provider,
    auditLogger,
    store,
    defaultModel,
    stats,
    compliance,
    alerter,
    routing,
  } = opts;

  app.post<{ Body: ChatBody }>(
    '/v1/chat',
    { schema: { body: bodySchema } },
    async (request, reply) => {
      const t0 = Date.now();
      const { conversationId, model, messages, maxTokens, temperature, stream } =
        request.body;

      const sessionId = conversationId ?? request.id;
      const clientId = request.clientId ?? 'unknown';

      // Load session from Redis (no-op for in-memory store)
      await store.preload(sessionId);

      const { maskedMessages, aggregatedCounts } = engine.maskMessages(
        messages as LLMMessage[],
        sessionId
      );

      const risk = assessRisk(aggregatedCounts);

      // Multi-provider routing: reject or override model based on risk
      const llmRequest = {
        model: model ?? defaultModel,
        messages: maskedMessages as LLMMessage[],
        maxTokens,
        temperature,
        stream: stream ?? false,
      };

      if (routing) {
        const decision = routing.decide(
          risk.level,
          aggregatedCounts as Record<string, number>
        );
        if (decision.rejected) {
          return reply.code(451).send({
            error: 'Request blocked by routing policy',
            reason: decision.rejectReason,
            riskLevel: risk.level,
            riskScore: risk.score,
          });
        }
        if (decision.overrideModel) {
          llmRequest.model = decision.overrideModel;
        }
      }

      const recordAudit = async (newPiiCount: number): Promise<void> => {
        const latencyMs = Date.now() - t0;
        const auditRecord: AuditRecord = {
          requestId: request.id,
          clientId,
          entityCounts: aggregatedCounts as Record<string, number>,
          riskScore: risk.score,
          riskLevel: risk.level,
          newPiiInResponse: newPiiCount,
          provider: provider.providerName,
          model: llmRequest.model,
          latencyMs,
          timestamp: new Date().toISOString(),
        };
        auditLogger.record(auditRecord);
        stats.record(auditRecord);
        compliance.addRecord(auditRecord);
        await alerter?.maybeAlert(auditRecord, (msg) =>
          app.log.warn({ msg }, 'alert')
        );
      };

      // ─── Non-streaming path ─────────────────────────────────────────────
      if (!stream) {
        const response = await provider.complete(llmRequest);

        // 1. Restore session tokens
        const restoredContent = engine.restore(response.content, sessionId);

        // 2. Bidirectional scan: redact any NEW PII the LLM generated
        const { redactedText, newPiiCount } = engine.scanAndRedact(
          restoredContent,
          sessionId
        );

        // Persist session to Redis (no-op for in-memory)
        await store.persist(sessionId);

        await recordAudit(newPiiCount);

        reply
          .header('X-Privacy-Risk-Score', String(risk.score))
          .header('X-Privacy-Risk-Level', risk.level)
          .header('X-New-Pii-In-Response', String(newPiiCount));

        return { ...response, content: redactedText };
      }

      // ─── Streaming SSE path ─────────────────────────────────────────────
      reply.hijack();
      const raw = reply.raw;
      raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
        'X-Privacy-Risk-Score': String(risk.score),
        'X-Privacy-Risk-Level': risk.level,
      });

      // Build a snapshot of the token map for real-time restoration
      const mapping = store.getMapping(sessionId);
      const tokenMap: ReadonlyMap<string, string> =
        mapping ? mapping.toMap() : new Map<string, string>();
      const restorer = new StreamingRestorer(tokenMap);

      // Accumulate full text for bidirectional scan at stream end
      let fullRestoredText = '';

      try {
        for await (const chunk of provider.completeStream(llmRequest)) {
          const restored = restorer.push(chunk);
          if (restored) {
            fullRestoredText += restored;
            raw.write(`data: ${JSON.stringify({ delta: restored })}\n\n`);
          }
        }

        // Flush remaining buffer (handles mid-token at stream boundary)
        const tail = restorer.finalize();
        if (tail) {
          fullRestoredText += tail;
          raw.write(`data: ${JSON.stringify({ delta: tail })}\n\n`);
        }

        await store.persist(sessionId);

        // Bidirectional scan on the full accumulated text
        const { newPiiCount } = engine.scanAndRedact(fullRestoredText, sessionId);

        await recordAudit(newPiiCount);

        // If LLM hallucinated new PII, warn the client with the safe full text
        if (newPiiCount > 0) {
          const { redactedText } = engine.scanAndRedact(fullRestoredText, sessionId);
          raw.write(
            `data: ${JSON.stringify({
              event: 'redact',
              reason: `${newPiiCount} new PII entity(s) detected in response`,
              safeContent: redactedText,
            })}\n\n`
          );
        }

        raw.write('data: [DONE]\n\n');
      } catch (err) {
        app.log.error({ err, requestId: request.id }, 'Stream error');
        raw.write(`data: ${JSON.stringify({ error: 'Stream error' })}\n\n`);
      } finally {
        raw.end();
      }
    }
  );
}
