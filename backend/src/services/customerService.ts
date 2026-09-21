import prisma from '../config/db.js';
import { Prisma } from '@prisma/client';
import { CustomerDashboardSummary, FarmSummary } from '../types/index.js';
import { formatIST } from '../utils/timezone.js';
import { calculateReadingStatus, calculateBatterySummary } from '../utils/status.js';
import { memoryCache } from '../utils/cache.js';
import { getLatestFertigation } from './fertigationService.js';
import { deviceStatusStore, normalizeValveState, normalizeApplianceState } from './deviceStatusStore.js';

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
  const { forceFresh, ...filterParams } = params;
  const cacheKey = `customers:${JSON.stringify(filterParams)}`;

  return memoryCache.getOrFetch(
    cacheKey,
    async () => {
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

      // Step 1: Count total matching users and fetch paginated basic user records in parallel
      const [total, users] = await Promise.all([
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
          },
        }),
      ]);

      const userIds = users.map((u) => u.id);
      const userEmails = users.map((u) => u.email).filter(Boolean) as string[];

      // Step 2: Parallel batch query of all relations, devices, and distinct readings in 1 concurrent round-trip
      const [farms, fertSettingsList, pageDevices, envReadings, outdoorReadings] = await Promise.all([
        userIds.length > 0
          ? prisma.farm.findMany({
              where: { userId: { in: userIds } },
              select: {
                id: true,
                userId: true,
                name: true,
                totalArea: true,
                totalAreaAcres: true,
                location: true,
                plant: { select: { plantName: true } },
                boundaries: { select: { id: true, name: true, cropType: true, area: true, areaAcres: true } },
                devices: { select: { id: true } },
              },
            })
          : Promise.resolve([]),
        userIds.length > 0
          ? prisma.fertigationSettings.findMany({
              where: { userId: { in: userIds } },
              select: {
                userId: true,
                tanks: {
                  select: {
                    tankKey: true,
                    name: true,
                    nutrient: true,
                  },
                },
              },
            })
          : Promise.resolve([]),
        userEmails.length > 0
          ? prisma.device.findMany({
              where: {
                emailId: { in: userEmails },
              },
              select: {
                id: true,
                emailId: true,
                hasValve: true,
                hasAppliance: true,
                hasOutdoorFertigation: true,
                hasIndoorFertigation: true,
                hasBCS: true,
              },
            })
          : Promise.resolve([]),
        userIds.length > 0
          ? prisma.$queryRaw<any[]>`
              SELECT DISTINCT ON ("userId")
                id, timestamp, "userId", "farmId", "boundaryId",
                temperature, humidity, "windSpeed", "directRadiation", par, vpd, evapotranspiration, gdd, co2,
                "soilTemperature", "soilMoisture", "soilElectroConductivity",
                n_sensor as "soilNitrogen", p_sensor as "soilPhosphorus", k_sensor as "soilPotassium",
                ph as "phMaster", "phSlave",
                battery_percentage as "batteryPercentage",
                battery_voltage as "batteryVoltage",
                battery_current as "batteryCurrent",
                battery_charging_status as "batteryChargingStatus",
                is_charging as "isCharging"
              FROM "EnvironmentalReading"
              WHERE "userId" IN (${Prisma.join(userIds)})
              ORDER BY "userId", timestamp DESC;
            `.catch((err) => {
              console.error('Error in batch envReadings query:', err);
              return [];
            })
          : Promise.resolve([]),
        userIds.length > 0
          ? prisma.$queryRaw<any[]>`
              SELECT DISTINCT ON (user_id)
                id, timestamp, user_id as "userId", farm_id as "farmId", device_id as "deviceId",
                ready, safe, alert, failsafe, e_stop, cloud_online,
                m1_ec, m2_ec, m1_ph, m2_ph, water_level as "waterLevel",
                n1_pct, n2_pct, ph_up_pct, ph_dn_pct, t5_pct
              FROM outdoorreading
              WHERE user_id IN (${Prisma.join(userIds)})
              ORDER BY user_id, timestamp DESC;
            `.catch((err) => {
              console.error('Error in batch outdoorReadings query:', err);
              return [];
            })
          : Promise.resolve([]),
      ]);

      // In-memory indexing of sub-relations
      const farmsByUser = new Map<number, any[]>();
      farms.forEach((f) => {
        const list = farmsByUser.get(f.userId) || [];
        list.push(f);
        farmsByUser.set(f.userId, list);
      });

      const fertSettingsByUser = new Map<number, any>();
      fertSettingsList.forEach((s) => {
        fertSettingsByUser.set(s.userId, s);
      });

      const envReadingMap = new Map<number, any>();
      const outdoorReadingMap = new Map<number, any>();

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

      const customers: CustomerDashboardSummary[] = users.map((user) => {
        const userFarms = farmsByUser.get(user.id) || [];
        const fertSetting = fertSettingsByUser.get(user.id) || null;

        // Dynamic farm count
        const farmCount = userFarms.length;

        // Collect distinct crops from farm plants and boundary cropTypes
        const cropSet = new Set<string>();
        userFarms.forEach((f) => {
          if (f.plant?.plantName) cropSet.add(f.plant.plantName);
          f.boundaries.forEach((b: any) => {
            if (b.cropType) cropSet.add(b.cropType);
          });
        });
        const crops = Array.from(cropSet);

        // Dynamic device count and categories from Device table
        const userDevices = pageDevices.filter(
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
        if (hasFertigationCapability && (outdoorReading || fertSetting)) {
          const configuredTanks = fertSetting?.tanks || [];

          // Determine system status
          let systemStatus: 'READY' | 'ACTIVE' | 'ALERT' | 'FAILSAFE' | 'ESTOP' | 'UNKNOWN' = 'UNKNOWN';
          if (outdoorReading?.e_stop) systemStatus = 'ESTOP';
          else if (outdoorReading?.failsafe) systemStatus = 'FAILSAFE';
          else if (outdoorReading?.alert && outdoorReading.alert > 0) systemStatus = 'ALERT';
          else if (outdoorReading?.ready) systemStatus = 'READY';
          else if (outdoorReading) systemStatus = 'ACTIVE';

          // Map tanks
          const tanks = configuredTanks.map((tank: any) => {
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
        const farms: FarmSummary[] = userFarms.map((f) => ({
          farmId: f.id,
          name: f.name,
          crop: f.plant?.plantName || f.boundaries.find((b: any) => b.cropType)?.cropType || null,
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

      return {
        customers: filteredCustomers,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      };
    },
    60, // 60 seconds fresh TTL
    params.forceFresh,
    120 // 120 seconds stale grace
  );
}

function mergeLatestReading(readings: any[]): any {
  if (!readings || readings.length === 0) return null;
  const latest = readings[0];
  const findVal = (getter: (r: any) => any) => {
    for (const r of readings) {
      const v = getter(r);
      if (v !== null && v !== undefined) return v;
    }
    return null;
  };

  return {
    id: latest.id,
    timestamp: latest.timestamp,
    userId: latest.userId,
    farmId: latest.farmId,
    boundaryId: latest.boundaryId,
    temperature: findVal((r) => r.temperature),
    humidity: findVal((r) => r.humidity),
    windSpeed: findVal((r) => r.windSpeed),
    directRadiation: findVal((r) => r.directRadiation),
    par: findVal((r) => r.par),
    vpd: findVal((r) => r.vpd),
    evapotranspiration: findVal((r) => r.evapotranspiration),
    gdd: findVal((r) => r.gdd),
    co2: findVal((r) => r.co2),
    soilTemperature: findVal((r) => r.soilTemperature),
    soilMoisture: findVal((r) => r.soilMoisture),
    soilElectroConductivity:
      findVal((r) => (r.soilElectroConductivity !== 0 ? r.soilElectroConductivity : null)) ??
      latest.soilElectroConductivity,
    soilNitrogen: findVal((r) => r.n_sensor),
    soilPhosphorus: findVal((r) => r.p_sensor),
    soilPotassium: findVal((r) => r.k_sensor),
    phMaster: findVal((r) => r.ph),
    phSlave: findVal((r) => r.phSlave),
    batteryPercentage: findVal((r) => r.battery_percentage),
    batteryVoltage: findVal((r) => r.battery_voltage),
    batteryCurrent: findVal((r) => r.battery_current),
    batteryChargingStatus: findVal((r) => r.battery_charging_status),
    isCharging: findVal((r) => r.is_charging) ?? false,
  };
}

export async function getCustomerById(userId: number, forceFresh = false) {
  const cacheKey = `customer:${userId}`;

  return memoryCache.getOrFetch(
    cacheKey,
    async () => {
      // Step 1: Flat parallel fetch of all required relations (1 concurrent network round-trip)
      const [
        user,
        farms,
        nodeDevices,
        fertSettings,
        envReadings,
        outdoorReadings,
        indoorReadings,
        userDevices,
        sensorValidities,
      ] = await Promise.all([
        prisma.user.findUnique({
          where: { id: userId },
          select: {
            id: true,
            userName: true,
            email: true,
            mobileNumber: true,
            area: true,
            status: true,
            role: true,
            createdAt: true,
          },
        }),
        prisma.farm.findMany({
          where: { userId },
          include: {
            plant: { select: { plantName: true } },
            boundaries: { select: { id: true, name: true, cropType: true, area: true, areaAcres: true } },
            devices: { select: { id: true, deviceId: true, deviceName: true, deviceCategory: true, cloudStatus: true } },
          },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.nodeRedDeviceDetails.findMany({
          where: { userId },
          select: {
            id: true,
            deviceId: true,
            deviceName: true,
            deviceCategory: true,
            selectedValve: true,
            cloudStatus: true,
            lastHeartbeatAt: true,
            lastAckAt: true,
            failSafeStatus: true,
            failSafeReason: true,
            farmId: true,
            boundaryId: true,
            ActivateSettings: { orderBy: { id: 'desc' }, take: 1 },
            DeviceRuntimeLog: { orderBy: { turnedOnAt: 'desc' }, take: 1 },
          },
        }),
        prisma.fertigationSettings.findFirst({
          where: { userId },
          include: { tanks: true },
        }),
        prisma.environmentalReading.findMany({
          where: { userId },
          orderBy: { timestamp: 'desc' },
          take: 50,
        }),
        prisma.outdoorReading.findMany({
          where: { userId },
          orderBy: { timestamp: 'desc' },
          take: 50,
        }),
        prisma.indoorReading.findMany({
          where: { userId },
          orderBy: { timestamp: 'desc' },
          take: 50,
        }),
        prisma.device.findMany({
          where: { userId: String(userId) },
        }),
        prisma.sensorValidity.findMany({
          where: { userId },
          include: { farm: true, boundary: true },
        }),
      ]);

      if (!user) return null;

      // In-memory latest merged readings
      const latestEnv = mergeLatestReading(envReadings);
      const latestOutdoor = outdoorReadings[0] || null;
      const latestIndoor = indoorReadings[0] || null;

      let latestTimestamp: Date | null = null;
      if (latestEnv?.timestamp && latestOutdoor?.timestamp) {
        const envD = new Date(latestEnv.timestamp);
        const outD = new Date(latestOutdoor.timestamp);
        latestTimestamp = envD > outD ? envD : outD;
      } else if (latestEnv?.timestamp) {
        latestTimestamp = new Date(latestEnv.timestamp);
      } else if (latestOutdoor?.timestamp) {
        latestTimestamp = new Date(latestOutdoor.timestamp);
      }

      const readingStatus = calculateReadingStatus(latestTimestamp);
      const battery = calculateBatterySummary(latestEnv);

      // Fertigation summary resolved in memory
      let fertigation = null;
      if (fertSettings && (latestOutdoor || latestIndoor || fertSettings.tanks.length > 0)) {
        const activeFertReading = latestOutdoor || latestIndoor;
        let systemStatus: 'READY' | 'ACTIVE' | 'ALERT' | 'FAILSAFE' | 'ESTOP' | 'UNKNOWN' = 'UNKNOWN';
        if (activeFertReading?.e_stop) systemStatus = 'ESTOP';
        else if (activeFertReading?.failsafe) systemStatus = 'FAILSAFE';
        else if (activeFertReading?.alert && activeFertReading.alert > 0) systemStatus = 'ALERT';
        else if (activeFertReading?.ready) systemStatus = 'READY';
        else if (activeFertReading) systemStatus = 'ACTIVE';

        const tanks = (fertSettings.tanks || []).map((tank) => {
          let levelPercentage: number | null = null;
          if (tank.tankKey === 'tank-1' || tank.tankKey === 'n1') levelPercentage = activeFertReading?.n1_pct ?? null;
          else if (tank.tankKey === 'tank-2' || tank.tankKey === 'n2') levelPercentage = activeFertReading?.n2_pct ?? null;
          else if (tank.tankKey === 'ph_up') levelPercentage = activeFertReading?.ph_up_pct ?? null;
          else if (tank.tankKey === 'ph_dn') levelPercentage = activeFertReading?.ph_dn_pct ?? null;
          else if (tank.tankKey === 'tank-5' || tank.tankKey === 't5') levelPercentage = activeFertReading?.t5_pct ?? null;

          return {
            tankKey: tank.tankKey,
            name: tank.name || tank.nutrient || tank.tankKey,
            nutrient: tank.nutrient || 'General',
            levelPercentage,
            levelCm: null,
          };
        });

        fertigation = {
          lastReadingTime: activeFertReading?.timestamp ? activeFertReading.timestamp.toISOString() : null,
          formattedLastReadingTime: formatIST(activeFertReading?.timestamp),
          cloudOnline: activeFertReading?.cloud_online ?? false,
          systemStatus,
          ph: activeFertReading?.m2_ph ?? activeFertReading?.m1_ph ?? null,
          ec: activeFertReading?.m2_ec ?? activeFertReading?.m1_ec ?? null,
          waterLevel: activeFertReading?.waterLevel ?? null,
          tanks,
          sensorValidities: sensorValidities.map((v) => ({
            id: v.id,
            sensorType: v.sensor,
            status: v.status,
            isValid: v.status === 'active' && new Date(v.validityEndDate) > new Date(),
            farmName: v.farm?.name || null,
            boundaryName: v.boundary?.name || null,
          })),
        };
      }

      // Compute per-farm telemetry synchronously in memory from the cached reading pools
      const farmReadings = farms.map((f: any) => {
        const farmEnvList = envReadings.filter((r) => r.farmId === f.id);
        const farmOutdoorList = outdoorReadings.filter((r) => r.farmId === f.id);

        const farmEnv = mergeLatestReading(farmEnvList) || latestEnv;
        const farmOutdoor = farmOutdoorList[0] || latestOutdoor;

        const activeEnv = farmEnv;
        const activeOutdoor = farmOutdoor;

        let farmLatestTimestamp: Date | null = null;
        if (activeEnv?.timestamp && activeOutdoor?.timestamp) {
          const envD = new Date(activeEnv.timestamp);
          const outD = new Date(activeOutdoor.timestamp);
          farmLatestTimestamp = envD > outD ? envD : outD;
        } else if (activeEnv?.timestamp) {
          farmLatestTimestamp = new Date(activeEnv.timestamp);
        } else if (activeOutdoor?.timestamp) {
          farmLatestTimestamp = new Date(activeOutdoor.timestamp);
        }

        const farmStatus = calculateReadingStatus(farmLatestTimestamp);
        const farmBattery = calculateBatterySummary(activeEnv);

        // Resolve source device or boundary where the reading came from
        const matchedBoundary = f.boundaries.find(
          (b: any) => b.id === (activeEnv?.boundaryId || activeOutdoor?.boundaryId)
        );
        const matchedDevice =
          f.devices.find((d: any) => d.id === activeOutdoor?.deviceId || d.deviceId === activeOutdoor?.deviceId) ||
          f.devices[0];

        const sourceName =
          [
            matchedBoundary ? `Plot: ${matchedBoundary.name}` : null,
            matchedDevice ? `Node: ${matchedDevice.deviceName || matchedDevice.deviceId}` : null,
          ]
            .filter(Boolean)
            .join(' • ') ||
          (f.devices.length > 0
            ? `Node: ${f.devices[0].deviceName || f.devices[0].deviceId}`
            : 'IoT Environmental Sensor');

        const latestTelemetry = activeEnv
          ? {
              timestamp: activeEnv.timestamp ? new Date(activeEnv.timestamp).toISOString() : null,
              formattedTimestamp: formatIST(activeEnv.timestamp),
              sourceName,
              sourceDevice: matchedDevice
                ? {
                    id: matchedDevice.id,
                    deviceId: matchedDevice.deviceId,
                    name: matchedDevice.deviceName,
                    category: matchedDevice.deviceCategory,
                  }
                : null,
              sourceBoundary: matchedBoundary
                ? {
                    id: matchedBoundary.id,
                    name: matchedBoundary.name,
                    cropType: matchedBoundary.cropType,
                  }
                : null,
              temperature:
                activeEnv.temperature !== null && activeEnv.temperature !== undefined
                  ? Math.round(activeEnv.temperature * 10) / 10
                  : null,
              humidity:
                activeEnv.humidity !== null && activeEnv.humidity !== undefined
                  ? Math.round(activeEnv.humidity * 10) / 10
                  : null,
              soilMoisture:
                activeEnv.soilMoisture !== null && activeEnv.soilMoisture !== undefined
                  ? Math.round(activeEnv.soilMoisture * 10) / 10
                  : null,
              soilTemperature:
                activeEnv.soilTemperature !== null && activeEnv.soilTemperature !== undefined
                  ? Math.round(activeEnv.soilTemperature * 10) / 10
                  : null,
              soilElectroConductivity:
                activeEnv.soilElectroConductivity !== null && activeEnv.soilElectroConductivity !== undefined
                  ? Math.round(activeEnv.soilElectroConductivity * 100) / 100
                  : null,
              soilNitrogen:
                activeEnv.soilNitrogen !== null && activeEnv.soilNitrogen !== undefined
                  ? Math.round(activeEnv.soilNitrogen * 10) / 10
                  : null,
              soilPhosphorus:
                activeEnv.soilPhosphorus !== null && activeEnv.soilPhosphorus !== undefined
                  ? Math.round(activeEnv.soilPhosphorus * 10) / 10
                  : null,
              soilPotassium:
                activeEnv.soilPotassium !== null && activeEnv.soilPotassium !== undefined
                  ? Math.round(activeEnv.soilPotassium * 10) / 10
                  : null,
              phMaster:
                activeEnv.phMaster !== null && activeEnv.phMaster !== undefined
                  ? Math.round(activeEnv.phMaster * 100) / 100
                  : null,
              vpd:
                activeEnv.vpd !== null && activeEnv.vpd !== undefined
                  ? Math.round(activeEnv.vpd * 100) / 100
                  : null,
              co2: activeEnv.co2 !== null && activeEnv.co2 !== undefined ? Math.round(activeEnv.co2) : null,
              directRadiation:
                activeEnv.directRadiation !== null && activeEnv.directRadiation !== undefined
                  ? Math.round(activeEnv.directRadiation * 10) / 10
                  : null,
              par: activeEnv.par !== null && activeEnv.par !== undefined ? Math.round(activeEnv.par * 10) / 10 : null,
              batteryPercentage:
                activeEnv.batteryPercentage !== null && activeEnv.batteryPercentage !== undefined
                  ? Math.round(activeEnv.batteryPercentage)
                  : null,
              batteryVoltage:
                activeEnv.batteryVoltage !== null && activeEnv.batteryVoltage !== undefined
                  ? Math.round(activeEnv.batteryVoltage * 100) / 100
                  : null,
              isCharging: activeEnv.isCharging ?? false,
            }
          : null;

        const rawJsonPayload = activeEnv
          ? {
              farm_id: f.id,
              farm_name: f.name,
              crop: f.plant?.plantName || null,
              telemetry_id: activeEnv.id,
              timestamp_iso: activeEnv.timestamp ? new Date(activeEnv.timestamp).toISOString() : null,
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
          plantName: f.plant?.plantName || f.boundaries.find((b: any) => b.cropType)?.cropType || 'Crop set',
          crop: f.plant?.plantName || f.boundaries.find((b: any) => b.cropType)?.cropType || null,
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
          farmCount: farms.length,
          deviceCount: userDevices.length || nodeDevices.length,
          readingStatus,
          latestReadingTime: latestTimestamp ? latestTimestamp.toISOString() : null,
          formattedReadingTime: formatIST(latestTimestamp),
          battery,
        },
        farms: farmReadings,
        devices:
          nodeDevices.length > 0
            ? (nodeDevices as any[]).map((d) => {
                const isValve = (d.deviceCategory || '').toLowerCase().includes('valve');
                const isAppliance =
                  (d.deviceCategory || '').toLowerCase().includes('pump') ||
                  (d.deviceCategory || '').toLowerCase().includes('fan') ||
                  (d.deviceCategory || '').toLowerCase().includes('socket') ||
                  (d.deviceCategory || '').toLowerCase().includes('ac') ||
                  (d.deviceCategory || '').toLowerCase().includes('appliance');

                let physicalState: 'OPEN' | 'CLOSED' | 'ON' | 'OFF' | 'UNKNOWN' = 'UNKNOWN';

                if (isValve) {
                  const selectedValve = d.selectedValve?.toLowerCase() || 'valve_a';
                  const mem = deviceStatusStore.getStatus(d.deviceId, selectedValve);
                  if (mem && mem.category === 'valve') {
                    physicalState = mem.state as 'OPEN' | 'CLOSED';
                  } else if (d.lastAckAt) {
                    physicalState = 'CLOSED';
                    if (d.ActivateSettings?.[0]?.status === 'Active') {
                      physicalState = normalizeValveState(d.ActivateSettings[0].status);
                    }
                  } else if (d.ActivateSettings?.[0]?.status === 'Active') {
                    physicalState = 'OPEN';
                  }
                } else if (isAppliance) {
                  const mem = deviceStatusStore.getStatus(d.deviceId);
                  if (mem && mem.category === 'appliance') {
                    physicalState = mem.state as 'ON' | 'OFF';
                  } else if (d.DeviceRuntimeLog?.[0]?.status === 'RUNNING' && !d.DeviceRuntimeLog[0].turnedOffAt) {
                    physicalState = 'ON';
                  } else if (d.lastAckAt) {
                    physicalState = 'OFF';
                    if (d.ActivateSettings?.[0]?.status === 'Active') {
                      physicalState = normalizeApplianceState(d.ActivateSettings[0].status);
                    }
                  } else if (d.ActivateSettings?.[0]?.status === 'Active') {
                    physicalState = 'ON';
                  }
                }

                return {
                  id: d.id,
                  deviceId: d.deviceId,
                  deviceName: d.deviceName || d.deviceId,
                  deviceCategory: d.deviceCategory,
                  selectedValve: d.selectedValve || null,
                  physicalState,
                  cloudStatus: d.cloudStatus || 'ONLINE',
                  lastHeartbeatAt: d.lastHeartbeatAt,
                  formattedHeartbeatAt: formatIST(d.lastHeartbeatAt),
                  lastAckAt: d.lastAckAt,
                  failSafeStatus: d.failSafeStatus || 'NORMAL',
                  farmId: d.farmId,
                  boundaryId: d.boundaryId,
                };
              })
            : userDevices.map((d: any) => {
                const mem = deviceStatusStore.getStatus(d.deviceId);
                let physicalState: 'OPEN' | 'CLOSED' | 'ON' | 'OFF' | 'UNKNOWN' = 'UNKNOWN';
                if (mem) {
                  physicalState = mem.state;
                }

                return {
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
                  physicalState,
                  cloudStatus: 'ONLINE',
                  lastHeartbeatAt: null,
                  formattedHeartbeatAt: 'Active',
                  lastAckAt: null,
                  failSafeStatus: 'NORMAL',
                  farmId: null,
                  boundaryId: null,
                };
              }),
        fertigation,
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

      return result;
    },
    60, // 60 seconds fresh TTL
    forceFresh,
    120 // 120 seconds stale grace
  );
}

