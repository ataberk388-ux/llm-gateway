import { RegexDetector } from './base';
import type { DetectionResult, EntityType, IDetector } from '../types';

export class DiagnosisCodeDetector extends RegexDetector {
  readonly entityType: EntityType = 'DIAGNOSIS_CODE';
  // ICD-10 format: letter + 2 digits + optional decimal extension
  protected readonly patterns = [/\b[A-Z]\d{2}(?:\.\d{1,4})?\b/g];
}

export class PatientIdDetector extends RegexDetector {
  readonly entityType: EntityType = 'PATIENT_ID';
  protected readonly patterns = [
    /\bMRN[-:\s]?\d{6,10}\b/gi,
    /\bPT[-:\s]?\d{6,10}\b/gi,
    /\bPatient\s+ID[-:\s]?\d{6,10}\b/gi,
  ];
}

export class MedicationDetector implements IDetector {
  readonly entityType: EntityType = 'MEDICATION';
  readonly enabled: boolean;
  private pattern: RegExp | null = null;

  constructor(enabled: boolean, medications: string[]) {
    this.enabled = enabled;
    if (medications.length > 0) {
      const escaped = medications.map((m) =>
        m.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      );
      this.pattern = new RegExp(`\\b(${escaped.join('|')})\\b`, 'gi');
    }
  }

  detect(text: string): DetectionResult[] {
    if (!this.enabled || !this.pattern) return [];
    const results: DetectionResult[] = [];
    this.pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = this.pattern.exec(text)) !== null) {
      results.push({
        entityType: this.entityType,
        start: match.index,
        end: match.index + match[0].length,
        value: match[0],
        confidence: 1.0,
      });
    }
    return results;
  }
}
