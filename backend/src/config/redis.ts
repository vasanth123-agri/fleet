import { Redis } from 'ioredis';
import { config } from './index.js';

let redisInstance: Redis | null = null;
let isConnected = false;
let hasLoggedFailure = false;

export function initializeRedis(): Redis | null {
  if (!config.redis.enabled) {
    console.log('⚡ Redis caching is disabled via REDIS_ENABLED=false.');
    return null;
  }

  if (redisInstance) {
    return redisInstance;
  }

  try {
    const commonOptions = {
      keyPrefix: config.redis.keyPrefix,
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      connectTimeout: 4000,
      retryStrategy(times: number) {
        if (times > 10) {
          // Slow down retry to every 30 seconds once repeated fails occur
          return 30000;
        }
        return Math.min(times * 2000, 10000);
      },
    };

    if (config.redis.url) {
      redisInstance = new Redis(config.redis.url, commonOptions);
    } else {
      redisInstance = new Redis({
        host: config.redis.host,
        port: config.redis.port,
        password: config.redis.password,
        ...commonOptions,
      });
    }

    redisInstance.on('connect', () => {
      isConnected = true;
      hasLoggedFailure = false;
      console.log('🟢 Redis Client connected successfully.');
    });

    redisInstance.on('ready', () => {
      isConnected = true;
      console.log(`🚀 Redis Cache active with prefix "${config.redis.keyPrefix}".`);
    });

    redisInstance.on('error', (err: any) => {
      isConnected = false;
      if (!hasLoggedFailure) {
        hasLoggedFailure = true;
        console.warn(`⚠️ Redis Connection warning: ${err.message || 'Cannot reach Redis'}. Falling back to in-memory cache.`);
      }
    });

    redisInstance.on('close', () => {
      isConnected = false;
    });

    // Attempt non-blocking initial connection in background
    redisInstance.connect().catch((err: any) => {
      isConnected = false;
      if (!hasLoggedFailure) {
        hasLoggedFailure = true;
        console.warn(`⚠️ Initial Redis connection not available (${err.message}). Using high-speed in-memory fallback.`);
      }
    });

    return redisInstance;
  } catch (error: any) {
    console.warn(`⚠️ Failed to initialize Redis client: ${error.message}. Running on memory cache.`);
    return null;
  }
}

export function isRedisAvailable(): boolean {
  return isConnected && redisInstance !== null && redisInstance.status === 'ready';
}

export function getRedisClient(): Redis | null {
  if (!redisInstance) {
    return initializeRedis();
  }
  return redisInstance;
}

export async function closeRedis(): Promise<void> {
  if (redisInstance) {
    try {
      await redisInstance.quit();
    } catch {
      redisInstance.disconnect();
    }
    redisInstance = null;
    isConnected = false;
  }
}

export default getRedisClient();

