import { config } from '../config/index.js';
import { ReadingStatus, BatterySummary } from '../types/index.js';

export function calculateReadingStatus(timestamp: Date | string | null | undefined): ReadingStatus {
  if (!timestamp) return 'NO_DATA';

  const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
  if (isNaN(date.getTime())) return 'NO_DATA';

  const now = Date.now();
  const diffMinutes = (now - date.getTime()) / (1000 * 60);

  if (diffMinutes <= config.readingLiveThresholdMinutes) {
    return 'LIVE';
  } else if (diffMinutes <= config.readingRecentThresholdMinutes) {
    return 'RECENT';
  } else if (diffMinutes <= 24 * 60) {
    return 'DELAYED';
  } else {
    return 'OFFLINE';
  }
}

export function calculateBatterySummary(reading: {
  batteryPercentage?: number | null;
  batteryVoltage?: number | null;
  batteryCurrent?: number | null;
  isCharging?: boolean | null;
} | null | undefined): BatterySummary | null {
  if (!reading) return null;

  const { batteryPercentage, batteryVoltage, batteryCurrent, isCharging } = reading;

  // If both percentage and voltage are null/undefined, return null
  if (
    (batteryPercentage === null || batteryPercentage === undefined) &&
    (batteryVoltage === null || batteryVoltage === undefined)
  ) {
    return null;
  }

  let finalPercentage: number | null = batteryPercentage ?? null;

  // If percentage is null but voltage is present, compute estimate from voltage curve
  if (finalPercentage === null && batteryVoltage !== null && batteryVoltage !== undefined) {
    if (batteryVoltage >= 3.0 && batteryVoltage <= 4.35) {
      // 1S Li-Ion: 3.3V (0%) -> 4.2V (100%)
      finalPercentage = Math.min(100, Math.max(0, Math.round(((batteryVoltage - 3.3) / 0.9) * 100)));
    } else if (batteryVoltage >= 10.0 && batteryVoltage <= 14.8) {
      // 12V Battery: 11.5V (0%) -> 13.6V (100%)
      finalPercentage = Math.min(100, Math.max(0, Math.round(((batteryVoltage - 11.5) / 2.1) * 100)));
    }
  }

  let status: 'EXCELLENT' | 'GOOD' | 'LOW' | 'CRITICAL' | 'UNKNOWN' = 'UNKNOWN';
  if (finalPercentage !== null) {
    if (finalPercentage >= 70) {
      status = 'EXCELLENT';
    } else if (finalPercentage >= 30) {
      status = 'GOOD';
    } else if (finalPercentage >= 15) {
      status = 'LOW';
    } else {
      status = 'CRITICAL';
    }
  }

  return {
    percentage: finalPercentage !== null ? Math.round(finalPercentage * 10) / 10 : null,
    voltage: batteryVoltage !== null && batteryVoltage !== undefined ? Math.round(batteryVoltage * 100) / 100 : null,
    current: batteryCurrent !== null && batteryCurrent !== undefined ? Math.round(batteryCurrent * 100) / 100 : null,
    isCharging: isCharging ?? null,
    status,
  };
}
