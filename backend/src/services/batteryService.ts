import prisma from '../config/db.js';
import { BatteryHistoryPoint } from '../types/index.js';
import { formatShortIST } from '../utils/timezone.js';

export async function getBatteryHistory(
  farmId: string,
  options: { from?: string; to?: string; range?: string }
): Promise<BatteryHistoryPoint[]> {
  const now = new Date();
  let fromDate: Date;
  let toDate = options.to ? new Date(options.to) : now;

  if (options.from) {
    fromDate = new Date(options.from);
  } else {
    switch (options.range) {
      case '7d':
        fromDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        fromDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '24h':
      default:
        fromDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
    }
  }

  const readings = await prisma.environmentalReading.findMany({
    where: {
      farmId,
      timestamp: {
        gte: fromDate,
        lte: toDate,
      },
      OR: [
        { batteryPercentage: { not: null } },
        { batteryVoltage: { not: null } },
      ],
    },
    select: {
      timestamp: true,
      batteryPercentage: true,
      batteryVoltage: true,
      batteryCurrent: true,
      isCharging: true,
    },
    orderBy: { timestamp: 'asc' },
  });

  if (readings.length === 0) return [];

  const maxPoints = 250;
  if (readings.length <= maxPoints) {
    return readings.map((r) => ({
      timestamp: r.timestamp.toISOString(),
      formattedTime: formatShortIST(r.timestamp) || '',
      batteryPercentage: r.batteryPercentage !== null ? Math.round(r.batteryPercentage * 10) / 10 : null,
      batteryVoltage: r.batteryVoltage !== null ? Math.round(r.batteryVoltage * 100) / 100 : null,
      batteryCurrent: r.batteryCurrent !== null ? Math.round(r.batteryCurrent * 100) / 100 : null,
      isCharging: r.isCharging,
    }));
  }

  // Downsample to maxPoints
  const step = Math.ceil(readings.length / maxPoints);
  const sampled: BatteryHistoryPoint[] = [];

  for (let i = 0; i < readings.length; i += step) {
    const r = readings[i];
    sampled.push({
      timestamp: r.timestamp.toISOString(),
      formattedTime: formatShortIST(r.timestamp) || '',
      batteryPercentage: r.batteryPercentage !== null ? Math.round(r.batteryPercentage * 10) / 10 : null,
      batteryVoltage: r.batteryVoltage !== null ? Math.round(r.batteryVoltage * 100) / 100 : null,
      batteryCurrent: r.batteryCurrent !== null ? Math.round(r.batteryCurrent * 100) / 100 : null,
      isCharging: r.isCharging,
    });
  }

  return sampled;
}
