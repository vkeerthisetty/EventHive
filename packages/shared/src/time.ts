import { formatInTimeZone, toZonedTime } from 'date-fns-tz';
import { getISOWeek, getISOWeekYear } from 'date-fns';

export const DEFAULT_TIMEZONE = 'Asia/Kolkata';

export function formatEventDateTime(date: Date | string | number, tz = DEFAULT_TIMEZONE): string {
  const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  return formatInTimeZone(d, tz, "EEE, d MMM, h:mm a zzz");
}

export function formatEventDateShort(date: Date | string | number, tz = DEFAULT_TIMEZONE): string {
  const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  return formatInTimeZone(d, tz, "d MMM");
}

export function formatEventTime(date: Date | string | number, tz = DEFAULT_TIMEZONE): string {
  const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  return formatInTimeZone(d, tz, "h:mm a");
}

export function getZonedDate(date: Date | string | number, tz = DEFAULT_TIMEZONE): Date {
  const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  return toZonedTime(d, tz);
}

export function getZonedHour(date: Date | string | number, tz = DEFAULT_TIMEZONE): number {
  const zoned = getZonedDate(date, tz);
  return zoned.getHours();
}

export function isSunday(date: Date | string | number, tz = DEFAULT_TIMEZONE): boolean {
  const zoned = getZonedDate(date, tz);
  return zoned.getDay() === 0;
}

export function isWeekend(date: Date | string | number, tz = DEFAULT_TIMEZONE): boolean {
  const zoned = getZonedDate(date, tz);
  const day = zoned.getDay();
  return day === 0 || day === 6;
}

export function getTimeBucket(
  date: Date | string | number,
  tz = DEFAULT_TIMEZONE
): 'morning' | 'afternoon' | 'evening' | 'off_hours' {
  const hour = getZonedHour(date, tz);
  if (hour >= 8 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour <= 21) return 'evening';
  return 'off_hours';
}

export function getIsoWeekString(date: Date | string | number, tz = DEFAULT_TIMEZONE): string {
  const zoned = getZonedDate(date, tz);
  const year = getISOWeekYear(zoned);
  const week = getISOWeek(zoned);
  return `${year}-W${week < 10 ? '0' : ''}${week}`;
}
