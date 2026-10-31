import { Request, Response, NextFunction } from 'express';
import { hybridCache } from '../utils/cache.js';
import { isRedisAvailable } from '../config/redis.js';
import { config } from '../config/index.js';

export interface CacheMiddlewareOptions {
  ttlSeconds?: number;
  keyPrefix?: string;
}

/**
 * High-speed Redis API Cache Middleware
 * Caches serialized JSON responses in Redis and L1 Memory.
 * Responds in 1-3ms on cache hits without triggering database queries.
 */
export function apiCache(options: CacheMiddlewareOptions | number = {}) {
  const opts: CacheMiddlewareOptions =
    typeof options === 'number' ? { ttlSeconds: options } : options;

  const ttl = opts.ttlSeconds || config.redis.defaultTtl || 60;
  const customPrefix = opts.keyPrefix || 'api:';

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    const startTime = Date.now();

    // Check if client explicitly asks to bypass cache
    const forceFresh = req.query.fresh === 'true' || req.query.forceFresh === 'true';

    // Build deterministic cache key sorted by query parameter keys
    const sortedQuery = Object.keys(req.query)
      .filter((k) => k !== 'fresh' && k !== 'forceFresh')
      .sort()
      .map((k) => `${k}=${req.query[k]}`)
      .join('&');

    const cacheKey = `${customPrefix}${req.baseUrl || ''}${req.path}${sortedQuery ? `?${sortedQuery}` : ''}`;

    if (!forceFresh) {
      try {
        const cached = await hybridCache.get<any>(cacheKey);
        if (cached) {
          const elapsed = Date.now() - startTime;
          const provider = isRedisAvailable() ? 'Redis' : 'Memory';

          res.setHeader('X-Cache', 'HIT');
          res.setHeader('X-Cache-Provider', provider);
          res.setHeader('X-Response-Time', `${elapsed}ms`);
          res.setHeader('Cache-Control', `public, max-age=${ttl}, stale-while-revalidate=60`);

          res.json(cached);
          return;
        }
      } catch (err: any) {
        // Continue to handler on cache read error
      }
    }

    // Cache MISS: Intercept res.json to capture and save the response
    res.setHeader('X-Cache', 'MISS');
    res.setHeader('X-Cache-Provider', isRedisAvailable() ? 'Redis' : 'Memory');

    const originalJson = res.json.bind(res);

    res.json = (body: any): Response => {
      // Only cache successful 200 responses
      if (res.statusCode >= 200 && res.statusCode < 300) {
        res.setHeader('Cache-Control', `public, max-age=${ttl}, stale-while-revalidate=60`);
        hybridCache.set(cacheKey, body, ttl).catch((err) => {
          console.warn(`Failed to store API response in cache [${cacheKey}]:`, err.message);
        });
      }

      const elapsed = Date.now() - startTime;
      res.setHeader('X-Response-Time', `${elapsed}ms`);
      return originalJson(body);
    };

    next();
  };
}

/**
 * Flush cache entries matching a prefix (e.g. 'valves', 'customers', etc.)
 */
export async function invalidateCache(prefix: string): Promise<void> {
  await hybridCache.flushByPrefix(prefix);
}

