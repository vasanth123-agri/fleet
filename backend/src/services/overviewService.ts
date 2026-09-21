import prisma from '../config/db.js';
import { DashboardOverviewMetrics } from '../types/index.js';
import { calculateReadingStatus } from '../utils/status.js';
import { memoryCache } from '../utils/cache.js';

export async function getDashboardOverview(forceFresh = false): Promise<DashboardOverviewMetrics> {
  const cacheKey = 'overview:metrics';

  return memoryCache.getOrFetch(
    cacheKey,
    async () => {
      // Execute total counts, user farm crops, and latest readings in parallel
      const [totalCustomers, totalFarms, totalDevices, users, latestReadings] = await Promise.all([
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
        prisma.$queryRaw<Array<{ userId: number; envTimestamp: Date | null; outdoorTimestamp: Date | null }>>`
          SELECT u.id as "userId", r.timestamp as "envTimestamp", o.timestamp as "outdoorTimestamp"
          FROM "User" u
          LEFT JOIN LATERAL (
            SELECT timestamp
            FROM "EnvironmentalReading"
            WHERE "userId" = u.id
            ORDER BY timestamp DESC
            LIMIT 1
          ) r ON true
          LEFT JOIN LATERAL (
            SELECT timestamp
            FROM outdoorreading
            WHERE user_id = u.id
            ORDER BY timestamp DESC
            LIMIT 1
          ) o ON true;
        `.catch((err) => {
          console.error('Error querying latest user readings for overview:', err);
          return [];
        }),
      ]);

      const userTimestampMap = new Map<number, Date>();
      latestReadings.forEach((r) => {
        let latestDate: Date | null = null;
        if (r.envTimestamp && r.outdoorTimestamp) {
          const envD = new Date(r.envTimestamp);
          const outD = new Date(r.outdoorTimestamp);
          latestDate = envD > outD ? envD : outD;
        } else if (r.envTimestamp) {
          latestDate = new Date(r.envTimestamp);
        } else if (r.outdoorTimestamp) {
          latestDate = new Date(r.outdoorTimestamp);
        }

        if (latestDate && r.userId) {
          userTimestampMap.set(Number(r.userId), latestDate);
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

      return result;
    },
    60, // 60 seconds fresh TTL
    forceFresh,
    120 // 120 seconds stale-while-revalidate grace
  );
}
