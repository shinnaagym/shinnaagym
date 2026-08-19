import { BOOKING_START_DATE, BOOKING_WINDOW_DAYS } from "./constants";

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

/** "YYYY-MM" 하나를 [해당 월 1일, 다음 달 1일) 범위로 바꾼다 — timestamptz 컬럼을
    `to_char(컬럼, 'YYYY-MM') = $1`로 거르던 쿼리를 `컬럼 >= $1 AND 컬럼 < $2`
    범위 비교로 바꿀 때 쓴다(to_char/timezone 변환 함수는 STABLE이라 인덱스를
    못 타지만, 원본 컬럼에 대한 범위 비교는 일반 인덱스를 그대로 쓸 수 있다). */
export function monthKeyRange(yearMonth: string): [string, string] {
  return [`${yearMonth}-01`, `${addMonthsToKey(yearMonth, 1)}-01`];
}

/** 여러 "YYYY-MM"이 연속된 달일 때(예: 최근 N개월 추이), 전체를 아우르는
    [첫 달 1일, 마지막 달 다음 달 1일) 범위로 바꾼다. */
export function monthKeysRange(yearMonths: string[]): [string, string] {
  const sorted = [...yearMonths].sort();
  return [`${sorted[0]}-01`, `${addMonthsToKey(sorted[sorted.length - 1], 1)}-01`];
}

/** Current hour of day (0-23) in KST. */
export function koreaCurrentHour(): number {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.getUTCHours();
}

/** Whether `key` falls within [max(today, BOOKING_START_DATE), BOOKING_START_DATE + BOOKING_WINDOW_DAYS] in KST. */
export function isWithinBookingWindow(key: string): boolean {
  if (!isValidDateKey(key)) return false;
  const today = koreaTodayKey();
  const minDate = today > BOOKING_START_DATE ? today : BOOKING_START_DATE;
  const maxDate = addDaysToKey(BOOKING_START_DATE, BOOKING_WINDOW_DAYS);
  return key >= minDate && key <= maxDate;
}
