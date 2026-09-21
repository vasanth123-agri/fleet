import prisma from '../config/db.js';
import { Prisma } from '@prisma/client';
import { FarmDetailResponse } from '../types/index.js';
import { formatIST, formatShortIST } from '../utils/timezone.js';
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
        SELECT DISTINCT ON ("farmId") "farmId", timestamp
        FROM "EnvironmentalReading"
        WHERE "farmId" IN (${Prisma.join(farmIds)})
        ORDER BY "farmId", timestamp DESC;
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

export async function getFarmById(farmId: string, forceFresh = false): Promise<FarmDetailResponse | null> {
  const cacheKey = `farm:${farmId}`;

  return memoryCache.getOrFetch(
    cacheKey,
    async () => {
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

      return result;
    },
    30, // 30s fresh
    forceFresh,
    60 // 60s stale grace
  );
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

  return memoryCache.getOrFetch(
    cacheKey,
    async () => {
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

      // Execute all 3 core dataset queries concurrently in 1 parallel round-trip
      const [farmRaw, envReadingsRaw, outdoorReadingsRaw] = await Promise.all([
        prisma.farm.findUnique({
          where: { id: farmId },
          include: {
            user: {
              select: {
                id: true,
                userName: true,
                email: true,
                mobileNumber: true,
                area: true,
                fertigationSettings: { include: { tanks: true } },
              },
            },
            plant: { select: { plantName: true } },
            boundaries: true,
            devices: true,
          },
        }),
        prisma.environmentalReading.findMany({
          where: {
            farmId,
            timestamp: { gte: fromDate, lte: toDate },
          },
          select: {
            id: true,
            timestamp: true,
            temperature: true,
            humidity: true,
            co2: true,
            vpd: true,
            windSpeed: true,
            directRadiation: true,
            par: true,
            evapotranspiration: true,
            gdd: true,
            soilMoisture: true,
            soilTemperature: true,
            soilElectroConductivity: true,
            soilNitrogen: true,
            soilPhosphorus: true,
            soilPotassium: true,
            phMaster: true,
            phSlave: true,
            nir: true,
            batteryPercentage: true,
            batteryVoltage: true,
            batteryCurrent: true,
            batteryChargingStatus: true,
            isCharging: true,
          },
          orderBy: { timestamp: 'desc' },
          take: 500,
        }),
        prisma.outdoorReading.findMany({
          where: {
            farmId,
            timestamp: { gte: fromDate, lte: toDate },
          },
          orderBy: { timestamp: 'desc' },
          take: 300,
        }),
      ]);

      if (!farmRaw) return null;

      // 1. Latest Reading Resolution
      const latestEnv = envReadingsRaw[0] || null;
      const latestOutdoor = outdoorReadingsRaw[0] || null;

      const latestReading = latestEnv
        ? {
            id: latestEnv.id,
            timestamp: latestEnv.timestamp.toISOString(),
            formattedTimestamp: formatIST(latestEnv.timestamp) || '',
            temperature: latestEnv.temperature,
            humidity: latestEnv.humidity,
            windSpeed: latestEnv.windSpeed,
            directRadiation: latestEnv.directRadiation,
            par: latestEnv.par,
            vpd: latestEnv.vpd,
            evapotranspiration: latestEnv.evapotranspiration,
            gdd: latestEnv.gdd,
            co2: latestEnv.co2,
            soilTemperature: latestEnv.soilTemperature,
            soilMoisture: latestEnv.soilMoisture,
            soilElectroConductivity: latestEnv.soilElectroConductivity,
            soilNitrogen: latestEnv.soilNitrogen,
            soilPhosphorus: latestEnv.soilPhosphorus,
            soilPotassium: latestEnv.soilPotassium,
            phMaster: latestEnv.phMaster,
            phSlave: latestEnv.phSlave,
            tdsv: null,
            soilv: null,
            batteryPercentage: latestEnv.batteryPercentage,
            batteryVoltage: latestEnv.batteryVoltage,
            batteryCurrent: latestEnv.batteryCurrent,
            batteryChargingStatus: latestEnv.batteryChargingStatus,
            isCharging: latestEnv.isCharging,
            readingStatus: calculateReadingStatus(latestEnv.timestamp),
          }
        : null;

      // 2. Farm Details DTO
      const readingStatus = calculateReadingStatus(latestEnv?.timestamp);
      const farm: FarmDetailResponse = {
        farmId: farmRaw.id,
        name: farmRaw.name,
        userId: farmRaw.userId,
        userName: farmRaw.user.userName,
        email: farmRaw.user.email,
        mobileNumber: farmRaw.user.mobileNumber,
        crop: farmRaw.plant?.plantName || null,
        cropType: farmRaw.boundaries.find((b) => b.cropType)?.cropType || null,
        totalArea: farmRaw.totalArea,
        totalAreaAcres: farmRaw.totalAreaAcres,
        location: (farmRaw.location as any) || null,
        boundaryCount: farmRaw.boundaries.length,
        deviceCount: farmRaw.devices.length,
        latestReadingTime: latestEnv?.timestamp ? latestEnv.timestamp.toISOString() : null,
        formattedReadingTime: formatIST(latestEnv?.timestamp),
        readingStatus,
        boundaries: farmRaw.boundaries.map((b) => ({
          id: b.id,
          name: b.name,
          area: b.area,
          areaAcres: b.areaAcres,
          cropType: b.cropType,
          plantId: b.plantId,
          color: b.color,
          coordinates: b.coordinates,
        })),
        devices: farmRaw.devices.map((d) => ({
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

      // 3. In-memory Downsampled Environmental History (Ascending Chronological)
      const chronologicalEnv = [...envReadingsRaw].reverse();
      const mapEnvPoint = (r: any) => ({
        timestamp: r.timestamp.toISOString(),
        formattedTime: formatShortIST(r.timestamp) || '',
        temperature: r.temperature !== null && r.temperature !== undefined ? Math.round(r.temperature * 10) / 10 : null,
        humidity: r.humidity !== null && r.humidity !== undefined ? Math.round(r.humidity * 10) / 10 : null,
        co2: r.co2 !== null && r.co2 !== undefined ? Math.round(r.co2) : null,
        vpd: r.vpd !== null && r.vpd !== undefined ? Math.round(r.vpd * 100) / 100 : null,
        soilMoisture: r.soilMoisture !== null && r.soilMoisture !== undefined ? Math.round(r.soilMoisture * 10) / 10 : null,
        soilTemperature: r.soilTemperature !== null && r.soilTemperature !== undefined ? Math.round(r.soilTemperature * 10) / 10 : null,
        soilElectroConductivity: r.soilElectroConductivity !== null && r.soilElectroConductivity !== undefined ? Math.round(r.soilElectroConductivity * 100) / 100 : null,
        soilNitrogen: r.soilNitrogen !== null && r.soilNitrogen !== undefined ? Math.round(r.soilNitrogen * 10) / 10 : null,
        soilPhosphorus: r.soilPhosphorus !== null && r.soilPhosphorus !== undefined ? Math.round(r.soilPhosphorus * 10) / 10 : null,
        soilPotassium: r.soilPotassium !== null && r.soilPotassium !== undefined ? Math.round(r.soilPotassium * 10) / 10 : null,
        phMaster: r.phMaster !== null && r.phMaster !== undefined ? Math.round(r.phMaster * 100) / 100 : null,
        par: r.par !== null && r.par !== undefined ? Math.round(r.par * 10) / 10 : null,
        directRadiation: r.directRadiation !== null && r.directRadiation !== undefined ? Math.round(r.directRadiation * 10) / 10 : null,
        nir: r.nir !== null && r.nir !== undefined ? Math.round(r.nir * 10) / 10 : null,
        batteryPercentage: r.batteryPercentage !== null && r.batteryPercentage !== undefined ? Math.round(r.batteryPercentage) : null,
        batteryVoltage: r.batteryVoltage !== null && r.batteryVoltage !== undefined ? Math.round(r.batteryVoltage * 100) / 100 : null,
        batteryCurrent: r.batteryCurrent !== null && r.batteryCurrent !== undefined ? Math.round(r.batteryCurrent * 10) / 10 : null,
        isCharging: r.isCharging,
      });

      let environmentalHistory: any[] = [];
      const maxEnvPoints = 300;
      if (chronologicalEnv.length <= maxEnvPoints) {
        environmentalHistory = chronologicalEnv.map(mapEnvPoint);
      } else {
        const step = Math.ceil(chronologicalEnv.length / maxEnvPoints);
        for (let i = 0; i < chronologicalEnv.length; i += step) {
          environmentalHistory.push(mapEnvPoint(chronologicalEnv[i]));
        }
      }

      // 4. In-memory Derived Battery History (Zero Extra DB Calls)
      const batReadings = chronologicalEnv.filter(
        (r) => r.batteryPercentage !== null || r.batteryVoltage !== null
      );
      const mapBatteryPoint = (r: any) => ({
        timestamp: r.timestamp.toISOString(),
        formattedTime: formatShortIST(r.timestamp) || '',
        batteryPercentage: r.batteryPercentage !== null && r.batteryPercentage !== undefined ? Math.round(r.batteryPercentage * 10) / 10 : null,
        batteryVoltage: r.batteryVoltage !== null && r.batteryVoltage !== undefined ? Math.round(r.batteryVoltage * 100) / 100 : null,
        batteryCurrent: r.batteryCurrent !== null && r.batteryCurrent !== undefined ? Math.round(r.batteryCurrent * 100) / 100 : null,
        isCharging: r.isCharging,
      });

      let batteryHistory: any[] = [];
      const maxBatPoints = 250;
      if (batReadings.length <= maxBatPoints) {
        batteryHistory = batReadings.map(mapBatteryPoint);
      } else {
        const step = Math.ceil(batReadings.length / maxBatPoints);
        for (let i = 0; i < batReadings.length; i += step) {
          batteryHistory.push(mapBatteryPoint(batReadings[i]));
        }
      }

      // 5. In-memory Fertigation & History
      const fertSettings = farmRaw.user.fertigationSettings?.[0] || null;
      let fertigation: any = null;
      if (fertSettings && (latestOutdoor || fertSettings.tanks.length > 0)) {
        let systemStatus: 'READY' | 'ACTIVE' | 'ALERT' | 'FAILSAFE' | 'ESTOP' | 'UNKNOWN' = 'UNKNOWN';
        if (latestOutdoor?.e_stop) systemStatus = 'ESTOP';
        else if (latestOutdoor?.failsafe) systemStatus = 'FAILSAFE';
        else if (latestOutdoor?.alert && latestOutdoor.alert > 0) systemStatus = 'ALERT';
        else if (latestOutdoor?.ready) systemStatus = 'READY';
        else if (latestOutdoor) systemStatus = 'ACTIVE';

        const tanks = (fertSettings.tanks || []).map((tank: any) => {
          let levelPercentage: number | null = null;
          if (tank.tankKey === 'tank-1' || tank.tankKey === 'n1') levelPercentage = latestOutdoor?.n1_pct ?? null;
          else if (tank.tankKey === 'tank-2' || tank.tankKey === 'n2') levelPercentage = latestOutdoor?.n2_pct ?? null;
          else if (tank.tankKey === 'ph_up') levelPercentage = latestOutdoor?.ph_up_pct ?? null;
          else if (tank.tankKey === 'ph_dn') levelPercentage = latestOutdoor?.ph_dn_pct ?? null;
          else if (tank.tankKey === 'tank-5' || tank.tankKey === 't5') levelPercentage = latestOutdoor?.t5_pct ?? null;

          return {
            tankKey: tank.tankKey,
            name: tank.name || tank.nutrient || tank.tankKey,
            nutrient: tank.nutrient || 'General',
            levelPercentage,
            levelCm: null,
          };
        });

        fertigation = {
          lastReadingTime: latestOutdoor?.timestamp ? latestOutdoor.timestamp.toISOString() : null,
          formattedLastReadingTime: formatIST(latestOutdoor?.timestamp),
          cloudOnline: latestOutdoor?.cloud_online ?? false,
          systemStatus,
          ph: latestOutdoor?.m2_ph ?? latestOutdoor?.m1_ph ?? null,
          ec: latestOutdoor?.m2_ec ?? latestOutdoor?.m1_ec ?? null,
          waterLevel: latestOutdoor?.waterLevel ?? null,
          tanks,
        };
      }

      const chronologicalOutdoor = [...outdoorReadingsRaw].reverse();
      const fertigationHistory = chronologicalOutdoor.map((r: any) => ({
        timestamp: r.timestamp.toISOString(),
        formattedTime: formatShortIST(r.timestamp) || '',
        m1_ph: r.m1_ph,
        m2_ph: r.m2_ph,
        m1_ec: r.m1_ec,
        m2_ec: r.m2_ec,
        waterLevel: r.waterLevel,
        cloud_online: r.cloud_online,
        n1_pct: r.n1_pct,
        n2_pct: r.n2_pct,
        ph_up_pct: r.ph_up_pct,
        ph_dn_pct: r.ph_dn_pct,
        t5_pct: r.t5_pct,
      }));

      // 6. Raw Eye Payload
      const latestReadingRaw = latestReading
        ? {
            farm_id: farm.farmId,
            farm_name: farm.name,
            crop: farm.crop,
            crop_type: farm.cropType,
            telemetry_id: latestReading.id,
            timestamp_iso: latestReading.timestamp,
            timestamp_ist: latestReading.formattedTimestamp,
            climate: {
              temperature_c: latestReading.temperature,
              humidity_pct: latestReading.humidity,
              vpd_kpa: latestReading.vpd,
              co2_ppm: latestReading.co2,
              wind_speed_ms: latestReading.windSpeed,
              direct_radiation_wm2: latestReading.directRadiation,
              par_umol_m2_s: latestReading.par,
            },
            soil_root_zone: {
              soil_temperature_c: latestReading.soilTemperature,
              soil_moisture_pct: latestReading.soilMoisture,
              soil_ec_mscm: latestReading.soilElectroConductivity,
              nitrogen_n_mgkg: latestReading.soilNitrogen,
              phosphorus_p_mgkg: latestReading.soilPhosphorus,
              potassium_k_mgkg: latestReading.soilPotassium,
              ph_master: latestReading.phMaster,
            },
            power: {
              battery_percentage: latestReading.batteryPercentage,
              battery_voltage_v: latestReading.batteryVoltage,
              battery_current_ma: latestReading.batteryCurrent,
              is_charging: latestReading.isCharging,
            },
            reading_status: latestReading.readingStatus,
          }
        : null;

      return {
        farm,
        latestReading,
        latestReadingRaw,
        environmentalHistory,
        batteryHistory,
        fertigation,
        fertigationHistory,
        devices: farm.devices,
      };
    },
    60, // 60s fresh TTL
    options.forceFresh,
    120 // 120s stale grace
  );
}



