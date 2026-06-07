import type { RiskLevel } from '../masking/risk-scorer';
import type { RoutingConfig } from '../config/types';

export interface RoutingDecision {
  rejected: boolean;
  rejectReason?: string;
  overrideModel?: string;
}

export class RoutingEngine {
  constructor(private readonly config: RoutingConfig) {}

  decide(
    riskLevel: RiskLevel,
    entityCounts: Record<string, number>
  ): RoutingDecision {
    // Risk-based rejection: block CRITICAL requests from reaching cloud
    if (this.config.rejectCritical && riskLevel === 'CRITICAL') {
      return {
        rejected: true,
        rejectReason:
          'CRITICAL risk seviyesinde istek bulut LLM\'e iletilmez. ' +
          'Veriler yerel sistemde işlenmelidir.',
      };
    }

    // Cost optimisation: downgrade to cheaper model for no-PII LOW-risk requests
    if (
      this.config.costOptimize &&
      riskLevel === 'LOW' &&
      this.config.cheapModel
    ) {
      const totalEntities = Object.values(entityCounts).reduce((a, b) => a + b, 0);
      if (totalEntities === 0) {
        return { rejected: false, overrideModel: this.config.cheapModel };
      }
    }

    return { rejected: false };
  }
}
