import express from 'express';
import cors from 'cors';
import compression from 'compression';
import { config } from './config/index.js';
import routes from './routes/index.js';
import prisma from './config/db.js';

const app = express();

// Enable Gzip/Brotli response compression for super-fast payload delivery
app.use(compression());

// Security & Middleware
app.use(
  cors({
    origin: '*', // Allows dashboard frontend on any local/network port
    methods: ['GET', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

app.use(express.json());

// Request logging in development
if (config.nodeEnv === 'development') {
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms`);
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
      timezone: config.timezone,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    res.status(500).json({
      status: 'unhealthy',
      database: 'disconnected',
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

const server = app.listen(config.port, () => {
  console.log(`🚀 Fleet Read-Only Backend Server running on port ${config.port}`);
  console.log(`🌱 Connected to AgriInverse Database (Timezone: ${config.timezone})`);
  console.log(`⏱️ Reading Thresholds: LIVE <= ${config.readingLiveThresholdMinutes}m, RECENT <= ${config.readingRecentThresholdMinutes}m`);
});

// Graceful Shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully...');
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
});

export default app;
