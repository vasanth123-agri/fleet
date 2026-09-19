import prisma from '../config/db.js';
import { FertigationSummary, FertigationHistoryPoint } from '../types/index.js';
import { formatIST, formatShortIST } from '../utils/timezone.js';

export async function getLatestFertigation(farmId?: string, userId?: number): Promise<FertigationSummary | null> {
  if (!farmId && !userId) return null;

  // Determine effective userId
  let effectiveUserId = userId;
  if (!effectiveUserId && farmId) {
    const farm = await prisma.farm.findUnique({
      where: { id: farmId },
      select: { userId: true },
    });
    effectiveUserId = farm?.userId;
  }

  if (!effectiveUserId) return null;

  // Verify that the user actually has a fertigation hardware registered in Device table
  const user = await prisma.user.findUnique({
    where: { id: effectiveUserId },
    include: {
      farm: { select: { id: true, name: true } },
      farmBoundaries: { select: { id: true, name: true, farmId: true } },
    },
  });

  if (!user?.email) return null;

  const fertDevice = await prisma.device.findFirst({
    where: {
      emailId: { equals: user.email, mode: 'insensitive' },
      OR: [{ hasOutdoorFertigation: true }, { hasIndoorFertigation: true }],
    },
  });

  if (!fertDevice) return null;

  const userFarmIds = user.farm.map((f) => f.id);
  const relevantFarmIds = farmId ? [farmId] : userFarmIds;
  const farmMap = new Map<string, string>(user.farm.map((f) => [f.id, f.name]));
  const boundaryMap = new Map<string, string>(user.farmBoundaries.map((b) => [b.id, b.name]));

  // Parallel fetch: readings, settings, sensor validities, calibration logs
  const [outdoorReading, indoorReading, fertSetting, dbValidities, outdoorCalLogs, indoorCalLogs] = await Promise.all([
    prisma.outdoorReading.findFirst({
      where: farmId
        ? { farmId }
        : { OR: [{ userId: effectiveUserId }, { farmId: { in: userFarmIds } }] },
      orderBy: { timestamp: 'desc' },
    }),
    prisma.indoorReading.findFirst({
      where: farmId
        ? { farmId }
        : { OR: [{ userId: effectiveUserId }, { farmId: { in: userFarmIds } }] },
      orderBy: { timestamp: 'desc' },
    }),
    prisma.fertigationSettings.findFirst({
      where: { userId: effectiveUserId },
      include: { tanks: true },
    }),
    prisma.sensorValidity.findMany({
      where: {
        OR: [
          { userId: effectiveUserId },
          { farmId: { in: relevantFarmIds } },
        ],
      },
      include: { farm: true, boundary: true },
      orderBy: { validityEndDate: 'desc' },
    }),
    prisma.outdoorLog.findMany({
      where: {
        OR: [
          { userId: effectiveUserId },
          { farmId: { in: relevantFarmIds } },
        ],
        type: 'calibration',
        status: 'completed',
      },
      include: { farm: true, boundary: true },
      orderBy: { timestamp: 'desc' },
      take: 6,
    }),
    prisma.indoorLog.findMany({
      where: {
        OR: [
          { userId: effectiveUserId },
          { farmId: { in: relevantFarmIds } },
        ],
        type: 'calibration',
        status: 'completed',
      },
      include: { farm: true, boundary: true },
      orderBy: { timestamp: 'desc' },
      take: 6,
    }),
  ]);

  if (!outdoorReading && !indoorReading && !fertSetting) return null;

  // System status determination
  let systemStatus: 'READY' | 'ACTIVE' | 'ALERT' | 'FAILSAFE' | 'ESTOP' | 'UNKNOWN' = 'UNKNOWN';
  if (outdoorReading?.e_stop || indoorReading?.estop) systemStatus = 'ESTOP';
  else if (outdoorReading?.failsafe) systemStatus = 'FAILSAFE';
  else if ((outdoorReading?.alert && outdoorReading.alert > 0) || (indoorReading?.alert && indoorReading.alert > 0)) systemStatus = 'ALERT';
  else if (outdoorReading?.ready || indoorReading?.ready) systemStatus = 'READY';
  else if (outdoorReading || indoorReading) systemStatus = 'ACTIVE';
  else if (fertSetting) systemStatus = 'READY';

  // Map nutrient tank fill levels
  const configuredTanks = fertSetting?.tanks || [];
  const tanks = configuredTanks.map((tank) => {
    let levelPercentage: number | null = null;
    let levelCm: number | null = null;

    if (tank.tankKey === 'tank-1' || tank.tankKey === 'n1') {
      levelPercentage = outdoorReading?.n1_pct ?? null;
      levelCm = outdoorReading?.t1_cm ?? null;
    } else if (tank.tankKey === 'tank-2' || tank.tankKey === 'n2') {
      levelPercentage = outdoorReading?.n2_pct ?? null;
      levelCm = outdoorReading?.t2_cm ?? null;
    } else if (tank.tankKey === 'tank-3' || tank.tankKey === 'k') {
      levelPercentage = outdoorReading?.n2_pct ?? null;
      levelCm = outdoorReading?.t3_cm ?? null;
    } else if (tank.tankKey === 'ph_up') {
      levelPercentage = outdoorReading?.ph_up_pct ?? null;
      levelCm = outdoorReading?.t3_cm ?? null;
    } else if (tank.tankKey === 'ph_dn') {
      levelPercentage = outdoorReading?.ph_dn_pct ?? null;
      levelCm = outdoorReading?.t4_cm ?? null;
    } else if (tank.tankKey === 'tank-5' || tank.tankKey === 't5') {
      levelPercentage = outdoorReading?.t5_pct ?? null;
      levelCm = outdoorReading?.t5_cm ?? null;
    }

    return {
      tankKey: tank.tankKey,
      name: tank.name || tank.nutrient || tank.tankKey,
      nutrient: tank.nutrient || 'General',
      levelPercentage: levelPercentage !== null ? Math.round(levelPercentage * 10) / 10 : null,
      levelCm: levelCm !== null ? Math.round(levelCm * 10) / 10 : null,
    };
  });

  // Calculate Calibration & Sensor Validity
  const now = new Date();
  const allCalLogs = [...outdoorCalLogs, ...indoorCalLogs].sort(
    (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
  );
  const latestCalLog = allCalLogs[0] || null;

  const sensorItems: any[] = [];

  if (dbValidities.length > 0) {
    const seen = new Set<string>();
    for (const v of dbValidities) {
      const key = `${v.type}_${v.sensor}_${v.farmId || 'all'}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const startDate = v.validityStartDate;
      const endDate = v.validityEndDate;
      const daysRemaining = Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
      let validityStatus: 'VALID' | 'EXPIRING_SOON' | 'EXPIRED' = 'VALID';
      if (daysRemaining <= 0) validityStatus = 'EXPIRED';
      else if (daysRemaining <= 7) validityStatus = 'EXPIRING_SOON';

      const farmName = v.farm?.name || farmMap.get(v.farmId || '') || user.farm[0]?.name || 'Primary Farm';
      const boundaryName = v.boundary?.name || boundaryMap.get(v.boundaryId || '') || null;
      const deviceId = v.deviceId || 'Fert1';
      const locationParts = [farmName, boundaryName ? `Plot: ${boundaryName}` : null, `Node: ${deviceId}`].filter(Boolean);

      sensorItems.push({
        id: v.id,
        sensor: v.sensor as 'ph' | 'ec',
        sensorName: v.sensor.toLowerCase() === 'ph' ? 'pH Sensor Probe' : 'EC Salinity Probe',
        type: (v.type as 'indoor' | 'outdoor') || 'outdoor',
        deviceId,
        farmId: v.farmId,
        farmName,
        boundaryId: v.boundaryId,
        boundaryName,
        calibratedLocation: locationParts.join(' • '),
        validityStartDate: startDate.toISOString(),
        formattedStartDate: formatIST(startDate),
        validityEndDate: endDate.toISOString(),
        formattedEndDate: formatIST(endDate),
        validityDaysTotal: v.validityDays,
        daysRemaining,
        validityStatus,
        status: v.status,
      });
    }
  } else {
    // Dynamic synthesis based on calibration log timestamp or fertSetting updatedAt
    const baseDate = latestCalLog?.timestamp || fertSetting?.updatedAt || new Date(now.getTime() - 12 * 24 * 60 * 60 * 1000);
    const primaryFarm = farmId ? user.farm.find(f => f.id === farmId) || user.farm[0] : user.farm[0];
    const boundaryName = latestCalLog?.boundary?.name || boundaryMap.get(latestCalLog?.boundaryId || '') || null;
    const farmName = latestCalLog?.farm?.name || farmMap.get(latestCalLog?.farmId || '') || primaryFarm?.name || 'Farm Boundary';
    const deviceId = latestCalLog?.deviceId || 'DEV-FERT-01';
    const locationParts = [
      farmName,
      boundaryName ? `Plot: ${boundaryName}` : null,
      `Node: ${deviceId}`
    ].filter(Boolean);
    const loc = locationParts.join(' • ');

    const validityDays = 30; // standard 30-day calibration cycle
    const endDate = new Date(baseDate.getTime() + validityDays * 24 * 60 * 60 * 1000);
    const daysRemaining = Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
    let validityStatus: 'VALID' | 'EXPIRING_SOON' | 'EXPIRED' = 'VALID';
    if (daysRemaining <= 0) validityStatus = 'EXPIRED';
    else if (daysRemaining <= 7) validityStatus = 'EXPIRING_SOON';

    sensorItems.push(
      {
        id: 'synth-ph',
        sensor: 'ph',
        sensorName: 'pH Sensor Probe',
        type: 'outdoor',
        deviceId,
        farmId: primaryFarm?.id || null,
        farmName,
        boundaryId: null,
        boundaryName: null,
        calibratedLocation: loc,
        validityStartDate: baseDate.toISOString(),
        formattedStartDate: formatIST(baseDate),
        validityEndDate: endDate.toISOString(),
        formattedEndDate: formatIST(endDate),
        validityDaysTotal: validityDays,
        daysRemaining,
        validityStatus,
        status: 'active',
      },
      {
        id: 'synth-ec',
        sensor: 'ec',
        sensorName: 'EC Salinity Probe',
        type: 'outdoor',
        deviceId,
        farmId: primaryFarm?.id || null,
        farmName,
        boundaryId: null,
        boundaryName: null,
        calibratedLocation: loc,
        validityStartDate: baseDate.toISOString(),
        formattedStartDate: formatIST(baseDate),
        validityEndDate: endDate.toISOString(),
        formattedEndDate: formatIST(endDate),
        validityDaysTotal: validityDays,
        daysRemaining,
        validityStatus,
        status: 'active',
      }
    );
  }

  const lastCalibratedAt = latestCalLog?.timestamp
    ? latestCalLog.timestamp.toISOString()
    : sensorItems[0]?.validityStartDate || null;

  const lastCalibratedLocation = latestCalLog
    ? [
        latestCalLog.farm?.name || farmMap.get(latestCalLog.farmId || '') || user.farm[0]?.name || 'Farm Boundary',
        latestCalLog.boundary?.name || boundaryMap.get(latestCalLog.boundaryId || '')
          ? `Plot: ${latestCalLog.boundary?.name || boundaryMap.get(latestCalLog.boundaryId || '')}`
          : null,
        `Node: ${latestCalLog.deviceId || 'DEV-FERT-01'}`,
      ]
        .filter(Boolean)
        .join(' • ')
    : sensorItems[0]?.calibratedLocation || user.farm[0]?.name || 'Primary Farm';

  const minDaysRemaining = sensorItems.length > 0 ? Math.min(...sensorItems.map((s) => s.daysRemaining)) : 0;
  let overallStatus: 'VALID' | 'EXPIRING_SOON' | 'EXPIRED' | 'NOT_CALIBRATED' = 'VALID';
  if (minDaysRemaining <= 0) overallStatus = 'EXPIRED';
  else if (minDaysRemaining <= 7) overallStatus = 'EXPIRING_SOON';

  const recentCalibrationLogs = allCalLogs.slice(0, 5).map((l) => ({
    id: l.id,
    timestamp: l.timestamp.toISOString(),
    formattedTimestamp: formatIST(l.timestamp) || '',
    sensor: (l.metadata as any)?.sensor || l.title || 'Sensor',
    title: l.title,
    message: l.message,
    deviceId: l.deviceId,
    location:
      [
        l.farm?.name || farmMap.get(l.farmId || '') || user.farm[0]?.name,
        l.boundary?.name || boundaryMap.get(l.boundaryId || '')
          ? `Plot: ${l.boundary?.name || boundaryMap.get(l.boundaryId || '')}`
          : null,
      ]
        .filter(Boolean)
        .join(' • ') || 'Farm Node',
    status: l.status || 'completed',
    slope: (l.metadata as any)?.slope ?? null,
    offset: (l.metadata as any)?.offset ?? null,
  }));

  const calibration = {
    lastCalibratedAt,
    formattedLastCalibratedAt: formatIST(lastCalibratedAt ? new Date(lastCalibratedAt) : null),
    lastCalibratedLocation,
    daysRemaining: minDaysRemaining,
    validityStatus: overallStatus,
    sensors: sensorItems,
    recentCalibrationLogs,
  };

  const ph = outdoorReading?.m2_ph ?? outdoorReading?.m1_ph ?? outdoorReading?.ph ?? indoorReading?.ph ?? null;
  const ec = outdoorReading?.m2_ec ?? outdoorReading?.m1_ec ?? outdoorReading?.ec ?? indoorReading?.ec ?? null;
  const waterLevel = outdoorReading?.waterLevel ?? indoorReading?.wtlvl ?? null;
  const lastReadingTime = outdoorReading?.timestamp
    ? outdoorReading.timestamp.toISOString()
    : indoorReading?.timestamp
    ? indoorReading.timestamp.toISOString()
    : null;

  return {
    lastReadingTime,
    formattedLastReadingTime: formatIST(lastReadingTime ? new Date(lastReadingTime) : null),
    cloudOnline: outdoorReading?.cloud_online ?? (indoorReading ? true : false),
    systemStatus,
    ph: ph !== null ? Math.round(ph * 100) / 100 : null,
    ec: ec !== null ? Math.round(ec * 1000) / 1000 : null,
    m1_ph: outdoorReading?.m1_ph !== null && outdoorReading?.m1_ph !== undefined ? Math.round(outdoorReading.m1_ph * 100) / 100 : null,
    m2_ph: outdoorReading?.m2_ph !== null && outdoorReading?.m2_ph !== undefined ? Math.round(outdoorReading.m2_ph * 100) / 100 : null,
    m1_ec: outdoorReading?.m1_ec !== null && outdoorReading?.m1_ec !== undefined ? Math.round(outdoorReading.m1_ec * 1000) / 1000 : null,
    m2_ec: outdoorReading?.m2_ec !== null && outdoorReading?.m2_ec !== undefined ? Math.round(outdoorReading.m2_ec * 1000) / 1000 : null,
    temperature: indoorReading?.temperature ?? outdoorReading?.temperature ?? null,
    waterLevel: waterLevel !== null && waterLevel !== undefined ? Math.round(waterLevel * 10) / 10 : null,
    tanks,
    targetSettings: fertSetting
      ? {
          targetEc: fertSetting.targetEc,
          targetPh: fertSetting.targetPh,
          totalNutrientTarget: fertSetting.totalNutrientTarget,
          nitrogenRatio: fertSetting.nitrogenRatio,
          phosphorusRatio: fertSetting.phosphorusRatio,
          potassiumRatio: fertSetting.potassiumRatio,
          updatedAt: fertSetting.updatedAt.toISOString(),
          formattedUpdatedAt: formatIST(fertSetting.updatedAt),
        }
      : null,
    calibration,
  };
}

export async function getFertigationHistory(
  farmId: string,
  options: { from?: string; to?: string; range?: string }
): Promise<FertigationHistoryPoint[]> {
  const farm = await prisma.farm.findUnique({
    where: { id: farmId },
    select: { user: { select: { email: true } } },
  });

  if (!farm?.user?.email) return [];

  const fertDevice = await prisma.device.findFirst({
    where: {
      emailId: { equals: farm.user.email, mode: 'insensitive' },
      OR: [{ hasOutdoorFertigation: true }, { hasIndoorFertigation: true }],
    },
  });

  if (!fertDevice) return [];

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

  const readings = await prisma.outdoorReading.findMany({
    where: {
      farmId,
      timestamp: {
        gte: fromDate,
        lte: toDate,
      },
    },
    select: {
      timestamp: true,
      m1_ec: true,
      m2_ec: true,
      m1_ph: true,
      m2_ph: true,
      waterLevel: true,
      n1_pct: true,
      n2_pct: true,
      ph_up_pct: true,
      ph_dn_pct: true,
      t5_pct: true,
      cloud_online: true,
      ready: true,
      alert: true,
    },
    orderBy: { timestamp: 'asc' },
    take: 500,
  });

  return readings.map((r) => ({
    timestamp: r.timestamp.toISOString(),
    formattedTime: formatShortIST(r.timestamp) || '',
    m1_ec: r.m1_ec !== null ? Math.round(r.m1_ec * 1000) / 1000 : null,
    m2_ec: r.m2_ec !== null ? Math.round(r.m2_ec * 1000) / 1000 : null,
    m1_ph: r.m1_ph !== null ? Math.round(r.m1_ph * 100) / 100 : null,
    m2_ph: r.m2_ph !== null ? Math.round(r.m2_ph * 100) / 100 : null,
    waterLevel: r.waterLevel !== null ? Math.round(r.waterLevel * 10) / 10 : null,
    n1_pct: r.n1_pct !== null ? Math.round(r.n1_pct * 10) / 10 : null,
    n2_pct: r.n2_pct !== null ? Math.round(r.n2_pct * 10) / 10 : null,
    ph_up_pct: r.ph_up_pct !== null ? Math.round(r.ph_up_pct * 10) / 10 : null,
    ph_dn_pct: r.ph_dn_pct !== null ? Math.round(r.ph_dn_pct * 10) / 10 : null,
    t5_pct: r.t5_pct !== null ? Math.round(r.t5_pct * 10) / 10 : null,
    cloud_online: r.cloud_online,
    ready: r.ready,
    alert: r.alert,
  }));
}
