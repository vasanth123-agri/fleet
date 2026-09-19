import { formatInTimeZone } from 'date-fns-tz';
import { config } from '../config/index.js';

export function formatIST(date: Date | string | null | undefined, formatStr: string = 'dd MMM yyyy, hh:mm a'): string | null {
  if (!date) return null;
  try {
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) return null;
    return formatInTimeZone(d, config.timezone, formatStr);
  } catch (error) {
    console.error('Error formatting date:', error);
    return null;
  }
}

export function formatShortIST(date: Date | string | null | undefined): string | null {
  return formatIST(date, 'dd MMM, hh:mm a');
}

export function formatTimeOnlyIST(date: Date | string | null | undefined): string | null {
  return formatIST(date, 'hh:mm a');
}
