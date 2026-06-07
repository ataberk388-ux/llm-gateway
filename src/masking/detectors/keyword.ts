import type { DetectionResult, EntityType, IDetector } from '../types';

export class KeywordDetector implements IDetector {
  readonly entityType: EntityType = 'KEYWORD';
  readonly enabled: boolean;
  private pattern: RegExp | null = null;

  constructor(enabled: boolean, blocklist: string[], caseSensitive: boolean) {
    this.enabled = enabled;
    if (blocklist.length > 0) {
      const escaped = blocklist.map((k) =>
        k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      );
      const flags = caseSensitive ? 'g' : 'gi';
      this.pattern = new RegExp(`\\b(${escaped.join('|')})\\b`, flags);
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
