import Redis from 'ioredis';
import { SessionStore, TokenMapping } from './store';

const KEY_PREFIX = 'gw:session:';

export class RedisSessionStore extends SessionStore {
  private readonly redis: Redis;

  constructor(ttlSeconds: number, redisUrl: string) {
    super(ttlSeconds);
    this.redis = new Redis(redisUrl, {
      lazyConnect: true,
      enableReadyCheck: false,
      maxRetriesPerRequest: 1,
    });
    // Suppress unhandled error events — caller gets errors via preload/persist
    this.redis.on('error', () => {});
  }

  /**
   * Load session from Redis into local memory cache before request processing.
   * No-op if session is already in memory (e.g., second turn of same conversation).
   */
  override async preload(sessionId: string): Promise<void> {
    if (this.sessions.has(sessionId)) return;
    try {
      const raw = await this.redis.get(`${KEY_PREFIX}${sessionId}`);
      if (raw) {
        const parsed = JSON.parse(raw) as {
          tokenToValue: Record<string, string>;
          typeCounts: Record<string, number>;
        };
        this.sessions.set(sessionId, TokenMapping.fromJSON(parsed));
      }
    } catch {
      // Redis unavailable — continue with empty local session (graceful degradation)
    }
  }

  /**
   * Persist updated session to Redis after request processing.
   * TTL is refreshed on every write (rolling expiry).
   */
  override async persist(sessionId: string): Promise<void> {
    const mapping = this.sessions.get(sessionId);
    if (!mapping) return;
    try {
      const ttlSeconds = Math.floor((this as unknown as { ttlMs: number }).ttlMs / 1000);
      await this.redis.setex(
        `${KEY_PREFIX}${sessionId}`,
        ttlSeconds,
        JSON.stringify(mapping.toJSON())
      );
    } catch {
      // Redis write failure — data stays in memory for this process lifetime
    }
  }

  override destroy(): void {
    super.destroy();
    void this.redis.quit();
  }
}
