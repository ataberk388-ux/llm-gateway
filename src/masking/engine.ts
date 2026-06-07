import type { IDetector, DetectionResult, MaskResult, EntityType } from './types';
import type { Tokenizer } from './tokenizer';
import type { SessionStore } from '../session/store';

export class MaskingEngine {
  constructor(
    private readonly detectors: IDetector[],
    private readonly tokenizer: Tokenizer,
    private readonly store: SessionStore
  ) {}

  mask(text: string, sessionId: string): MaskResult {
    const allResults = this.detectors
      .filter((d) => d.enabled)
      .flatMap((d) => d.detect(text));

    const nonOverlapping = this.deduplicateSpans(allResults);
    nonOverlapping.sort((a, b) => b.start - a.start);

    const counts: Partial<Record<EntityType, number>> = {};
    let maskedText = text;

    for (const result of nonOverlapping) {
      const token = this.tokenizer.getOrCreate(
        sessionId,
        result.entityType,
        result.value
      );
      maskedText =
        maskedText.slice(0, result.start) + token + maskedText.slice(result.end);
      counts[result.entityType] = (counts[result.entityType] ?? 0) + 1;
    }

    return { maskedText, entityCounts: counts };
  }

  restore(text: string, sessionId: string): string {
    const mapping = this.store.getMapping(sessionId);
    if (!mapping) return text;
    return text.replace(/\[[A-Z_]+_\d+\]/g, (token) => mapping.get(token) ?? token);
  }

  maskMessages(
    messages: Array<{ role: string; content: string }>,
    sessionId: string
  ): {
    maskedMessages: Array<{ role: string; content: string }>;
    aggregatedCounts: Partial<Record<EntityType, number>>;
  } {
    const aggregatedCounts: Partial<Record<EntityType, number>> = {};
    const maskedMessages = messages.map((msg) => {
      const { maskedText, entityCounts } = this.mask(msg.content, sessionId);
      for (const [k, v] of Object.entries(entityCounts) as [EntityType, number][]) {
        aggregatedCounts[k] = (aggregatedCounts[k] ?? 0) + v;
      }
      return { ...msg, content: maskedText };
    });
    return { maskedMessages, aggregatedCounts };
  }

  /**
   * Bidirectional masking: scan the (already-restored) LLM response for new PII
   * that was NOT present in the original user request.
   * Any such PII is replaced with [REDACTED_TYPE] before returning to the client.
   */
  scanAndRedact(
    text: string,
    sessionId: string
  ): { redactedText: string; newPiiCount: number } {
    const mapping = this.store.getMapping(sessionId);

    const allResults = this.detectors
      .filter((d) => d.enabled)
      .flatMap((d) => d.detect(text));

    const nonOverlapping = this.deduplicateSpans(allResults);
    nonOverlapping.sort((a, b) => b.start - a.start);

    let redactedText = text;
    let newPiiCount = 0;

    for (const result of nonOverlapping) {
      // If this value was already in the session (came from user input), keep it
      const isKnown = mapping?.reverseGet(result.value) !== undefined;
      if (!isKnown) {
        redactedText =
          redactedText.slice(0, result.start) +
          `[REDACTED_${result.entityType}]` +
          redactedText.slice(result.end);
        newPiiCount++;
      }
    }

    return { redactedText, newPiiCount };
  }

  /** Expose the store so callers can access mapping for StreamingRestorer. */
  getStore(): SessionStore {
    return this.store;
  }

  private deduplicateSpans(results: DetectionResult[]): DetectionResult[] {
    const sorted = [...results].sort((a, b) =>
      a.start !== b.start
        ? a.start - b.start
        : b.end - b.start - (a.end - a.start)
    );
    const kept: DetectionResult[] = [];
    let lastEnd = -1;
    for (const r of sorted) {
      if (r.start >= lastEnd) {
        kept.push(r);
        lastEnd = r.end;
      }
    }
    return kept;
  }
}
