import type { AuditRecord } from '../audit/types';
import type { AlertsConfig } from '../config/types';

export type AlertEvent = 'CRITICAL_RISK' | 'NEW_PII_IN_RESPONSE';

export class WebhookAlerter {
  constructor(private readonly config: AlertsConfig) {}

  async maybeAlert(audit: AuditRecord, log?: (msg: string) => void): Promise<void> {
    if (!this.config.enabled) return;

    const events: AlertEvent[] = [];
    if (audit.riskLevel === 'CRITICAL') events.push('CRITICAL_RISK');
    if (audit.newPiiInResponse > 0) events.push('NEW_PII_IN_RESPONSE');
    if (events.length === 0) return;

    for (const webhook of this.config.webhooks) {
      const matching = events.filter((e) => webhook.events.includes(e));
      if (matching.length === 0) continue;

      this.send(webhook.url, webhook.name, audit, matching).catch((err) => {
        log?.(`Webhook ${webhook.name} failed: ${String(err)}`);
      });
    }
  }

  private async send(
    url: string,
    name: string,
    audit: AuditRecord,
    events: AlertEvent[]
  ): Promise<void> {
    const payload = {
      events,
      requestId: audit.requestId,
      clientId: audit.clientId,
      riskLevel: audit.riskLevel,
      riskScore: audit.riskScore,
      newPiiInResponse: audit.newPiiInResponse,
      entityCounts: audit.entityCounts,
      provider: audit.provider,
      model: audit.model,
      timestamp: audit.timestamp,
    };

    const isSlack = name === 'slack' || url.includes('hooks.slack.com');
    const body = isSlack
      ? {
          text: `🔴 *LLM Gateway Alert* [${events.join(', ')}]\n` +
            `Risk: ${audit.riskLevel} (${audit.riskScore}/100)\n` +
            `Client: ${audit.clientId} | Provider: ${audit.provider}\n` +
            `Entities: ${JSON.stringify(audit.entityCounts)}\n` +
            `Request ID: \`${audit.requestId}\``,
        }
      : payload;

    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5_000),
    });
  }
}
