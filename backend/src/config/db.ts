import { PrismaClient } from '@prisma/client';
import { config } from './index.js';

// Read-only Prisma Client instance with datasource fallback
const prisma = new PrismaClient({
  ...(config.databaseUrl ? { datasources: { db: { url: config.databaseUrl } } } : {}),
  log: config.nodeEnv === 'development' ? ['warn', 'error'] : ['error'],
});

export default prisma;

