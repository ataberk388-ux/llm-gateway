import type { EntityType } from '../masking/types';

export class TokenMapping {
  private tokenToValue = new Map<string, string>();
  private valueToToken = new Map<string, string>();
  private typeCounts = new Map<string, number>();
  public readonly createdAt = Date.now();
  public lastAccessedAt = Date.now();

  set(token: string, value: string): void {
    this.tokenToValue.set(token, value);
    this.valueToToken.set(value, token);
    const entityType = token.slice(1, token.lastIndexOf('_'));
    this.typeCounts.set(entityType, (this.typeCounts.get(entityType) ?? 0) + 1);
    this.lastAccessedAt = Date.now();
  }

  get(token: string): string | undefined {
    this.lastAccessedAt = Date.now();
    return this.tokenToValue.get(token);
  }

  reverseGet(value: string): string | undefined {
    return this.valueToToken.get(value);
  }

  countByType(entityType: EntityType): number {
    return this.typeCounts.get(entityType) ?? 0;
  }

  /** Snapshot for streaming restorer (read-only view). */
  toMap(): ReadonlyMap<string, string> {
    return this.tokenToValue;
  }

  toJSON(): { tokenToValue: Record<string, string>; typeCounts: Record<string, number> } {
    return {
      tokenToValue: Object.fromEntries(this.tokenToValue),
      typeCounts: Object.fromEntries(this.typeCounts),
    };
  }

  static fromJSON(data: {
    tokenToValue: Record<string, string>;
    typeCounts: Record<string, number>;
  }): TokenMapping {
    const m = new TokenMapping();
    for (const [token, value] of Object.entries(data.tokenToValue)) {
      m.tokenToValue.set(token, value);
      m.valueToToken.set(value, token);
    }
    for (const [type, count] of Object.entries(data.typeCounts)) {
      m.typeCounts.set(type, count);
    }
    return m;
  }
}

export class SessionStore {
  protected sessions = new Map<string, TokenMapping>();
  private readonly ttlMs: number;
  private evictionTimer: NodeJS.Timeout;

  constructor(ttlSeconds: number) {
    this.ttlMs = ttlSeconds * 1000;
    this.evictionTimer = setInterval(() => this.evict(), 60_000);
    this.evictionTimer.unref();
  }

  getOrCreateMapping(sessionId: string): TokenMapping {
    let mapping = this.sessions.get(sessionId);
    if (!mapping) {
      mapping = new TokenMapping();
      this.sessions.set(sessionId, mapping);
    }
    return mapping;
  }

  getMapping(sessionId: string): TokenMapping | undefined {
    return this.sessions.get(sessionId);
  }

  /** Override in subclasses to load session data before a request. */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async preload(_sessionId: string): Promise<void> {}

  /** Override in subclasses to persist session data after a request. */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async persist(_sessionId: string): Promise<void> {}

  private evict(): void {
    const now = Date.now();
    for (const [id, mapping] of this.sessions) {
      if (now - mapping.lastAccessedAt > this.ttlMs) {
        this.sessions.delete(id);
      }
    }
  }

  activeSessionCount(): number {
    return this.sessions.size;
  }

  destroy(): void {
    clearInterval(this.evictionTimer);
    this.sessions.clear();
  }
}
