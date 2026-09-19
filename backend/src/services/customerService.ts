import prisma from '../config/db.js';
import { Prisma } from '@prisma/client';
import { CustomerDashboardSummary, FarmSummary } from '../types/index.js';
import { formatIST } from '../utils/timezone.js';
import { calculateReadingStatus, calculateBatterySummary } from '../utils/status.js';
import { memoryCache } from '../utils/cache.js';
import { getLatestFertigation } from './fertigationService.js';

interface GetCustomersParams {
  page?: number;
  limit?: number;
  search?: string;
  crop?: string;
  status?: string;
  deviceCategory?: string;
  forceFresh?: boolean;
}

export async function getCustomers(params: GetCustomersParams): Promise<{
  customers: CustomerDashboardSummary[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}> {
  const cacheKey = `customers:${JSON.stringify({
    page: params.page,
    limit: params.limit,
    search: params.search,
    crop: params.crop,
    status: params.status,
    deviceCategory: params.deviceCategory,
  })}`;

  if (!params.forceFresh) {
    const cached = memoryCache.get<{
      customers: CustomerDashboardSummary[];
      pagination: { total: number; page: number; limit: number; totalPages: number };
    }>(cacheKey);
    if (cached) return cached;
  }

  const page = Math.max(1, Number(params.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(params.limit) || 20));
  const skip = (page - 1) * limit;
  const search = params.search?.trim();

  // Search filter matching customer name, email, mobile, or place/area
  const whereClause: any = {};

  if (search) {
    whereClause.OR = [
      { userName: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
      { mobileNumber: { contains: search, mode: 'insensitive' } },
      { area: { contains: search, mode: 'insensitive' } },
    ];
  }

  if (params.crop) {
    whereClause.farm = {
      some: {
        OR: [
          { plant: { plantName: { contains: params.crop, mode: 'insensitive' } } },
          { boundaries: { some: { cropType: { contains: params.crop, mode: 'insensitive' } } } },
        ],
      },
    };
  }

  if (params.deviceCategory) {
    const cat = params.deviceCategory.toLowerCase();
    const deviceWhere: any = {};
    if (cat.includes('valve')) deviceWhere.hasValve = true;
    else if (cat.includes('appliance') || cat === 'ac') deviceWhere.hasAppliance = true;
    else if (cat.includes('outdoor')) deviceWhere.hasOutdoorFertigation = true;
    else if (cat.includes('indoor')) deviceWhere.hasIndoorFertigation = true;
    else if (cat.includes('bcs') || cat.includes('battery') || cat.includes('sensor')) deviceWhere.hasBCS = true;

    const matchingDevices = await prisma.device.findMany({
      where: deviceWhere,
      select: { emailId: true },
    });
    const emails = Array.from(
      new Set(matchingDevices.map((d) => d.emailId).filter(Boolean) as string[])
    );

    whereClause.email = { in: emails, mode: 'insensitive' };
  }

  // Count total matching users, fetch paginated users, and fetch all devices in parallel
  const [total, users, allDevices] = await Promise.all([
    prisma.user.count({ where: whereClause }),
    prisma.user.findMany({
      where: whereClause,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        userName: true,
        email: true,
        mobileNumber: true,
        area: true,
        status: true,
        role: true,
        createdAt: true,
        farm: {
          select: {
            id: true,
            name: true,
            totalArea: true,
            totalAreaAcres: true,
            location: true,
            plant: { select: { plantName: true } },
            boundaries: { select: { id: true, name: true, cropType: true, area: true, areaAcres: true } },
            devices: { select: { id: true, deviceId: true, deviceName: true, deviceCategory: true, cloudStatus: true } },
          },
        },
        NodeRedDeviceDetails: {
          select: {
            id: true,
            deviceId: true,
            deviceName: true,
            deviceCategory: true,
            cloudStatus: true,
            lastHeartbeatAt: true,
          },
        },
        fertigationSettings: {
          select: {
            id: true,
            tanks: {
              select: {
                tankKey: true,
                name: true,
                nutrient: true,
              },
            },
          },
        },
      },
    }),
    prisma.device.findMany(),
  ]);

  const userIds = users.map((u) => u.id);
  const envReadingMap = new Map<number, any>();
  const outdoorReadingMap = new Map<number, any>();

  // Single fast batch CTE queries for all user IDs on this page
  if (userIds.length > 0) {
    const [envReadings, outdoorReadings] = await Promise.all([
      prisma.$queryRaw<any[]>`
        WITH Ranked AS (
          SELECT 
            id, timestamp, "userId", "farmId",
            temperature, humidity, "windSpeed", "directRadiation", par, vpd, evapotranspiration, gdd, co2,
            "soilTemperature", "soilMoisture", "soilElectroConductivity",
            n_sensor as "soilNitrogen", p_sensor as "soilPhosphorus", k_sensor as "soilPotassium",
            ph as "phMaster", "phSlave",
            battery_percentage as "batteryPercentage",
            battery_voltage as "batteryVoltage",
            battery_current as "batteryCurrent",
            battery_charging_status as "batteryChargingStatus",
            is_charging as "isCharging",
            ROW_NUMBER() OVER (PARTITION BY "userId" ORDER BY timestamp DESC) as rn
          FROM "EnvironmentalReading"
          WHERE "userId" IN (${Prisma.join(userIds)})
        )
        SELECT * FROM Ranked WHERE rn = 1;
      `.catch((err) => {
        console.error('Error in batch envReadings query:', err);
        return [];
      }),
      prisma.$queryRaw<any[]>`
        WITH RankedOutdoor AS (
          SELECT 
            id, timestamp, user_id as "userId", farm_id as "farmId", device_id as "deviceId",
            ready, safe, alert, failsafe, e_stop, cloud_online,
            m1_ec, m2_ec, m1_ph, m2_ph, water_level as "waterLevel",
            n1_pct, n2_pct, ph_up_pct, ph_dn_pct, t5_pct,
            ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY timestamp DESC) as rn
          FROM outdoorreading
          WHERE user_id IN (${Prisma.join(userIds)})
        )
        SELECT * FROM RankedOutdoor WHERE rn = 1;
      `.catch((err) => {
        console.error('Error in batch outdoorReadings query:', err);
        return [];
      }),
    ]);

    envReadings.forEach((r) => {
      if (r.userId) {
        envReadingMap.set(Number(r.userId), {
          ...r,
          timestamp: r.timestamp ? new Date(r.timestamp) : null,
        });
      }
    });

    outdoorReadings.forEach((r) => {
      if (r.userId) {
        outdoorReadingMap.set(Number(r.userId), {
          ...r,
          timestamp: r.timestamp ? new Date(r.timestamp) : null,
        });
      }
    });
  }

  const customers: CustomerDashboardSummary[] = users.map((user) => {
    // Dynamic farm count
    const farmCount = user.farm.length;

    // Collect distinct crops from farm plants and boundary cropTypes
    const cropSet = new Set<string>();
    user.farm.forEach((f) => {
      if (f.plant?.plantName) cropSet.add(f.plant.plantName);
      f.boundaries.forEach((b) => {
        if (b.cropType) cropSet.add(b.cropType);
      });
    });
    const crops = Array.from(cropSet);

    // Dynamic device count and categories from Device table
    const userDevices = allDevices.filter(
      (d) => d.emailId && d.emailId.toLowerCase() === user.email.toLowerCase()
    );
    const deviceCategorySet = new Set<string>();

    userDevices.forEach((d) => {
      if (d.hasValve) deviceCategorySet.add('valve');
      if (d.hasAppliance) deviceCategorySet.add('appliance');
      if (d.hasOutdoorFertigation) deviceCategorySet.add('outdoor fertigation');
      if (d.hasIndoorFertigation) deviceCategorySet.add('indoor fertigation');
      if (d.hasBCS) deviceCategorySet.add('battery sensor');
    });

    const deviceCategories = Array.from(deviceCategorySet);
    const deviceCount = userDevices.length;

    // Latest readings
    const envReading = envReadingMap.get(user.id);
    const outdoorReading = outdoorReadingMap.get(user.id);

    // Latest reading timestamp is the freshest between env reading and outdoor reading
    let latestTimestamp: Date | null = null;
    if (envReading?.timestamp && outdoorReading?.timestamp) {
      latestTimestamp = envReading.timestamp > outdoorReading.timestamp ? envReading.timestamp : outdoorReading.timestamp;
    } else if (envReading?.timestamp) {
      latestTimestamp = envReading.timestamp;
    } else if (outdoorReading?.timestamp) {
      latestTimestamp = outdoorReading.timestamp;
    }

    const readingStatus = calculateReadingStatus(latestTimestamp);
    const battery = calculateBatterySummary(envReading);

    // Fertigation summary - only if customer has fertigation hardware registered in Device table
    const hasFertigationCapability = userDevices.some(
      (d) => d.hasOutdoorFertigation || d.hasIndoorFertigation
    );
    let fertigation = null;
    if (hasFertigationCapability && (outdoorReading || user.fertigationSettings.length > 0)) {
      const fertSetting = user.fertigationSettings[0];
      const configuredTanks = fertSetting?.tanks || [];

      // Determine system status
      let systemStatus: 'READY' | 'ACTIVE' | 'ALERT' | 'FAILSAFE' | 'ESTOP' | 'UNKNOWN' = 'UNKNOWN';
      if (outdoorReading?.e_stop) systemStatus = 'ESTOP';
      else if (outdoorReading?.failsafe) systemStatus = 'FAILSAFE';
      else if (outdoorReading?.alert && outdoorReading.alert > 0) systemStatus = 'ALERT';
      else if (outdoorReading?.ready) systemStatus = 'READY';
      else if (outdoorReading) systemStatus = 'ACTIVE';

      // Map tanks
      const tanks = configuredTanks.map((tank) => {
        let levelPercentage: number | null = null;
        if (tank.tankKey === 'tank-1' || tank.tankKey === 'n1') levelPercentage = outdoorReading?.n1_pct ?? null;
        else if (tank.tankKey === 'tank-2' || tank.tankKey === 'n2') levelPercentage = outdoorReading?.n2_pct ?? null;
        else if (tank.tankKey === 'ph_up') levelPercentage = outdoorReading?.ph_up_pct ?? null;
        else if (tank.tankKey === 'ph_dn') levelPercentage = outdoorReading?.ph_dn_pct ?? null;
        else if (tank.tankKey === 'tank-5' || tank.tankKey === 't5') levelPercentage = outdoorReading?.t5_pct ?? null;

        return {
          tankKey: tank.tankKey,
          name: tank.name || tank.nutrient || tank.tankKey,
          nutrient: tank.nutrient || 'General',
          levelPercentage,
          levelCm: null,
        };
      });

      fertigation = {
        lastReadingTime: outdoorReading?.timestamp ? outdoorReading.timestamp.toISOString() : null,
        formattedLastReadingTime: formatIST(outdoorReading?.timestamp),
        cloudOnline: outdoorReading?.cloud_online ?? false,
        systemStatus,
        ph: outdoorReading?.m2_ph ?? outdoorReading?.m1_ph ?? null,
        ec: outdoorReading?.m2_ec ?? outdoorReading?.m1_ec ?? null,
        waterLevel: outdoorReading?.waterLevel ?? null,
        tanks,
      };
    }

    // Individual farm summaries
    const farms: FarmSummary[] = user.farm.map((f) => ({
      farmId: f.id,
      name: f.name,
      crop: f.plant?.plantName || f.boundaries.find((b) => b.cropType)?.cropType || null,
      cropType: f.plant?.plantName || null,
      totalArea: f.totalArea || 0,
      totalAreaAcres: f.totalAreaAcres || 0,
      location: f.location as any,
      boundaryCount: f.boundaries.length,
      deviceCount: f.devices.length,
      latestReadingTime: latestTimestamp ? latestTimestamp.toISOString() : null,
      formattedReadingTime: formatIST(latestTimestamp),
      readingStatus,
    }));

    // Complete latest reading JSON payload for the eye popup
    const latestReadingRaw = envReading
      ? {
          telemetry_id: envReading.id,
          timestamp_iso: envReading.timestamp ? envReading.timestamp.toISOString() : null,
          timestamp_ist: formatIST(envReading.timestamp),
          climate: {
            temperature_c: envReading.temperature,
            humidity_pct: envReading.humidity,
            wind_speed_ms: envReading.windSpeed,
            direct_radiation_wm2: envReading.directRadiation,
            par_umol_m2_s: envReading.par,
            vpd_kpa: envReading.vpd,
            evapotranspiration_mm_day: envReading.evapotranspiration,
            co2_ppm: envReading.co2,
            gdd: envReading.gdd,
          },
          soil_root_zone: {
            soil_temperature_c: envReading.soilTemperature,
            soil_moisture_pct: envReading.soilMoisture,
            soil_ec_mscm: envReading.soilElectroConductivity,
            nitrogen_n_mgkg: envReading.soilNitrogen,
            phosphorus_p_mgkg: envReading.soilPhosphorus,
            potassium_k_mgkg: envReading.soilPotassium,
            ph_master: envReading.phMaster,
            ph_slave: envReading.phSlave,
          },
          power_system: {
            battery_percentage: envReading.batteryPercentage,
            battery_voltage_v: envReading.batteryVoltage,
            battery_current_ma: envReading.batteryCurrent,
            battery_charging_status: envReading.batteryChargingStatus,
            is_charging: envReading.isCharging,
          },
          reading_status: readingStatus,
        }
      : outdoorReading
      ? {
          timestamp_iso: outdoorReading.timestamp ? outdoorReading.timestamp.toISOString() : null,
          timestamp_ist: formatIST(outdoorReading.timestamp),
          fertigation: {
            system_status: fertigation?.systemStatus || 'UNKNOWN',
            ph: outdoorReading.m2_ph ?? outdoorReading.m1_ph,
            ec_mscm: outdoorReading.m2_ec ?? outdoorReading.m1_ec,
            water_level_pct: outdoorReading.waterLevel,
            tank_1_nutrient_pct: outdoorReading.n1_pct,
            tank_2_nutrient_pct: outdoorReading.n2_pct,
            ph_up_pct: outdoorReading.ph_up_pct,
            ph_down_pct: outdoorReading.ph_dn_pct,
            tank_5_pct: outdoorReading.t5_pct,
            cloud_online: outdoorReading.cloud_online,
          },
          reading_status: readingStatus,
        }
      : null;

    return {
      customerId: user.id,
      customerName: user.userName || user.email.split('@')[0],
      email: user.email,
      mobile: user.mobileNumber,
      place: user.area || null,
      status: user.status || 'ACTIVE',
      role: String(user.role),
      createdAt: user.createdAt ? user.createdAt.toISOString() : null,
      formattedCreatedAt: formatIST(user.createdAt, 'dd MMM yyyy'),
      farmCount,
      crops,
      deviceCount,
      deviceCategories,
      latestReadingTime: latestTimestamp ? latestTimestamp.toISOString() : null,
      formattedReadingTime: formatIST(latestTimestamp),
      readingStatus,
      battery,
      fertigation,
      farms,
      latestReadingRaw,
    };
  });

  // If status filter is applied, filter in-memory if needed
  let filteredCustomers = customers;
  if (params.status) {
    filteredCustomers = customers.filter(
      (c) => c.readingStatus.toLowerCase() === params.status?.toLowerCase()
    );
  }

  const result = {
    customers: filteredCustomers,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };

  // Cache for 20 seconds
  memoryCache.set(cacheKey, result, 20);

  return result;
}

export async function getCustomerById(userId: number, forceFresh = false) {
  const cacheKey = `customer:${userId}`;
  if (!forceFresh) {
    const cached = memoryCache.get<any>(cacheKey);
    if (cached) return cached;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      farm: {
        include: {
          plant: true,
          boundaries: true,
          devices: true,
        },
      },
      NodeRedDeviceDetails: true,
      fertigationSettings: {
        include: {
          tanks: true,
        },
      },
    },
  });

  if (!user) return null;

  const farmIds = user.farm.map((f) => f.id);

  // Parallel fetch: user latest readings + all farm latest readings + Device table records
  const [latestEnv, latestOutdoor, farmEnvReadings, farmOutdoorReadings, userDevices] = await Promise.all([
    prisma.environmentalReading.findFirst({
      where: { userId },
      orderBy: { timestamp: 'desc' },
    }),
    prisma.outdoorReading.findFirst({
      where: { userId },
      orderBy: { timestamp: 'desc' },
    }),
    farmIds.length > 0
      ? prisma.$queryRaw<any[]>`
          WITH Ranked AS (
            SELECT 
              id, timestamp, "userId", "farmId", "boundaryId",
              temperature, humidity, "windSpeed", "directRadiation", par, vpd, evapotranspiration, gdd, co2,
              "soilTemperature", "soilMoisture", "soilElectroConductivity",
              n_sensor as "soilNitrogen", p_sensor as "soilPhosphorus", k_sensor as "soilPotassium",
              ph as "phMaster", "phSlave",
              battery_percentage as "batteryPercentage",
              battery_voltage as "batteryVoltage",
              battery_current as "batteryCurrent",
              battery_charging_status as "batteryChargingStatus",
              is_charging as "isCharging",
              ROW_NUMBER() OVER (PARTITION BY "farmId" ORDER BY timestamp DESC) as rn
            FROM "EnvironmentalReading"
            WHERE "farmId" IN (${Prisma.join(farmIds)})
          )
          SELECT * FROM Ranked WHERE rn = 1;
        `.catch(() => [])
      : Promise.resolve([]),
    farmIds.length > 0
      ? prisma.$queryRaw<any[]>`
          WITH RankedOutdoor AS (
            SELECT 
              id, timestamp, user_id as "userId", farm_id as "farmId", device_id as "deviceId", boundary_id as "boundaryId",
              ready, safe, alert, failsafe, e_stop, cloud_online,
              m1_ec, m2_ec, m1_ph, m2_ph, water_level as "waterLevel",
              n1_pct, n2_pct, ph_up_pct, ph_dn_pct, t5_pct,
              ROW_NUMBER() OVER (PARTITION BY farm_id ORDER BY timestamp DESC) as rn
            FROM outdoorreading
            WHERE farm_id IN (${Prisma.join(farmIds)})
          )
          SELECT * FROM RankedOutdoor WHERE rn = 1;
        `.catch(() => [])
      : Promise.resolve([]),
    prisma.device.findMany({
      where: { emailId: { equals: user.email, mode: 'insensitive' } },
    }),
  ]);

  const farmEnvMap = new Map<string, any>();
  farmEnvReadings.forEach((r) => {
    if (r.farmId) {
      farmEnvMap.set(r.farmId, {
        ...r,
        timestamp: r.timestamp ? new Date(r.timestamp) : null,
      });
    }
  });

  const farmOutdoorMap = new Map<string, any>();
  farmOutdoorReadings.forEach((r) => {
    if (r.farmId) {
      farmOutdoorMap.set(r.farmId, {
        ...r,
        timestamp: r.timestamp ? new Date(r.timestamp) : null,
      });
    }
  });

  let latestTimestamp: Date | null = null;
  if (latestEnv?.timestamp && latestOutdoor?.timestamp) {
    latestTimestamp = latestEnv.timestamp > latestOutdoor.timestamp ? latestEnv.timestamp : latestOutdoor.timestamp;
  } else if (latestEnv?.timestamp) {
    latestTimestamp = latestEnv.timestamp;
  } else if (latestOutdoor?.timestamp) {
    latestTimestamp = latestOutdoor.timestamp;
  }

  const readingStatus = calculateReadingStatus(latestTimestamp);
  const battery = calculateBatterySummary(latestEnv);

  // Compute per-farm telemetry synchronously in memory from the batched query results
  const farmReadings = user.farm.map((f) => {
    const farmEnv = farmEnvMap.get(f.id) || latestEnv;
    const farmOutdoor = farmOutdoorMap.get(f.id) || latestOutdoor;

    const activeEnv = farmEnv;
    const activeOutdoor = farmOutdoor;

    let farmLatestTimestamp: Date | null = null;
    if (activeEnv?.timestamp && activeOutdoor?.timestamp) {
      farmLatestTimestamp = activeEnv.timestamp > activeOutdoor.timestamp ? activeEnv.timestamp : activeOutdoor.timestamp;
    } else if (activeEnv?.timestamp) {
      farmLatestTimestamp = activeEnv.timestamp;
    } else if (activeOutdoor?.timestamp) {
      farmLatestTimestamp = activeOutdoor.timestamp;
    }

    const farmStatus = calculateReadingStatus(farmLatestTimestamp);
    const farmBattery = calculateBatterySummary(activeEnv);

    // Resolve source device or boundary where the reading came from
    const matchedBoundary = f.boundaries.find((b: any) => b.id === (activeEnv?.boundaryId || activeOutdoor?.boundaryId));
    const matchedDevice = f.devices.find((d: any) => d.id === activeOutdoor?.deviceId || d.deviceId === activeOutdoor?.deviceId) || f.devices[0];
    
    const sourceName = [
      matchedBoundary ? `Plot: ${matchedBoundary.name}` : null,
      matchedDevice ? `Node: ${matchedDevice.deviceName || matchedDevice.deviceId}` : null,
    ].filter(Boolean).join(' • ') || (f.devices.length > 0 ? `Node: ${f.devices[0].deviceName || f.devices[0].deviceId}` : 'IoT Environmental Sensor');

    const latestTelemetry = activeEnv
      ? {
          timestamp: activeEnv.timestamp ? activeEnv.timestamp.toISOString() : null,
          formattedTimestamp: formatIST(activeEnv.timestamp),
          sourceName,
          sourceDevice: matchedDevice ? { id: matchedDevice.id, deviceId: matchedDevice.deviceId, name: matchedDevice.deviceName, category: matchedDevice.deviceCategory } : null,
          sourceBoundary: matchedBoundary ? { id: matchedBoundary.id, name: matchedBoundary.name, cropType: matchedBoundary.cropType } : null,
          temperature: activeEnv.temperature !== null && activeEnv.temperature !== undefined ? Math.round(activeEnv.temperature * 10) / 10 : null,
          humidity: activeEnv.humidity !== null && activeEnv.humidity !== undefined ? Math.round(activeEnv.humidity * 10) / 10 : null,
          soilMoisture: activeEnv.soilMoisture !== null && activeEnv.soilMoisture !== undefined ? Math.round(activeEnv.soilMoisture * 10) / 10 : null,
          soilTemperature: activeEnv.soilTemperature !== null && activeEnv.soilTemperature !== undefined ? Math.round(activeEnv.soilTemperature * 10) / 10 : null,
          soilElectroConductivity: activeEnv.soilElectroConductivity !== null && activeEnv.soilElectroConductivity !== undefined ? Math.round(activeEnv.soilElectroConductivity * 100) / 100 : null,
          soilNitrogen: activeEnv.soilNitrogen !== null && activeEnv.soilNitrogen !== undefined ? Math.round(activeEnv.soilNitrogen * 10) / 10 : null,
          soilPhosphorus: activeEnv.soilPhosphorus !== null && activeEnv.soilPhosphorus !== undefined ? Math.round(activeEnv.soilPhosphorus * 10) / 10 : null,
          soilPotassium: activeEnv.soilPotassium !== null && activeEnv.soilPotassium !== undefined ? Math.round(activeEnv.soilPotassium * 10) / 10 : null,
          phMaster: activeEnv.phMaster !== null && activeEnv.phMaster !== undefined ? Math.round(activeEnv.phMaster * 100) / 100 : null,
          vpd: activeEnv.vpd !== null && activeEnv.vpd !== undefined ? Math.round(activeEnv.vpd * 100) / 100 : null,
          co2: activeEnv.co2 !== null && activeEnv.co2 !== undefined ? Math.round(activeEnv.co2) : null,
          directRadiation: activeEnv.directRadiation !== null && activeEnv.directRadiation !== undefined ? Math.round(activeEnv.directRadiation * 10) / 10 : null,
          par: activeEnv.par !== null && activeEnv.par !== undefined ? Math.round(activeEnv.par * 10) / 10 : null,
          batteryPercentage: activeEnv.batteryPercentage !== null && activeEnv.batteryPercentage !== undefined ? Math.round(activeEnv.batteryPercentage) : null,
          batteryVoltage: activeEnv.batteryVoltage !== null && activeEnv.batteryVoltage !== undefined ? Math.round(activeEnv.batteryVoltage * 100) / 100 : null,
          isCharging: activeEnv.isCharging ?? false,
        }
      : null;

    const rawJsonPayload = activeEnv
      ? {
          farm_id: f.id,
          farm_name: f.name,
          crop: f.plant?.plantName || null,
          telemetry_id: activeEnv.id,
          timestamp_iso: activeEnv.timestamp ? activeEnv.timestamp.toISOString() : null,
          timestamp_ist: formatIST(activeEnv.timestamp),
          source_origin: sourceName,
          climate: {
            temperature_c: activeEnv.temperature,
            humidity_pct: activeEnv.humidity,
            vpd_kpa: activeEnv.vpd,
            co2_ppm: activeEnv.co2,
            wind_speed_ms: activeEnv.windSpeed,
            direct_radiation_wm2: activeEnv.directRadiation,
            par_umol_m2_s: activeEnv.par,
          },
          soil_root_zone: {
            soil_temperature_c: activeEnv.soilTemperature,
            soil_moisture_pct: activeEnv.soilMoisture,
            soil_ec_mscm: activeEnv.soilElectroConductivity,
            nitrogen_n_mgkg: activeEnv.soilNitrogen,
            phosphorus_p_mgkg: activeEnv.soilPhosphorus,
            potassium_k_mgkg: activeEnv.soilPotassium,
            ph_master: activeEnv.phMaster,
          },
          power: {
            battery_percentage: activeEnv.batteryPercentage,
            battery_voltage_v: activeEnv.batteryVoltage,
            battery_current_ma: activeEnv.batteryCurrent,
            is_charging: activeEnv.isCharging,
          },
          reading_status: farmStatus,
        }
      : null;

    return {
      id: f.id,
      name: f.name,
      plantId: f.plantId,
      plantName: f.plant?.plantName || f.boundaries.find((b) => b.cropType)?.cropType || 'Crop set',
      crop: f.plant?.plantName || f.boundaries.find((b) => b.cropType)?.cropType || null,
      cropType: f.plant?.plantName || null,
      totalArea: f.totalArea,
      totalAreaAcres: f.totalAreaAcres,
      location: f.location,
      boundaryCount: f.boundaries.length,
      deviceCount: f.devices.length,
      boundaries: f.boundaries,
      devices: f.devices,
      readingStatus: farmStatus,
      latestReadingTime: farmLatestTimestamp ? farmLatestTimestamp.toISOString() : null,
      formattedReadingTime: formatIST(farmLatestTimestamp),
      battery: farmBattery,
      latestTelemetry,
      latestReadingRaw: rawJsonPayload,
    };
  });

  const result = {
    user: {
      id: user.id,
      userName: user.userName,
      email: user.email,
      mobileNumber: user.mobileNumber,
      area: user.area,
      status: user.status,
      role: user.role,
      createdAt: user.createdAt,
      formattedCreatedAt: formatIST(user.createdAt),
      farmCount: user.farm.length,
      deviceCount: userDevices.length || user.NodeRedDeviceDetails.length,
      readingStatus,
      latestReadingTime: latestTimestamp ? latestTimestamp.toISOString() : null,
      formattedReadingTime: formatIST(latestTimestamp),
      battery,
    },
    farms: farmReadings,
    devices: userDevices.length > 0
      ? userDevices.map((d) => ({
          id: d.id,
          deviceId: d.deviceId,
          deviceName: d.deviceId,
          deviceCategory: d.hasValve
            ? 'valve'
            : d.hasAppliance
            ? 'appliance'
            : d.hasOutdoorFertigation
            ? 'outdoor fertigation'
            : d.hasIndoorFertigation
            ? 'indoor fertigation'
            : d.hasBCS
            ? 'battery sensor'
            : 'device',
          hasValve: d.hasValve,
          hasAppliance: d.hasAppliance,
          hasOutdoorFertigation: d.hasOutdoorFertigation,
          hasIndoorFertigation: d.hasIndoorFertigation,
          hasBCS: d.hasBCS,
          cloudStatus: 'ONLINE',
          lastHeartbeatAt: null,
          formattedHeartbeatAt: 'Active',
          lastAckAt: null,
          failSafeStatus: 'NORMAL',
          farmId: null,
          boundaryId: null,
        }))
      : user.NodeRedDeviceDetails.map((d) => ({
          id: d.id,
          deviceId: d.deviceId,
          deviceName: d.deviceName,
          deviceCategory: d.deviceCategory,
          cloudStatus: d.cloudStatus,
          lastHeartbeatAt: d.lastHeartbeatAt,
          formattedHeartbeatAt: formatIST(d.lastHeartbeatAt),
          lastAckAt: d.lastAckAt,
          failSafeStatus: d.failSafeStatus,
          farmId: d.farmId,
          boundaryId: d.boundaryId,
        })),
    fertigation: userDevices.some((d) => d.hasOutdoorFertigation || d.hasIndoorFertigation)
      ? await getLatestFertigation(undefined, user.id)
      : null,
    latestEnvironmentalReading: latestEnv
      ? {
          ...latestEnv,
          formattedTimestamp: formatIST(latestEnv.timestamp),
        }
      : null,
    latestOutdoorReading: latestOutdoor
      ? {
          ...latestOutdoor,
          formattedTimestamp: formatIST(latestOutdoor.timestamp),
        }
      : null,
  };

  // Cache for 30 seconds
  memoryCache.set(cacheKey, result, 30);

  return result;
}
