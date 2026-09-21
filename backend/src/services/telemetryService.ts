import prisma from '../config/db.js';
import { Prisma } from '@prisma/client';
import { LatestReadingDTO, EnvironmentalHistoryPoint } from '../types/index.js';
import { formatIST, formatShortIST } from '../utils/timezone.js';
import { calculateReadingStatus } from '../utils/status.js';

export async function getLatestReading(farmId?: string, userId?: number): Promise<LatestReadingDTO | null> {
  if (!farmId && !userId) return null;

  const targetFilter = farmId
    ? Prisma.sql`"farmId" = ${farmId}`
    : Prisma.sql`"userId" = ${userId}`;

  const readings = await prisma.$queryRaw<any[]>`
    SELECT 
      COALESCE(r_latest.id, r_valid.id) as id,
      r_latest.timestamp as timestamp,
      COALESCE(r_latest.temperature, r_valid.temperature) as temperature,
      COALESCE(r_latest.humidity, r_valid.humidity) as humidity,
      COALESCE(r_latest."windSpeed", r_valid."windSpeed") as "windSpeed",
      COALESCE(r_latest."directRadiation", r_valid."directRadiation") as "directRadiation",
      COALESCE(r_latest.par, r_valid.par) as par,
      COALESCE(r_latest.vpd, r_valid.vpd) as vpd,
      COALESCE(r_latest.evapotranspiration, r_valid.evapotranspiration) as evapotranspiration,
      COALESCE(r_latest.gdd, r_valid.gdd) as gdd,
      COALESCE(r_latest.co2, r_valid.co2) as co2,
      COALESCE(r_latest."soilTemperature", r_valid."soilTemperature") as "soilTemperature",
      COALESCE(r_latest."soilMoisture", r_valid."soilMoisture") as "soilMoisture",
      COALESCE(NULLIF(r_latest."soilElectroConductivity", 0), r_valid."soilElectroConductivity", r_latest."soilElectroConductivity") as "soilElectroConductivity",
      COALESCE(r_latest.n_sensor, r_valid.n_sensor) as "soilNitrogen",
      COALESCE(r_latest.p_sensor, r_valid.p_sensor) as "soilPhosphorus",
      COALESCE(r_latest.k_sensor, r_valid.k_sensor) as "soilPotassium",
      COALESCE(r_latest.ph, r_valid.ph) as "phMaster",
      COALESCE(r_latest."phSlave", r_valid."phSlave") as "phSlave",
      COALESCE(r_latest.tdsv, r_valid.tdsv) as tdsv,
      COALESCE(r_latest.soilv, r_valid.soilv) as soilv,
      COALESCE(r_latest.battery_percentage, r_battery.battery_percentage) as "batteryPercentage",
      COALESCE(r_latest.battery_voltage, r_battery.battery_voltage) as "batteryVoltage",
      COALESCE(r_latest.battery_current, r_battery.battery_current) as "batteryCurrent",
      COALESCE(r_latest.battery_charging_status, r_battery.battery_charging_status) as "batteryChargingStatus",
      COALESCE(r_latest.is_charging, r_battery.is_charging) as "isCharging"
    FROM (
      SELECT * FROM "EnvironmentalReading"
      WHERE ${targetFilter}
      ORDER BY timestamp DESC
      LIMIT 1
    ) r_latest
    LEFT JOIN LATERAL (
      SELECT * FROM "EnvironmentalReading"
      WHERE ${targetFilter} AND (temperature IS NOT NULL OR "soilMoisture" IS NOT NULL)
      ORDER BY timestamp DESC
      LIMIT 1
    ) r_valid ON true
    LEFT JOIN LATERAL (
      SELECT * FROM "EnvironmentalReading"
      WHERE ${targetFilter} AND (battery_percentage IS NOT NULL OR battery_voltage IS NOT NULL)
      ORDER BY timestamp DESC
      LIMIT 1
    ) r_battery ON true;
  `.catch(() => []);

  const reading = readings[0];
  if (!reading) return null;

  return {
    id: reading.id,
    timestamp: reading.timestamp ? new Date(reading.timestamp).toISOString() : '',
    formattedTimestamp: formatIST(reading.timestamp) || '',
    temperature: reading.temperature,
    humidity: reading.humidity,
    windSpeed: reading.windSpeed,
    directRadiation: reading.directRadiation,
    par: reading.par,
    vpd: reading.vpd,
    evapotranspiration: reading.evapotranspiration,
    gdd: reading.gdd,
    co2: reading.co2,
    soilTemperature: reading.soilTemperature,
    soilMoisture: reading.soilMoisture,
    soilElectroConductivity: reading.soilElectroConductivity,
    soilNitrogen: reading.soilNitrogen,
    soilPhosphorus: reading.soilPhosphorus,
    soilPotassium: reading.soilPotassium,
    phMaster: reading.phMaster,
    phSlave: reading.phSlave,
    tdsv: reading.tdsv,
    soilv: reading.soilv,
    batteryPercentage: reading.batteryPercentage,
    batteryVoltage: reading.batteryVoltage,
    batteryCurrent: reading.batteryCurrent,
    batteryChargingStatus: reading.batteryChargingStatus,
    isCharging: reading.isCharging,
    readingStatus: calculateReadingStatus(reading.timestamp),
  };
}

export async function getEnvironmentalHistory(
  farmId: string,
  options: { from?: string; to?: string; range?: string }
): Promise<EnvironmentalHistoryPoint[]> {
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

  // Indexed query on farmId and timestamp
  const readings = await prisma.environmentalReading.findMany({
    where: {
      farmId,
      timestamp: {
        gte: fromDate,
        lte: toDate,
      },
    },
    select: {
      timestamp: true,
      temperature: true,
      humidity: true,
      co2: true,
      vpd: true,
      soilMoisture: true,
      soilTemperature: true,
      soilElectroConductivity: true,
      soilNitrogen: true,
      soilPhosphorus: true,
      soilPotassium: true,
      phMaster: true,
      par: true,
      directRadiation: true,
      nir: true,
      batteryPercentage: true,
      batteryVoltage: true,
      batteryCurrent: true,
      isCharging: true,
    },
    orderBy: { timestamp: 'asc' },
  });

  if (readings.length === 0) return [];

  const mapReading = (r: any): EnvironmentalHistoryPoint => ({
    timestamp: r.timestamp.toISOString(),
    formattedTime: formatShortIST(r.timestamp) || '',
    temperature: r.temperature !== null ? Math.round(r.temperature * 10) / 10 : null,
    humidity: r.humidity !== null ? Math.round(r.humidity * 10) / 10 : null,
    co2: r.co2 !== null ? Math.round(r.co2) : null,
    vpd: r.vpd !== null ? Math.round(r.vpd * 100) / 100 : null,
    soilMoisture: r.soilMoisture !== null ? Math.round(r.soilMoisture * 10) / 10 : null,
    soilTemperature: r.soilTemperature !== null ? Math.round(r.soilTemperature * 10) / 10 : null,
    soilElectroConductivity: r.soilElectroConductivity !== null ? Math.round(r.soilElectroConductivity * 100) / 100 : null,
    soilNitrogen: r.soilNitrogen !== null ? Math.round(r.soilNitrogen * 10) / 10 : null,
    soilPhosphorus: r.soilPhosphorus !== null ? Math.round(r.soilPhosphorus * 10) / 10 : null,
    soilPotassium: r.soilPotassium !== null ? Math.round(r.soilPotassium * 10) / 10 : null,
    phMaster: r.phMaster !== null ? Math.round(r.phMaster * 100) / 100 : null,
    par: r.par !== null ? Math.round(r.par * 10) / 10 : null,
    directRadiation: r.directRadiation !== null ? Math.round(r.directRadiation * 10) / 10 : null,
    nir: r.nir !== null ? Math.round(r.nir * 10) / 10 : null,
    batteryPercentage: r.batteryPercentage !== null ? Math.round(r.batteryPercentage) : null,
    batteryVoltage: r.batteryVoltage !== null ? Math.round(r.batteryVoltage * 100) / 100 : null,
    batteryCurrent: r.batteryCurrent !== null ? Math.round(r.batteryCurrent * 10) / 10 : null,
    isCharging: r.isCharging,
  });

  const maxPoints = 300;
  if (readings.length <= maxPoints) {
    return readings.map(mapReading);
  }

  const step = Math.ceil(readings.length / maxPoints);
  const sampled: EnvironmentalHistoryPoint[] = [];

  for (let i = 0; i < readings.length; i += step) {
    sampled.push(mapReading(readings[i]));
  }

  return sampled;
}
