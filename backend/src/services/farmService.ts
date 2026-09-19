import prisma from '../config/db.js';
import { Prisma } from '@prisma/client';
import { FarmDetailResponse } from '../types/index.js';
import { formatIST } from '../utils/timezone.js';
import { calculateReadingStatus } from '../utils/status.js';
import { memoryCache } from '../utils/cache.js';
import * as telemetryService from './telemetryService.js';
import * as batteryService from './batteryService.js';
import * as fertigationService from './fertigationService.js';

export async function getFarmsByUserId(userId: number) {
  const farms = await prisma.farm.findMany({
    where: { userId },
    include: {
      plant: true,
      boundaries: true,
      devices: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  const farmIds = farms.map((f) => f.id);
  let latestReadings: any[] = [];

  if (farmIds.length > 0) {
    try {
      latestReadings = await prisma.$queryRaw<any[]>`
        WITH Ranked AS (
          SELECT "farmId", timestamp,
                 ROW_NUMBER() OVER (PARTITION BY "farmId" ORDER BY timestamp DESC) as rn
          FROM "EnvironmentalReading"
          WHERE "farmId" IN (${Prisma.join(farmIds)})
        )
        SELECT "farmId", timestamp FROM Ranked WHERE rn = 1;
      `;
    } catch {
      latestReadings = [];
    }
  }

  const readingMap = new Map<string, Date>();
  latestReadings.forEach((r) => {
    if (r.farmId && r.timestamp) {
      readingMap.set(r.farmId, new Date(r.timestamp));
    }
  });

  return farms.map((farm) => {
    const timestamp = readingMap.get(farm.id) || null;
    const readingStatus = calculateReadingStatus(timestamp);

    return {
      farmId: farm.id,
      name: farm.name,
      crop: farm.plant?.plantName || null,
      cropType: farm.boundaries.find((b) => b.cropType)?.cropType || null,
      totalArea: farm.totalArea,
      totalAreaAcres: farm.totalAreaAcres,
      location: (farm.location as any) || null,
      boundaryCount: farm.boundaries.length,
      deviceCount: farm.devices.length,
      latestReadingTime: timestamp ? timestamp.toISOString() : null,
      formattedReadingTime: formatIST(timestamp),
      readingStatus,
    };
  });
}

export async function getFarmById(farmId: string): Promise<FarmDetailResponse | null> {
  const cacheKey = `farm:${farmId}`;
  const cached = memoryCache.get<FarmDetailResponse>(cacheKey);
  if (cached) return cached;

  const farm = await prisma.farm.findUnique({
    where: { id: farmId },
    include: {
      user: {
        select: {
          id: true,
          userName: true,
          email: true,
          mobileNumber: true,
        },
      },
      plant: true,
      boundaries: true,
      devices: true,
    },
  });

  if (!farm) return null;

  const latestReading = await prisma.environmentalReading.findFirst({
    where: { farmId: farm.id },
    orderBy: { timestamp: 'desc' },
    select: { timestamp: true },
  });

  const readingStatus = calculateReadingStatus(latestReading?.timestamp);

  const result: FarmDetailResponse = {
    farmId: farm.id,
    name: farm.name,
    userId: farm.userId,
    userName: farm.user.userName,
    email: farm.user.email,
    mobileNumber: farm.user.mobileNumber,
    crop: farm.plant?.plantName || null,
    cropType: farm.boundaries.find((b) => b.cropType)?.cropType || null,
    totalArea: farm.totalArea,
    totalAreaAcres: farm.totalAreaAcres,
    location: (farm.location as any) || null,
    boundaryCount: farm.boundaries.length,
    deviceCount: farm.devices.length,
    latestReadingTime: latestReading?.timestamp ? latestReading.timestamp.toISOString() : null,
    formattedReadingTime: formatIST(latestReading?.timestamp),
    readingStatus,
    boundaries: farm.boundaries.map((b) => ({
      id: b.id,
      name: b.name,
      area: b.area,
      areaAcres: b.areaAcres,
      cropType: b.cropType,
      plantId: b.plantId,
      color: b.color,
      coordinates: b.coordinates,
    })),
    devices: farm.devices.map((d) => ({
      id: d.id,
      deviceId: d.deviceId,
      deviceName: d.deviceName,
      deviceCategory: d.deviceCategory,
      cloudStatus: d.cloudStatus,
      lastHeartbeatAt: d.lastHeartbeatAt ? d.lastHeartbeatAt.toISOString() : null,
      formattedHeartbeatAt: formatIST(d.lastHeartbeatAt),
      failSafeStatus: d.failSafeStatus,
    })),
  };

  memoryCache.set(cacheKey, result, 30);
  return result;
}

export async function getFarmDevices(farmId: string) {
  const devices = await prisma.nodeRedDeviceDetails.findMany({
    where: { farmId },
    include: {
      boundary: { select: { id: true, name: true, cropType: true } },
    },
    orderBy: { lastHeartbeatAt: 'desc' },
  });

  return devices.map((d) => ({
    id: d.id,
    deviceId: d.deviceId,
    deviceName: d.deviceName,
    deviceCategory: d.deviceCategory,
    cloudStatus: d.cloudStatus,
    lastHeartbeatAt: d.lastHeartbeatAt ? d.lastHeartbeatAt.toISOString() : null,
    formattedHeartbeatAt: formatIST(d.lastHeartbeatAt),
    lastAckAt: d.lastAckAt ? d.lastAckAt.toISOString() : null,
    failSafeStatus: d.failSafeStatus,
    failSafeReason: d.failSafeReason,
    boundaryName: d.boundary?.name || null,
    cropType: d.boundary?.cropType || null,
  }));
}

export async function getFullFarmTelemetry(
  farmId: string,
  options: { range?: string; from?: string; to?: string; forceFresh?: boolean }
) {
  const cacheKey = `farm_full:${farmId}:${options.range || '24h'}:${options.from || ''}:${options.to || ''}`;
  if (!options.forceFresh) {
    const cached = memoryCache.get<any>(cacheKey);
    if (cached) return cached;
  }

  // Execute all farm sub-queries in parallel on the server
  const [
    farm,
    latestReading,
    environmentalHistory,
    batteryHistory,
    fertigation,
    fertigationHistory,
    devices,
  ] = await Promise.all([
    getFarmById(farmId),
    telemetryService.getLatestReading(farmId),
    telemetryService.getEnvironmentalHistory(farmId, options),
    batteryService.getBatteryHistory(farmId, options),
    fertigationService.getLatestFertigation(farmId),
    fertigationService.getFertigationHistory(farmId, options),
    getFarmDevices(farmId),
  ]);

  if (!farm) return null;

  const result = {
    farm,
    latestReading,
    environmentalHistory,
    batteryHistory,
    fertigation,
    fertigationHistory,
    devices,
  };

  // Cache for 30 seconds
  memoryCache.set(cacheKey, result, 30);
  return result;
}
