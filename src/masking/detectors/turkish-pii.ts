import { RegexDetector } from './base';
import type { EntityType } from '../types';

function validateTCId(value: string): boolean {
  if (value[0] === '0') return false;
  const d = value.split('').map(Number);
  const sumOdd = d[0] + d[2] + d[4] + d[6] + d[8];
  const sumEven = d[1] + d[3] + d[5] + d[7];
  const d10 = ((7 * sumOdd) - sumEven) % 10;
  if (d10 < 0 || d10 !== d[9]) return false;
  const sumFirst10 = d.slice(0, 10).reduce((a, b) => a + b, 0);
  return sumFirst10 % 10 === d[10];
}

export class TcIdDetector extends RegexDetector {
  readonly entityType: EntityType = 'TC_ID';
  // 11 consecutive digits not adjacent to other digits
  protected readonly patterns = [/(?<!\d)([1-9]\d{10})(?!\d)/g];

  protected validate(value: string): boolean {
    return validateTCId(value);
  }
}

export class PhoneDetector extends RegexDetector {
  readonly entityType: EntityType = 'PHONE';
  protected readonly patterns = [
    // Mobil: +90 5XX, 0090 5XX, 0 5XX, bare 5XX
    /(?:\+90|0090|0)\s*[\s\-\(]?5\d{2}[\s\-\)]*\d{3}[\s\-]*\d{2}[\s\-]*\d{2}/g,
    // Sabit hat: +90 (2XX/3XX/4XX)
    /\+90\s*[\s\-\(]?[2-4]\d{2}[\s\-\)]*\d{3}[\s\-]*\d{2}[\s\-]*\d{2}/g,
  ];
}

export class EmailDetector extends RegexDetector {
  readonly entityType: EntityType = 'EMAIL';
  protected readonly patterns = [
    /\b[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}\b/g,
  ];
}

// Pattern-based name detection — reasonable baseline, high false positive risk.
// For production accuracy, replace with a proper Turkish NER model.
export class PersonDetector extends RegexDetector {
  readonly entityType: EntityType = 'PERSON';
  // Requires honorific context to reduce false positives
  protected readonly patterns = [
    /(?:Sayın|Bay|Bayan|Dr\.|Av\.|Doç\.Dr\.|Prof\.Dr\.|Uzm\.)\s+([A-ZÇĞİÖŞÜ][a-zçğışöüA-ZÇĞİÖŞÜ'-]+(?:\s+[A-ZÇĞİÖŞÜ][a-zçğışöüA-ZÇĞİÖŞÜ'-]+){0,2})/g,
  ];
}
