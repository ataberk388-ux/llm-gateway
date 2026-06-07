import type { AuditRecord } from '../audit/types';
import type { RiskLevel } from '../masking/risk-scorer';

export interface StatsSnapshot {
  totalRequests: number;
  riskDistribution: Record<RiskLevel, number>;
  topEntityTypes: { type: string; count: number }[];
  providerCounts: Record<string, number>;
  totalNewPiiInResponse: number;
  averageLatencyMs: number;
  uptimeSeconds: number;
  activeSessions: number;
}

export class StatsCollector {
  private totalRequests = 0;
  private riskDistribution: Record<RiskLevel, number> = {
    LOW: 0,
    MEDIUM: 0,
    HIGH: 0,
    CRITICAL: 0,
  };
  private entityTypeCounts: Record<string, number> = {};
  private providerCounts: Record<string, number> = {};
  private totalNewPiiInResponse = 0;
  private totalLatencyMs = 0;
  private readonly startedAt = Date.now();

  record(audit: AuditRecord): void {
    this.totalRequests++;
    this.riskDistribution[audit.riskLevel]++;
    this.totalNewPiiInResponse += audit.newPiiInResponse;
    this.totalLatencyMs += audit.latencyMs;
    this.providerCounts[audit.provider] =
      (this.providerCounts[audit.provider] ?? 0) + 1;

    for (const [type, count] of Object.entries(audit.entityCounts)) {
      this.entityTypeCounts[type] = (this.entityTypeCounts[type] ?? 0) + count;
    }
  }

  snapshot(activeSessions: number): StatsSnapshot {
    const topEntityTypes = Object.entries(this.entityTypeCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([type, count]) => ({ type, count }));

    return {
      totalRequests: this.totalRequests,
      riskDistribution: { ...this.riskDistribution },
      topEntityTypes,
      providerCounts: { ...this.providerCounts },
      totalNewPiiInResponse: this.totalNewPiiInResponse,
      averageLatencyMs:
        this.totalRequests > 0
          ? Math.round(this.totalLatencyMs / this.totalRequests)
          : 0,
      uptimeSeconds: Math.floor((Date.now() - this.startedAt) / 1000),
      activeSessions,
    };
  }
}
