import { PrismaClient } from '@prisma/client';
import { config } from './index.js';

// Read-only Prisma Client instance
const prisma = new PrismaClient({
  log: config.nodeEnv === 'development' ? ['warn', 'error'] : ['error'],
});

export default prisma;
