import type { AuditRecord } from '../audit/types';
import type { RiskLevel } from '../masking/risk-scorer';

const MAX_BUFFER = 1_000;

export interface EntityStat {
  type: string;
  total: number;
  avgPerRequest: number;
}

export interface ComplianceReport {
  generatedAt: string;
  periodStart: string;
  periodEnd: string;
  totalRequests: number;
  riskDistribution: Record<RiskLevel, number>;
  riskDistributionPct: Record<RiskLevel, string>;
  entityTypeStats: EntityStat[];
  newPiiInResponseTotal: number;
  newPiiInResponseRate: string;
  providerBreakdown: Record<string, number>;
  averageLatencyMs: number;
  complianceStatus: {
    kvkk: 'COMPLIANT' | 'REVIEW_NEEDED';
    gdpr: 'COMPLIANT' | 'REVIEW_NEEDED';
    hipaa: 'COMPLIANT' | 'REVIEW_NEEDED';
  };
  recommendations: string[];
}

export class ComplianceReporter {
  private buffer: AuditRecord[] = [];

  addRecord(audit: AuditRecord): void {
    this.buffer.push(audit);
    if (this.buffer.length > MAX_BUFFER) this.buffer.shift();
  }

  generateReport(): ComplianceReport {
    const now = new Date().toISOString();
    const records = this.buffer;
    const total = records.length;

    if (total === 0) return this.emptyReport(now);

    const riskDist: Record<RiskLevel, number> = {
      LOW: 0,
      MEDIUM: 0,
      HIGH: 0,
      CRITICAL: 0,
    };
    const entityTotals: Record<string, number> = {};
    const providerCounts: Record<string, number> = {};
    let totalNewPii = 0;
    let totalLatency = 0;

    for (const r of records) {
      riskDist[r.riskLevel]++;
      totalNewPii += r.newPiiInResponse;
      totalLatency += r.latencyMs;
      providerCounts[r.provider] = (providerCounts[r.provider] ?? 0) + 1;
      for (const [type, count] of Object.entries(r.entityCounts)) {
        entityTotals[type] = (entityTotals[type] ?? 0) + count;
      }
    }

    const entityTypeStats: EntityStat[] = Object.entries(entityTotals)
      .sort(([, a], [, b]) => b - a)
      .map(([type, t]) => ({
        type,
        total: t,
        avgPerRequest: Math.round((t / total) * 100) / 100,
      }));

    const riskDistributionPct: Record<RiskLevel, string> = {
      LOW: pct(riskDist.LOW, total),
      MEDIUM: pct(riskDist.MEDIUM, total),
      HIGH: pct(riskDist.HIGH, total),
      CRITICAL: pct(riskDist.CRITICAL, total),
    };

    const criticalRate = riskDist.CRITICAL / total;
    const newPiiRate = totalNewPii / total;

    const recommendations: string[] = [];
    if (criticalRate > 0.1)
      recommendations.push(
        "CRITICAL riskli istekler %10'u aşıyor — routing.rejectCritical=true yapılandırmasını değerlendirin"
      );
    if (newPiiRate > 0.05)
      recommendations.push(
        "LLM yanıtlarında yeni PII tespit oranı yüksek — bidirectional masking sıkılaştırılabilir"
      );
    if ((riskDist.HIGH + riskDist.CRITICAL) / total > 0.3)
      recommendations.push(
        "Yüksek riskli istek oranı %30'u geçiyor — maskeleme konfigürasyonunu gözden geçirin"
      );
    if (recommendations.length === 0)
      recommendations.push('Tüm uyumluluk göstergeleri kabul edilebilir aralıkta');

    return {
      generatedAt: now,
      periodStart: records[0].timestamp,
      periodEnd: records[total - 1].timestamp,
      totalRequests: total,
      riskDistribution: riskDist,
      riskDistributionPct,
      entityTypeStats,
      newPiiInResponseTotal: totalNewPii,
      newPiiInResponseRate: pct(totalNewPii, total),
      providerBreakdown: providerCounts,
      averageLatencyMs: Math.round(totalLatency / total),
      complianceStatus: {
        kvkk: criticalRate === 0 ? 'COMPLIANT' : 'REVIEW_NEEDED',
        gdpr: newPiiRate <= 0.01 ? 'COMPLIANT' : 'REVIEW_NEEDED',
        hipaa: riskDist.CRITICAL === 0 ? 'COMPLIANT' : 'REVIEW_NEEDED',
      },
      recommendations,
    };
  }

  private emptyReport(now: string): ComplianceReport {
    return {
      generatedAt: now,
      periodStart: now,
      periodEnd: now,
      totalRequests: 0,
      riskDistribution: { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 },
      riskDistributionPct: { LOW: '0%', MEDIUM: '0%', HIGH: '0%', CRITICAL: '0%' },
      entityTypeStats: [],
      newPiiInResponseTotal: 0,
      newPiiInResponseRate: '0%',
      providerBreakdown: {},
      averageLatencyMs: 0,
      complianceStatus: { kvkk: 'COMPLIANT', gdpr: 'COMPLIANT', hipaa: 'COMPLIANT' },
      recommendations: ['Henüz işlenmiş istek yok'],
    };
  }
}

function pct(n: number, total: number): string {
  if (total === 0) return '0%';
  return `${Math.round((n / total) * 100)}%`;
}
