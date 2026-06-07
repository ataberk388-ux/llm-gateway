import type { RiskLevel } from '../masking/risk-scorer';

export interface AuditRecord {
  requestId: string;
  clientId: string;
  entityCounts: Record<string, number>;
  riskScore: number;
  riskLevel: RiskLevel;
  newPiiInResponse: number;
  provider: string;
  model: string;
  latencyMs: number;
  timestamp: string;
}
