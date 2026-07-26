import { BOOKING_WINDOW_DAYS } from "./constants";

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function dateKey(year: number, month: number, day: number): string {
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** Today's date in KST (Asia/Seoul), as a YYYY-MM-DD key, independent of server TZ. */
export function koreaTodayKey(): string {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return dateKey(kst.getUTCFullYear(), kst.getUTCMonth() + 1, kst.getUTCDate());
}

/** Adds `days` calendar days to a YYYY-MM-DD key and returns a new key. */
export function addDaysToKey(key: string, days: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dateKey(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

export function isValidDateKey(key: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return false;
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

/** Returns the Monday (YYYY-MM-DD) of the week containing `key`. */
export function mondayOfWeek(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const weekday = dt.getUTCDay(); // 0=Sun..6=Sat
  const diff = weekday === 0 ? -6 : 1 - weekday; // 월요일로 이동
  return addDaysToKey(key, diff);
}

/** Current month in KST as a YYYY-MM key. */
export function koreaCurrentMonthKey(): string {
  return koreaTodayKey().slice(0, 7);
}

export function isValidMonthKey(key: string): boolean {
  if (!/^\d{4}-\d{2}$/.test(key)) return false;
  const month = Number(key.slice(5, 7));
  return month >= 1 && month <= 12;
}

/** Adds `months` calendar months to a YYYY-MM key. */
export function addMonthsToKey(key: string, months: number): string {
  const [y, m] = key.split("-").map(Number);
  const total = y * 12 + (m - 1) + months;
  const newYear = Math.floor(total / 12);
  const newMonth = (total % 12) + 1;
  return `${newYear}-${pad(newMonth)}`;
}

/** Current hour of day (0-23) in KST. */
export function koreaCurrentHour(): number {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.getUTCHours();
}

/** Whether `key` falls within [today, today + BOOKING_WINDOW_DAYS] in KST. */
export function isWithinBookingWindow(key: string): boolean {
  if (!isValidDateKey(key)) return false;
  const today = koreaTodayKey();
  const maxDate = addDaysToKey(today, BOOKING_WINDOW_DAYS);
  return key >= today && key <= maxDate;
}
