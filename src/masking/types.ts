export type EntityType =
  | 'PERSON'
  | 'TC_ID'
  | 'EMAIL'
  | 'PHONE'
  | 'IBAN'
  | 'CREDIT_CARD'
  | 'DIAGNOSIS_CODE'
  | 'MEDICATION'
  | 'PATIENT_ID'
  | 'KEYWORD';

export interface DetectionResult {
  entityType: EntityType;
  start: number;
  end: number;
  value: string;
  confidence: number;
}

export interface IDetector {
  readonly entityType: EntityType;
  readonly enabled: boolean;
  detect(text: string): DetectionResult[];
}

export interface MaskResult {
  maskedText: string;
  entityCounts: Partial<Record<EntityType, number>>;
}
