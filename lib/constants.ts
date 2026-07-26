export const BUSINESS_START_HOUR = 9;
// exclusive — last bookable slot starts at BUSINESS_END_HOUR - 1
export const BUSINESS_END_HOUR = 22;
export const BOOKING_WINDOW_DAYS = 90;

export const PURPOSE_OPTIONS = [
  { value: "rehab", label: "재활" },
  { value: "posture", label: "체형교정" },
  { value: "diet", label: "다이어트" },
  { value: "strength", label: "근력 증진" },
  { value: "growth", label: "키성장" },
] as const;

export type PurposeValue = (typeof PURPOSE_OPTIONS)[number]["value"];

export const PURPOSE_LABELS: Record<string, string> = Object.fromEntries(
  PURPOSE_OPTIONS.map((option) => [option.value, option.label]),
);

export function businessHours(): number[] {
  const hours: number[] = [];
  for (let h = BUSINESS_START_HOUR; h < BUSINESS_END_HOUR; h++) hours.push(h);
  return hours;
}

// ---- 오픈 후 실제 수업 스케줄표(관리자/회원 화면) 전용 운영시간 ----
// 사전예약 폼(위 businessHours)과는 별개로, 실제 매장 운영시간(요일별로 다름)을 반영한다.
export const SCHEDULE_WEEKDAY_HOURS = { start: 9, end: 22 } as const; // 월~금
export const SCHEDULE_SATURDAY_HOURS = { start: 9, end: 15 } as const; // 토요일 · 공휴일
// 그리드에 표시할 시간 행의 전체 범위(가장 넓은 평일 기준). 토/공휴일은 15시 이후를 흐리게 표시한다.
export const SCHEDULE_HOUR_ROWS = Array.from(
  { length: SCHEDULE_WEEKDAY_HOURS.end - SCHEDULE_WEEKDAY_HOURS.start },
  (_, i) => SCHEDULE_WEEKDAY_HOURS.start + i,
);

export interface DayHours {
  start: number;
  end: number;
  closed: boolean;
}

/** weekday: JS Date#getDay() 기준 (0=일 ~ 6=토). isHoliday는 holidays 테이블 조회 결과. */
export function scheduleHoursForWeekday(weekday: number, isHoliday: boolean): DayHours {
  if (weekday === 0) return { start: 0, end: 0, closed: true }; // 일요일 휴무
  if (weekday === 6 || isHoliday) {
    return { ...SCHEDULE_SATURDAY_HOURS, closed: false };
  }
  return { ...SCHEDULE_WEEKDAY_HOURS, closed: false };
}
