import type { EntityType } from './types';

const ENTITY_WEIGHTS: Partial<Record<EntityType, number>> = {
  TC_ID: 25,
  IBAN: 25,
  CREDIT_CARD: 25,
  PATIENT_ID: 20,
  DIAGNOSIS_CODE: 15,
  MEDICATION: 10,
  EMAIL: 10,
  PHONE: 10,
  PERSON: 5,
  KEYWORD: 3,
};

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface RiskAssessment {
  score: number;
  level: RiskLevel;
}

/**
 * Compute a privacy risk score (0–100) from entity counts.
 * HIGH_RISK entities (TC, IBAN, card) score 25 pts each.
 * Score is capped at 100.
 */
export function assessRisk(
  entityCounts: Partial<Record<EntityType, number>>
): RiskAssessment {
  let score = 0;
  for (const [type, count] of Object.entries(entityCounts) as [EntityType, number][]) {
    const weight = ENTITY_WEIGHTS[type] ?? 5;
    score += weight * count;
  }
  score = Math.min(score, 100);

  const level: RiskLevel =
    score >= 75 ? 'CRITICAL' :
    score >= 50 ? 'HIGH' :
    score >= 20 ? 'MEDIUM' : 'LOW';

  return { score, level };
}
