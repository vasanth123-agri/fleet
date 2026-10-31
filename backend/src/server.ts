import express from 'express';
import cors from 'cors';
import compression from 'compression';
import { config } from './config/index.js';
import routes from './routes/index.js';
import prisma from './config/db.js';
import { initializeRedis, closeRedis, isRedisAvailable } from './config/redis.js';

const app = express();

// Initialize Redis Cache Layer
initializeRedis();

// Enable Gzip/Brotli response compression for super-fast payload delivery
app.use(compression());

// Security & Middleware
app.use(
  cors({
    origin: '*', // Allows dashboard frontend on any local/network port
    methods: ['GET', 'OPTIONS', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-mqtt-topic'],
  })
);

app.use(express.json());

// Request logging in development
if (config.nodeEnv === 'development') {
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      const cacheStatus = res.getHeader('X-Cache');
      const cacheTag = cacheStatus ? ` [Cache: ${cacheStatus}]` : '';
      console.log(
        `[${new Date().toISOString()}] ${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms${cacheTag}`
      );
    });
    next();
  });
}

// Health Check
app.get('/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      status: 'healthy',
      database: 'connected',
      redis: isRedisAvailable() ? 'connected' : 'memory-fallback',
      timezone: config.timezone,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    res.status(500).json({
      status: 'unhealthy',
      database: 'disconnected',
      redis: isRedisAvailable() ? 'connected' : 'memory-fallback',
      error: err.message,
    });
  }
});

// API Routes
app.use('/api', routes);

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Endpoint not found' });
});

// Global Error Handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled Server Error:', err);
  res.status(500).json({
    success: false,
    error: config.nodeEnv === 'development' ? err.message : 'Internal Server Error',
  });
});

const server = app.listen(config.port, '0.0.0.0', () => {
  console.log(`🚀 Fleet Read-Only Backend Server running on port ${config.port}`);
  console.log(`🌱 Connected to AgriInverse Database (Timezone: ${config.timezone})`);
  console.log(`⚡ Redis Caching: ${config.redis.enabled ? 'Enabled' : 'Disabled'} (Default TTL: ${config.redis.defaultTtl}s)`);
  console.log(`⏱️ Reading Thresholds: LIVE <= ${config.readingLiveThresholdMinutes}m, RECENT <= ${config.readingRecentThresholdMinutes}m`);
});

// Graceful Shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  server.close(async () => {
    await closeRedis();
    await prisma.$disconnect();
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully...');
  server.close(async () => {
    await closeRedis();
    await prisma.$disconnect();
    process.exit(0);
  });
});

export default app;
