import prisma from '../config/db.js';
import { DashboardOverviewMetrics } from '../types/index.js';
import { calculateReadingStatus } from '../utils/status.js';
import { memoryCache } from '../utils/cache.js';

export async function getDashboardOverview(forceFresh = false): Promise<DashboardOverviewMetrics> {
  const cacheKey = 'overview:metrics';
  if (!forceFresh) {
    const cached = memoryCache.get<DashboardOverviewMetrics>(cacheKey);
    if (cached) return cached;
  }

  const [totalCustomers, totalFarms, totalDevices, users] = await Promise.all([
    prisma.user.count(),
    prisma.farm.count(),
    prisma.device.count(),
    prisma.user.findMany({
      select: {
        id: true,
        farm: {
          select: {
            plant: { select: { plantName: true } },
            boundaries: { select: { cropType: true } },
          },
        },
      },
    }),
  ]);

  // Query latest readings for all users in a single fast CTE partition query
  let userLatestReadings: { userId: number; timestamp: Date }[] = [];
  try {
    userLatestReadings = await prisma.$queryRaw`
      WITH Ranked AS (
        SELECT "userId", timestamp,
               ROW_NUMBER() OVER (PARTITION BY "userId" ORDER BY timestamp DESC) as rn
        FROM "EnvironmentalReading"
      )
      SELECT "userId", timestamp FROM Ranked WHERE rn = 1;
    `;
  } catch (err) {
    console.error('Error querying latest user readings for overview:', err);
  }

  const userTimestampMap = new Map<number, Date>();
  userLatestReadings.forEach((r) => {
    if (r.userId && r.timestamp) {
      userTimestampMap.set(r.userId, new Date(r.timestamp));
    }
  });

  const statusBreakdown = {
    live: 0,
    recent: 0,
    delayed: 0,
    offline: 0,
    noData: 0,
  };

  users.forEach((u) => {
    const timestamp = userTimestampMap.get(u.id);
    const status = calculateReadingStatus(timestamp);
    if (status === 'LIVE') statusBreakdown.live++;
    else if (status === 'RECENT') statusBreakdown.recent++;
    else if (status === 'DELAYED') statusBreakdown.delayed++;
    else if (status === 'OFFLINE') statusBreakdown.offline++;
    else statusBreakdown.noData++;
  });

  // Calculate crop breakdown
  const cropCounts = new Map<string, number>();
  users.forEach((u) => {
    u.farm.forEach((f) => {
      const crop = f.plant?.plantName || f.boundaries.find((b) => b.cropType)?.cropType;
      if (crop) {
        cropCounts.set(crop, (cropCounts.get(crop) || 0) + 1);
      }
    });
  });

  const cropBreakdown = Array.from(cropCounts.entries())
    .map(([crop, count]) => ({ crop, count }))
    .sort((a, b) => b.count - a.count);

  const result: DashboardOverviewMetrics = {
    totalCustomers,
    totalFarms,
    totalDevices,
    onlineDevices: totalDevices,
    offlineDevices: 0,
    statusBreakdown,
    cropBreakdown,
  };

  // Cache for 30 seconds
  memoryCache.set(cacheKey, result, 30);

  return result;
}
