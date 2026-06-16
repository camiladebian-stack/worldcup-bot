import { formatInTimeZone, toZonedTime } from "date-fns-tz";
import { addMinutes, subMinutes, format, parseISO } from "date-fns";

const ART_TIMEZONE = "America/Argentina/Buenos_Aires";

export function toArgentinaTime(utcDateString: string): string {
  const date = typeof utcDateString === "string" ? parseISO(utcDateString) : utcDateString;
  return formatInTimeZone(date, ART_TIMEZONE, "HH:mm");
}

export function toArgentinaDateTime(utcDateString: string): string {
  const date = typeof utcDateString === "string" ? parseISO(utcDateString) : utcDateString;
  return formatInTimeZone(date, ART_TIMEZONE, "dd/MM/yyyy HH:mm");
}

export function toArgentinaDate(utcDateString: string): string {
  const date = typeof utcDateString === "string" ? parseISO(utcDateString) : utcDateString;
  return formatInTimeZone(date, ART_TIMEZONE, "dd/MM/yyyy");
}

export function isWithinMinutes(utcDateString: string, minutes: number): boolean {
  const date = typeof utcDateString === "string" ? parseISO(utcDateString) : utcDateString;
  const now = new Date();
  const from = subMinutes(now, minutes);
  const to = addMinutes(now, minutes);
  return date >= from && date <= to;
}

export function isBeforeNow(utcDateString: string): boolean {
  const date = typeof utcDateString === "string" ? parseISO(utcDateString) : utcDateString;
  return date < new Date();
}

export function minutesUntil(utcDateString: string): number {
  const date = typeof utcDateString === "string" ? parseISO(utcDateString) : utcDateString;
  const now = new Date();
  return Math.round((date.getTime() - now.getTime()) / 60000);
}

export function isToday(utcDateString: string): boolean {
  const dateStr = formatInTimeZone(
    typeof utcDateString === "string" ? parseISO(utcDateString) : utcDateString,
    ART_TIMEZONE,
    "yyyy-MM-dd"
  );
  const todayStr = formatInTimeZone(new Date(), ART_TIMEZONE, "yyyy-MM-dd");
  return dateStr === todayStr;
}

export function formatCountdown(utcDateString: string): string {
  const minutes = minutesUntil(utcDateString);
  if (minutes < 0) return "Ya comenzó";
  if (minutes === 0) return "¡Comienza ahora!";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours < 24) return `${hours}h ${mins}m`;
  const days = Math.floor(hours / 24);
  const remainHours = hours % 24;
  return `${days}d ${remainHours}h ${mins}m`;
}
