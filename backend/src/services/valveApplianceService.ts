import prisma from '../config/db.js';
import { Prisma } from '@prisma/client';
import {
  UserDeviceStatusDTO,
  MonitoredFarmDTO,
  MonitoredDeviceDTO,
  ValveStatusDTO,
  ApplianceStatusDTO,
  ValveApplianceSummaryMetrics,
  ValvePhysicalState,
  AppliancePhysicalState,
} from '../types/index.js';
import { formatIST } from '../utils/timezone.js';
import { memoryCache } from '../utils/cache.js';
import { deviceStatusStore, normalizeValveState, normalizeApplianceState } from './deviceStatusStore.js';

interface GetValveApplianceParams {
  userId?: number;
  farmId?: string;
  deviceId?: string;
  deviceCategory?: string;
  status?: string; // 'OPEN' | 'CLOSED' | 'ON' | 'OFF' | 'ONLINE' | 'OFFLINE' | 'UNKNOWN'
  search?: string;
  forceFresh?: boolean;
}

export async function getValveApplianceStatusList(params: GetValveApplianceParams): Promise<{
  users: UserDeviceStatusDTO[];
  summary: ValveApplianceSummaryMetrics;
}> {
  const cacheKey = `valves_appliances:${JSON.stringify(params)}`;

  if (!params.forceFresh) {
    const cached = memoryCache.get<{
      users: UserDeviceStatusDTO[];
      summary: ValveApplianceSummaryMetrics;
    }>(cacheKey);
    if (cached) return cached;
  }

  // 1. Build User query filters
  const whereClause: any = {};

  if (params.userId) {
    whereClause.id = Number(params.userId);
  }

  if (params.search) {
    const s = params.search.trim();
    whereClause.OR = [
      { userName: { contains: s, mode: 'insensitive' } },
      { email: { contains: s, mode: 'insensitive' } },
      { mobileNumber: { contains: s, mode: 'insensitive' } },
      { area: { contains: s, mode: 'insensitive' } },
      {
        farm: {
          some: {
            name: { contains: s, mode: 'insensitive' },
          },
        },
      },
      {
        NodeRedDeviceDetails: {
          some: {
            OR: [
              { deviceId: { contains: s, mode: 'insensitive' } },
              { deviceName: { contains: s, mode: 'insensitive' } },
            ],
          },
        },
      },
    ];
  }

  if (params.farmId) {
    whereClause.farm = {
      some: { id: params.farmId },
    };
  }

  if (params.deviceId) {
    whereClause.NodeRedDeviceDetails = {
      some: { deviceId: { contains: params.deviceId, mode: 'insensitive' } },
    };
  }

  if (params.deviceCategory) {
    whereClause.NodeRedDeviceDetails = {
      some: { deviceCategory: { equals: params.deviceCategory, mode: 'insensitive' } },
    };
  }

  // 2. Fetch Users with Farms, Boundaries, NodeRedDeviceDetails, and Device capability flags
  const [users, capabilityDevices] = await Promise.all([
    prisma.user.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        userName: true,
        email: true,
        mobileNumber: true,
        area: true,
        role: true,
        farm: {
          select: {
            id: true,
            name: true,
            totalAreaAcres: true,
            location: true,
            plant: { select: { plantName: true } },
            boundaries: {
              select: {
                id: true,
                name: true,
                cropType: true,
              },
            },
            devices: {
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
                ActivateSettings: {
                  orderBy: { id: 'desc' },
                  take: 3,
                },
                DeviceRuntimeLog: {
                  orderBy: { id: 'desc' },
                  take: 3,
                },
              },
            },
          },
        },
        NodeRedDeviceDetails: {
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
            ActivateSettings: {
              orderBy: { id: 'desc' },
              take: 3,
            },
            DeviceRuntimeLog: {
              orderBy: { id: 'desc' },
              take: 3,
            },
          },
        },
      },
    }),
    prisma.device.findMany({
      select: {
        deviceId: true,
        userId: true,
        emailId: true,
        hasValve: true,
        hasAppliance: true,
        hasIndoorFertigation: true,
        hasOutdoorFertigation: true,
        hasBCS: true,
      },
    }),
  ]);

  // Index capability devices by userId, emailId, and deviceId
  const capabilityByUser = new Map<string, { hasValve: boolean; hasAppliance: boolean }>();
  const capabilityByDevice = new Map<string, { hasValve: boolean; hasAppliance: boolean }>();

  capabilityDevices.forEach((d) => {
    const hasValve = Boolean(d.hasValve);
    const hasAppliance = Boolean(d.hasAppliance);

    if (d.deviceId) {
      capabilityByDevice.set(d.deviceId.toLowerCase(), { hasValve, hasAppliance });
    }
    if (d.userId) {
      const existing = capabilityByUser.get(d.userId) || { hasValve: false, hasAppliance: false };
      capabilityByUser.set(d.userId, {
        hasValve: existing.hasValve || hasValve,
        hasAppliance: existing.hasAppliance || hasAppliance,
      });
    }
    if (d.emailId) {
      const existing = capabilityByUser.get(d.emailId.toLowerCase()) || { hasValve: false, hasAppliance: false };
      capabilityByUser.set(d.emailId.toLowerCase(), {
        hasValve: existing.hasValve || hasValve,
        hasAppliance: existing.hasAppliance || hasAppliance,
      });
    }
  });

  // 3. Collect farm IDs for batch environmental reading query
  const allFarmIds: string[] = [];
  users.forEach((u) => {
    u.farm.forEach((f) => {
      allFarmIds.push(f.id);
    });
  });

  const envReadingMap = new Map<string, any>();
  if (allFarmIds.length > 0) {
    const envReadings = await prisma.$queryRaw<any[]>`
      WITH Ranked AS (
        SELECT 
          id, timestamp, "userId", "farmId", "boundaryId",
          temperature, humidity, "windSpeed", "directRadiation", par, vpd, evapotranspiration, gdd, co2,
          "soilTemperature", "soilMoisture", "soilElectroConductivity",
          n_sensor as "soilNitrogen", p_sensor as "soilPhosphorus", k_sensor as "soilPotassium",
          ph as "phMaster",
          battery_percentage as "batteryPercentage",
          battery_voltage as "batteryVoltage",
          ROW_NUMBER() OVER (PARTITION BY "farmId" ORDER BY timestamp DESC) as rn
        FROM "EnvironmentalReading"
        WHERE "farmId" IN (${Prisma.join(allFarmIds)})
      )
      SELECT * FROM Ranked WHERE rn = 1;
    `.catch((err) => {
      console.error('Error fetching batch environmental readings in valveApplianceService:', err);
      return [];
    });

    envReadings.forEach((r) => {
      if (r.farmId) {
        envReadingMap.set(r.farmId, {
          ...r,
          timestamp: r.timestamp ? new Date(r.timestamp) : null,
        });
      }
    });
  }

  // 4. Transform and compute states
  const now = new Date();
  let totalValves = 0;
  let openValves = 0;
  let closedValves = 0;
  let unknownValves = 0;

  let totalAppliances = 0;
  let onAppliances = 0;
  let offAppliances = 0;
  let unknownAppliances = 0;

  let totalDevices = 0;
  let onlineDevices = 0;
  let offlineDevices = 0;

  let usersWithValvesCount = 0;
  let usersWithAppliancesCount = 0;

  const resultUsers: UserDeviceStatusDTO[] = [];

  for (const user of users) {
    const userCap = capabilityByUser.get(String(user.id)) || capabilityByUser.get(user.email.toLowerCase()) || {
      hasValve: false,
      hasAppliance: false,
    };

    let userHasValve = userCap.hasValve;
    let userHasAppliance = userCap.hasAppliance;

    const monitoredFarms: MonitoredFarmDTO[] = [];

    // Map through farms
    for (const farm of user.farm) {
      const farmEnv = envReadingMap.get(farm.id) || null;

      const lastReading = farmEnv
        ? {
            timestamp: farmEnv.timestamp ? farmEnv.timestamp.toISOString() : null,
            formattedTimestamp: formatIST(farmEnv.timestamp),
            temperature: farmEnv.temperature !== null ? Math.round(farmEnv.temperature * 10) / 10 : null,
            humidity: farmEnv.humidity !== null ? Math.round(farmEnv.humidity * 10) / 10 : null,
            soilMoisture: farmEnv.soilMoisture !== null ? Math.round(farmEnv.soilMoisture * 10) / 10 : null,
            soilTemperature: farmEnv.soilTemperature !== null ? Math.round(farmEnv.soilTemperature * 10) / 10 : null,
            soilElectroConductivity: farmEnv.soilElectroConductivity !== null ? Math.round(farmEnv.soilElectroConductivity * 100) / 100 : null,
            soilNitrogen: farmEnv.soilNitrogen !== null ? Math.round(farmEnv.soilNitrogen * 10) / 10 : null,
            soilPhosphorus: farmEnv.soilPhosphorus !== null ? Math.round(farmEnv.soilPhosphorus * 10) / 10 : null,
            soilPotassium: farmEnv.soilPotassium !== null ? Math.round(farmEnv.soilPotassium * 10) / 10 : null,
            phMaster: farmEnv.phMaster !== null ? Math.round(farmEnv.phMaster * 100) / 100 : null,
            vpd: farmEnv.vpd !== null ? Math.round(farmEnv.vpd * 100) / 100 : null,
            co2: farmEnv.co2 !== null ? Math.round(farmEnv.co2) : null,
            windSpeed: farmEnv.windSpeed !== null ? Math.round(farmEnv.windSpeed * 10) / 10 : null,
            par: farmEnv.par !== null ? Math.round(farmEnv.par * 10) / 10 : null,
            directRadiation: farmEnv.directRadiation !== null ? Math.round(farmEnv.directRadiation * 10) / 10 : null,
            evapotranspiration: farmEnv.evapotranspiration !== null ? Math.round(farmEnv.evapotranspiration * 10) / 10 : null,
            gdd: farmEnv.gdd !== null ? Math.round(farmEnv.gdd * 10) / 10 : null,
            batteryPercentage: farmEnv.batteryPercentage !== null ? Math.round(farmEnv.batteryPercentage) : null,
            batteryVoltage: farmEnv.batteryVoltage !== null ? Math.round(farmEnv.batteryVoltage * 100) / 100 : null,
          }
        : null;

      const monitoredDevices: MonitoredDeviceDTO[] = [];

      for (const dev of farm.devices) {
        totalDevices++;
        const isOnline = dev.cloudStatus?.toUpperCase() === 'ONLINE';
        if (isOnline) onlineDevices++;
        else offlineDevices++;

        const devCap = capabilityByDevice.get(dev.deviceId.toLowerCase()) || {
          hasValve: false,
          hasAppliance: false,
        };

        const isValveCat = dev.deviceCategory?.toLowerCase() === 'valve';
        const isApplianceCat = !isValveCat;

        if (isValveCat || devCap.hasValve) userHasValve = true;
        if (isApplianceCat || devCap.hasAppliance) userHasAppliance = true;

        const valves: ValveStatusDTO[] = [];
        const appliances: ApplianceStatusDTO[] = [];

        // Check active activation session (if any)
        const latestActivation = dev.ActivateSettings?.[0];
        let isSessionActive = false;
        let sessionDurationMin: number | null = null;
        if (latestActivation) {
          const sTime = new Date(latestActivation.StartTime);
          const eTime = new Date(latestActivation.EndTime);
          if (now >= sTime && now <= eTime && latestActivation.status === 'Active') {
            isSessionActive = true;
            sessionDurationMin = Math.round((eTime.getTime() - sTime.getTime()) / 60000);
          }
        }

        // Check active runtime log (if any)
        const latestRuntime = dev.DeviceRuntimeLog?.[0];
        let isRunningLog = false;
        let currentRuntimeSec: number | null = null;
        if (latestRuntime && latestRuntime.status === 'RUNNING' && !latestRuntime.turnedOffAt) {
          isRunningLog = true;
          currentRuntimeSec = Math.round((now.getTime() - new Date(latestRuntime.turnedOnAt).getTime()) / 1000);
        }

        // Resolve Valve or Appliance
        if (isValveCat) {
          // Determine valve identifier (valve_a, valve_b, etc.)
          const selectedValve = dev.selectedValve?.toLowerCase() || 'valve_a';
          const valveName = selectedValve === 'valve_b' ? 'Valve B' : 'Valve A';

          // 1. In-memory store
          const memoryStatus = deviceStatusStore.getStatus(dev.deviceId, selectedValve);

          let valveState: ValvePhysicalState = 'UNKNOWN';
          let statusTopic = 'relay/ack';
          let rawStatus: any = null;
          let lastUpdate: Date | null = null;

          if (memoryStatus && memoryStatus.category === 'valve') {
            valveState = memoryStatus.state as ValvePhysicalState;
            statusTopic = memoryStatus.topic;
            rawStatus = memoryStatus.rawStatus;
            lastUpdate = memoryStatus.lastUpdated;
          } else if (dev.lastAckAt) {
            // Priority 2: Confirmed physical ACK
            lastUpdate = new Date(dev.lastAckAt);
            if (isSessionActive) {
              valveState = 'OPEN';
            } else if (latestActivation?.status === 'Active') {
              valveState = normalizeValveState(latestActivation.status);
            } else {
              valveState = 'CLOSED';
            }
          } else if (isSessionActive) {
            valveState = 'OPEN';
          }

          totalValves++;
          if (valveState === 'OPEN') openValves++;
          else if (valveState === 'CLOSED') closedValves++;
          else unknownValves++;

          valves.push({
            valve: selectedValve,
            displayName: `${dev.deviceName || dev.deviceId} (${valveName})`,
            status: valveState,
            rawStatus,
            lastStatusUpdate: lastUpdate ? lastUpdate.toISOString() : null,
            formattedLastStatusUpdate: formatIST(lastUpdate),
            lastAckAt: dev.lastAckAt ? new Date(dev.lastAckAt).toISOString() : null,
            formattedLastAckAt: formatIST(dev.lastAckAt),
            statusTopic,
            isSessionActive,
            activeSessionDurationMinutes: sessionDurationMin,
          });
        } else {
          // Appliance device (pump, motor, fan, switch, etc.)
          const memoryStatus = deviceStatusStore.getStatus(dev.deviceId);

          let applianceState: AppliancePhysicalState = 'UNKNOWN';
          let statusTopic = 'relay/ack';
          let rawStatus: any = null;
          let lastUpdate: Date | null = null;

          if (memoryStatus && memoryStatus.category === 'appliance') {
            applianceState = memoryStatus.state as AppliancePhysicalState;
            statusTopic = memoryStatus.topic;
            rawStatus = memoryStatus.rawStatus;
            lastUpdate = memoryStatus.lastUpdated;
          } else if (isRunningLog) {
            applianceState = 'ON';
            lastUpdate = latestRuntime ? new Date(latestRuntime.turnedOnAt) : null;
          } else if (dev.lastAckAt) {
            lastUpdate = new Date(dev.lastAckAt);
            if (isSessionActive) {
              applianceState = 'ON';
            } else if (latestActivation?.status === 'Active') {
              applianceState = normalizeApplianceState(latestActivation.status);
            } else {
              applianceState = 'OFF';
            }
          } else if (isSessionActive) {
            applianceState = 'ON';
          }

          totalAppliances++;
          if (applianceState === 'ON') onAppliances++;
          else if (applianceState === 'OFF') offAppliances++;
          else unknownAppliances++;

          appliances.push({
            deviceId: dev.deviceId,
            deviceName: dev.deviceName || dev.deviceId,
            deviceCategory: dev.deviceCategory || 'appliance',
            status: applianceState,
            rawStatus,
            lastStatusUpdate: lastUpdate ? lastUpdate.toISOString() : null,
            formattedLastStatusUpdate: formatIST(lastUpdate),
            lastAckAt: dev.lastAckAt ? new Date(dev.lastAckAt).toISOString() : null,
            formattedLastAckAt: formatIST(dev.lastAckAt),
            statusTopic,
            isRunning: isRunningLog || applianceState === 'ON',
            currentRuntimeSeconds: currentRuntimeSec,
            lastRuntimeSeconds: latestRuntime?.durationSeconds ?? null,
            isSessionActive,
            activeSessionDurationMinutes: sessionDurationMin,
          });
        }

        monitoredDevices.push({
          id: dev.id,
          deviceId: dev.deviceId,
          deviceName: dev.deviceName,
          deviceCategory: dev.deviceCategory,
          cloudStatus: isOnline ? 'ONLINE' : 'OFFLINE',
          lastHeartbeatAt: dev.lastHeartbeatAt ? new Date(dev.lastHeartbeatAt).toISOString() : null,
          formattedHeartbeatAt: formatIST(dev.lastHeartbeatAt),
          lastAckAt: dev.lastAckAt ? new Date(dev.lastAckAt).toISOString() : null,
          formattedLastAckAt: formatIST(dev.lastAckAt),
          failSafeStatus: dev.failSafeStatus || 'NORMAL',
          failSafeReason: dev.failSafeReason,
          hasValveCapability: Boolean(isValveCat || devCap.hasValve),
          hasApplianceCapability: Boolean(isApplianceCat || devCap.hasAppliance),
          valves,
          appliances,
          lastReading,
        });
      }

      // Also check if any standalone devices belong to the user but not assigned to farm
      monitoredFarms.push({
        farmId: farm.id,
        farmName: farm.name,
        place: farm.location ? `${(farm.location as any).latitude ?? ''}, ${(farm.location as any).longitude ?? ''}`.trim() : null,
        crop: farm.plant?.plantName || farm.boundaries.find((b) => b.cropType)?.cropType || null,
        cropType: farm.plant?.plantName || null,
        totalAreaAcres: farm.totalAreaAcres || 0,
        devices: monitoredDevices,
      });
    }

    // Check standalone devices of the user not attached to a farm
    const unassignedDevices = user.NodeRedDeviceDetails.filter((d) => !d.farmId);
    if (unassignedDevices.length > 0) {
      const standaloneDevices: MonitoredDeviceDTO[] = [];
      for (const dev of unassignedDevices) {
        totalDevices++;
        const isOnline = dev.cloudStatus?.toUpperCase() === 'ONLINE';
        if (isOnline) onlineDevices++;
        else offlineDevices++;

        const isValveCat = dev.deviceCategory?.toLowerCase() === 'valve';
        const isApplianceCat = !isValveCat;

        const devCap = capabilityByDevice.get(dev.deviceId.toLowerCase()) || {
          hasValve: false,
          hasAppliance: false,
        };

        if (isValveCat || devCap.hasValve) userHasValve = true;
        if (isApplianceCat || devCap.hasAppliance) userHasAppliance = true;

        const valves: ValveStatusDTO[] = [];
        const appliances: ApplianceStatusDTO[] = [];

        if (isValveCat) {
          const selectedValve = dev.selectedValve?.toLowerCase() || 'valve_a';
          const valveName = selectedValve === 'valve_b' ? 'Valve B' : 'Valve A';
          const memoryStatus = deviceStatusStore.getStatus(dev.deviceId, selectedValve);

          let valveState: ValvePhysicalState = 'UNKNOWN';
          let statusTopic = 'relay/ack';
          let rawStatus: any = null;
          let lastUpdate: Date | null = null;

          if (memoryStatus && memoryStatus.category === 'valve') {
            valveState = memoryStatus.state as ValvePhysicalState;
            statusTopic = memoryStatus.topic;
            rawStatus = memoryStatus.rawStatus;
            lastUpdate = memoryStatus.lastUpdated;
          } else if (dev.lastAckAt) {
            lastUpdate = new Date(dev.lastAckAt);
            valveState = 'CLOSED';
          }

          totalValves++;
          if (valveState === 'OPEN') openValves++;
          else if (valveState === 'CLOSED') closedValves++;
          else unknownValves++;

          valves.push({
            valve: selectedValve,
            displayName: `${dev.deviceName || dev.deviceId} (${valveName})`,
            status: valveState,
            rawStatus,
            lastStatusUpdate: lastUpdate ? lastUpdate.toISOString() : null,
            formattedLastStatusUpdate: formatIST(lastUpdate),
            lastAckAt: dev.lastAckAt ? new Date(dev.lastAckAt).toISOString() : null,
            formattedLastAckAt: formatIST(dev.lastAckAt),
            statusTopic,
            isSessionActive: false,
            activeSessionDurationMinutes: null,
          });
        } else {
          const memoryStatus = deviceStatusStore.getStatus(dev.deviceId);
          let applianceState: AppliancePhysicalState = 'UNKNOWN';
          let statusTopic = 'relay/ack';
          let rawStatus: any = null;
          let lastUpdate: Date | null = null;

          if (memoryStatus && memoryStatus.category === 'appliance') {
            applianceState = memoryStatus.state as AppliancePhysicalState;
            statusTopic = memoryStatus.topic;
            rawStatus = memoryStatus.rawStatus;
            lastUpdate = memoryStatus.lastUpdated;
          } else if (dev.lastAckAt) {
            lastUpdate = new Date(dev.lastAckAt);
            applianceState = 'OFF';
          }

          totalAppliances++;
          if (applianceState === 'ON') onAppliances++;
          else if (applianceState === 'OFF') offAppliances++;
          else unknownAppliances++;

          appliances.push({
            deviceId: dev.deviceId,
            deviceName: dev.deviceName || dev.deviceId,
            deviceCategory: dev.deviceCategory || 'appliance',
            status: applianceState,
            rawStatus,
            lastStatusUpdate: lastUpdate ? lastUpdate.toISOString() : null,
            formattedLastStatusUpdate: formatIST(lastUpdate),
            lastAckAt: dev.lastAckAt ? new Date(dev.lastAckAt).toISOString() : null,
            formattedLastAckAt: formatIST(dev.lastAckAt),
            statusTopic,
            isRunning: applianceState === 'ON',
            currentRuntimeSeconds: null,
            lastRuntimeSeconds: null,
            isSessionActive: false,
            activeSessionDurationMinutes: null,
          });
        }

        standaloneDevices.push({
          id: dev.id,
          deviceId: dev.deviceId,
          deviceName: dev.deviceName,
          deviceCategory: dev.deviceCategory,
          cloudStatus: isOnline ? 'ONLINE' : 'OFFLINE',
          lastHeartbeatAt: dev.lastHeartbeatAt ? new Date(dev.lastHeartbeatAt).toISOString() : null,
          formattedHeartbeatAt: formatIST(dev.lastHeartbeatAt),
          lastAckAt: dev.lastAckAt ? new Date(dev.lastAckAt).toISOString() : null,
          formattedLastAckAt: formatIST(dev.lastAckAt),
          failSafeStatus: dev.failSafeStatus || 'NORMAL',
          failSafeReason: dev.failSafeReason,
          hasValveCapability: Boolean(isValveCat || devCap.hasValve),
          hasApplianceCapability: Boolean(isApplianceCat || devCap.hasAppliance),
          valves,
          appliances,
          lastReading: null,
        });
      }

      monitoredFarms.push({
        farmId: 'unassigned',
        farmName: 'Unassigned Farm Hardware',
        place: null,
        crop: null,
        cropType: null,
        totalAreaAcres: 0,
        devices: standaloneDevices,
      });
    }

    if (userHasValve) usersWithValvesCount++;
    if (userHasAppliance) usersWithAppliancesCount++;

    resultUsers.push({
      userId: user.id,
      customerName: user.userName || user.email.split('@')[0],
      email: user.email,
      mobile: user.mobileNumber,
      place: user.area || null,
      role: String(user.role),
      hasValveCapability: userHasValve,
      hasApplianceCapability: userHasAppliance,
      farms: monitoredFarms,
    });
  }

  // 5. Optional Filter by Category, DeviceId, and Status
  let filteredUsers = resultUsers;

  if (params.deviceCategory || params.deviceId || params.status) {
    const s = params.status?.toUpperCase();
    const cat = params.deviceCategory?.toLowerCase();
    const devId = params.deviceId?.toLowerCase();

    filteredUsers = resultUsers
      .map((u) => {
        const filteredFarms = u.farms
          .map((f) => {
            const filteredDevices = f.devices.filter((d) => {
              if (cat && d.deviceCategory.toLowerCase() !== cat) return false;
              if (devId && !d.deviceId.toLowerCase().includes(devId)) return false;
              if (s) {
                if (s === 'ONLINE') return d.cloudStatus === 'ONLINE';
                if (s === 'OFFLINE') return d.cloudStatus === 'OFFLINE';
                if (s === 'OPEN') return d.valves.some((v) => v.status === 'OPEN');
                if (s === 'CLOSED') return d.valves.some((v) => v.status === 'CLOSED');
                if (s === 'ON') return d.appliances.some((a) => a.status === 'ON');
                if (s === 'OFF') return d.appliances.some((a) => a.status === 'OFF');
              }
              return true;
            });
            return { ...f, devices: filteredDevices };
          })
          .filter((f) => f.devices.length > 0);
        return { ...u, farms: filteredFarms };
      })
      .filter((u) => u.farms.length > 0);
  }

  const summary: ValveApplianceSummaryMetrics = {
    totalUsers: users.length,
    usersWithValves: usersWithValvesCount,
    usersWithAppliances: usersWithAppliancesCount,
    totalDevices,
    onlineDevices,
    offlineDevices,
    totalValves,
    openValves,
    closedValves,
    unknownValves,
    totalAppliances,
    onAppliances,
    offAppliances,
    unknownAppliances,
  };

  const response = {
    users: filteredUsers,
    summary,
  };

  // Cache response for 10 seconds
  memoryCache.set(cacheKey, response, 10);

  return response;
}
