import { getRedisClient, isRedisAvailable } from '../config/redis.js';

interface MemoryItem<T> {
  data: T;
  freshUntil: number;
  staleUntil: number;
}

export class HybridCacheManager {
  private memory = new Map<string, MemoryItem<any>>();
  private inFlight = new Map<string, Promise<any>>();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Clean expired items in memory every 60 seconds
    this.cleanupInterval = setInterval(() => {
      this.cleanupMemory();
    }, 60000);
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  private cleanupMemory(): void {
    const now = Date.now();
    for (const [key, item] of this.memory.entries()) {
      if (now > item.staleUntil) {
        this.memory.delete(key);
      }
    }
  }

  /**
   * Get an item from Redis (or in-memory fallback).
   */
  async get<T>(key: string): Promise<T | null> {
    const redis = getRedisClient();

    if (redis && isRedisAvailable()) {
      try {
        const raw = await redis.get(key);
        if (raw !== null) {
          return JSON.parse(raw) as T;
        }
      } catch (err: any) {
        // Fall back to memory on Redis read error
      }
    }

    const item = this.memory.get(key);
    if (!item) return null;

    if (Date.now() > item.staleUntil) {
      this.memory.delete(key);
      return null;
    }

    return item.data as T;
  }

  /**
   * Set an item in Redis with TTL and store in memory.
   */
  async set<T>(key: string, data: T, ttlSeconds: number = 60, staleGraceSeconds: number = 60): Promise<void> {
    const now = Date.now();

    // Store in L1 memory
    this.memory.set(key, {
      data,
      freshUntil: now + ttlSeconds * 1000,
      staleUntil: now + (ttlSeconds + staleGraceSeconds) * 1000,
    });

    const redis = getRedisClient();
    if (redis && isRedisAvailable()) {
      try {
        const serialized = JSON.stringify(data);
        await redis.setex(key, ttlSeconds + staleGraceSeconds, serialized);
      } catch (err: any) {
        // Ignore Redis set failures, memory cache already holds the data
      }
    }
  }

  /**
   * High performance fetch: Checks Redis -> Checks Memory -> Deduplicates in-flight -> Fetches DB.
   */
  async getOrFetch<T>(
    key: string,
    fetchFn: () => Promise<T>,
    ttlSeconds: number = 60,
    forceFresh: boolean = false,
    staleGraceSeconds: number = 60
  ): Promise<T> {
    const now = Date.now();

    if (!forceFresh) {
      // 1. Check local L1 memory first (<0.1ms)
      const memItem = this.memory.get(key);
      if (memItem) {
        if (now <= memItem.freshUntil) {
          return memItem.data as T;
        }
        if (now <= memItem.staleUntil) {
          // Stale-while-revalidate: return stale and refresh in background
          this.triggerBackgroundRefresh(key, fetchFn, ttlSeconds, staleGraceSeconds);
          return memItem.data as T;
        }
      }

      // 2. Check Redis (~1ms)
      const redis = getRedisClient();
      if (redis && isRedisAvailable()) {
        try {
          const raw = await redis.get(key);
          if (raw !== null) {
            const parsed = JSON.parse(raw) as T;
            // Update local memory
            this.memory.set(key, {
              data: parsed,
              freshUntil: now + ttlSeconds * 1000,
              staleUntil: now + (ttlSeconds + staleGraceSeconds) * 1000,
            });
            return parsed;
          }
        } catch {
          // Redis read error, proceed to fetch
        }
      }
    }

    // 3. Request deduplication: if request is already in-flight, return the existing promise
    if (this.inFlight.has(key) && !forceFresh) {
      return this.inFlight.get(key) as Promise<T>;
    }

    const fetchPromise = (async () => {
      try {
        const data = await fetchFn();
        await this.set(key, data, ttlSeconds, staleGraceSeconds);
        return data;
      } finally {
        this.inFlight.delete(key);
      }
    })();

    this.inFlight.set(key, fetchPromise);
    return fetchPromise;
  }

  private triggerBackgroundRefresh<T>(
    key: string,
    fetchFn: () => Promise<T>,
    ttlSeconds: number,
    staleGraceSeconds: number
  ): void {
    if (this.inFlight.has(key)) return;

    const bgPromise = fetchFn()
      .then(async (freshData) => {
        await this.set(key, freshData, ttlSeconds, staleGraceSeconds);
        return freshData;
      })
      .catch((err) => {
        console.error(`Background cache refresh failed for [${key}]:`, err.message);
      })
      .finally(() => {
        this.inFlight.delete(key);
      });

    this.inFlight.set(key, bgPromise);
  }

  /**
   * Delete a key from Redis and memory.
   */
  async del(key: string): Promise<void> {
    this.memory.delete(key);
    this.inFlight.delete(key);

    const redis = getRedisClient();
    if (redis && isRedisAvailable()) {
      try {
        await redis.del(key);
      } catch {
        // ignore
      }
    }
  }

  /**
   * Delete all keys starting with prefix from Redis and memory.
   */
  async flushByPrefix(prefix: string): Promise<void> {
    // Clear from memory
    for (const key of this.memory.keys()) {
      if (key.startsWith(prefix)) {
        this.memory.delete(key);
      }
    }

    const redis = getRedisClient();
    if (redis && isRedisAvailable()) {
      try {
        // Search keys matching prefix using scan to avoid blocking Redis
        let cursor = '0';
        do {
          const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', `*${prefix}*`, 'COUNT', 100);
          cursor = nextCursor;
          if (keys.length > 0) {
            // Remove prefix added by ioredis if any, ioredis handles keyPrefix automatically
            const cleanKeys = keys.map((k) => (k.startsWith(redis.options.keyPrefix || '') ? k.slice((redis.options.keyPrefix || '').length) : k));
            if (cleanKeys.length > 0) {
              await redis.del(...cleanKeys);
            }
          }
        } while (cursor !== '0');
      } catch (err: any) {
        console.warn(`Redis scan/del error on prefix "${prefix}":`, err.message);
      }
    }
  }

  /**
   * Wipe all cache.
   */
  async clear(): Promise<void> {
    this.memory.clear();
    this.inFlight.clear();

    const redis = getRedisClient();
    if (redis && isRedisAvailable()) {
      try {
        await this.flushByPrefix('');
      } catch {
        // ignore
      }
    }
  }

  /**
   * Get diagnostics about cache health and key counts.
   */
  async getDiagnostics(): Promise<{
    provider: 'redis' | 'memory-fallback';
    isRedisConnected: boolean;
    memoryKeysCount: number;
    redisPingMs: number | null;
  }> {
    const redis = getRedisClient();
    const redisReady = isRedisAvailable();
    let pingMs: number | null = null;

    if (redis && redisReady) {
      try {
        const start = Date.now();
        await redis.ping();
        pingMs = Date.now() - start;
      } catch {
        pingMs = null;
      }
    }

    return {
      provider: redisReady ? 'redis' : 'memory-fallback',
      isRedisConnected: redisReady,
      memoryKeysCount: this.memory.size,
      redisPingMs: pingMs,
    };
  }
}

export const hybridCache = new HybridCacheManager();
// Alias for backward compatibility with existing service imports
export const memoryCache = hybridCache;
export default hybridCache;
