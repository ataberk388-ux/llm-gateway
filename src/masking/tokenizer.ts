import type { EntityType } from './types';
import type { SessionStore } from '../session/store';

export class Tokenizer {
  constructor(private readonly store: SessionStore) {}

  getOrCreate(sessionId: string, entityType: EntityType, value: string): string {
    const mapping = this.store.getOrCreateMapping(sessionId);

    // Same value in the same session always gets the same token
    const existing = mapping.reverseGet(value);
    if (existing) return existing;

    const count = mapping.countByType(entityType) + 1;
    const token = `[${entityType}_${count}]`;
    mapping.set(token, value);
    return token;
  }
}
