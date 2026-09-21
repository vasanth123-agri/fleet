interface CacheItem<T> {
  data: T;
  freshUntil: number;
  staleUntil: number;
}

class InMemoryCache {
  private cache = new Map<string, CacheItem<any>>();
  private inFlight = new Map<string, Promise<any>>();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Run cleanup every 60 seconds
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000);
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  get<T>(key: string): T | null {
    const item = this.cache.get(key);
    if (!item) return null;

    // Hard expired
    if (Date.now() > item.staleUntil) {
      this.cache.delete(key);
      return null;
    }

    return item.data as T;
  }

  set<T>(key: string, data: T, ttlSeconds: number = 30, staleGraceSeconds: number = 60): void {
    const now = Date.now();
    this.cache.set(key, {
      data,
      freshUntil: now + ttlSeconds * 1000,
      staleUntil: now + (ttlSeconds + staleGraceSeconds) * 1000,
    });
  }

  /**
   * Fetch with Stale-While-Revalidate and Request Deduplication.
   * If fresh cached data exists -> return immediately (<1ms).
   * If stale data exists -> return stale data immediately and revalidate in background.
   * If no cached data exists -> deduplicate in-flight requests and fetch.
   */
  async getOrFetch<T>(
    key: string,
    fetchFn: () => Promise<T>,
    ttlSeconds: number = 30,
    forceFresh: boolean = false,
    staleGraceSeconds: number = 60
  ): Promise<T> {
    const now = Date.now();
    const cached = this.cache.get(key);

    if (!forceFresh && cached) {
      // If still fresh, return immediately
      if (now <= cached.freshUntil) {
        return cached.data as T;
      }

      // If in stale grace period, serve stale immediately and trigger background refresh
      if (now <= cached.staleUntil) {
        // Trigger background refresh if not already in flight
        if (!this.inFlight.has(key)) {
          const bgPromise = fetchFn()
            .then((freshData) => {
              this.set(key, freshData, ttlSeconds, staleGraceSeconds);
              return freshData;
            })
            .catch((err) => {
              console.error(`Background cache refresh failed for [${key}]:`, err);
            })
            .finally(() => {
              this.inFlight.delete(key);
            });
          this.inFlight.set(key, bgPromise);
        }
        return cached.data as T;
      }
    }

    // No cache or hard expired or forceFresh: check if already in flight to deduplicate
    if (this.inFlight.has(key) && !forceFresh) {
      return this.inFlight.get(key) as Promise<T>;
    }

    const fetchPromise = (async () => {
      try {
        const data = await fetchFn();
        this.set(key, data, ttlSeconds, staleGraceSeconds);
        return data;
      } finally {
        this.inFlight.delete(key);
      }
    })();

    this.inFlight.set(key, fetchPromise);
    return fetchPromise;
  }

  del(key: string): void {
    this.cache.delete(key);
  }

  flushByPrefix(prefix: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }

  clear(): void {
    this.cache.clear();
    this.inFlight.clear();
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, item] of this.cache.entries()) {
      if (now > item.staleUntil) {
        this.cache.delete(key);
      }
    }
  }
}

export const memoryCache = new InMemoryCache();
