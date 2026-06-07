import type { DetectionResult, EntityType, IDetector } from '../types';

export abstract class RegexDetector implements IDetector {
  abstract readonly entityType: EntityType;
  readonly enabled: boolean;
  protected abstract readonly patterns: RegExp[];

  constructor(enabled: boolean) {
    this.enabled = enabled;
  }

  detect(text: string): DetectionResult[] {
    if (!this.enabled) return [];
    const results: DetectionResult[] = [];

    for (const pattern of this.patterns) {
      pattern.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(text)) !== null) {
        if (this.validate(match[0])) {
          results.push({
            entityType: this.entityType,
            start: match.index,
            end: match.index + match[0].length,
            value: match[0],
            confidence: 1.0,
          });
        }
      }
    }

    return results;
  }

  protected validate(_value: string): boolean {
    return true;
  }
}
