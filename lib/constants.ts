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

// PT 일지에서 운동마다 고르는 운동도구. select로 만들면 아이폰/아이패드에서
// 탭할 때 자동으로 휠(다이얼) 형태로 뜬다.
export const PT_LOG_EQUIPMENT_OPTIONS = [
  { value: "bodyweight", label: "맨몸" },
  { value: "dumbbell", label: "덤벨" },
  { value: "barbell", label: "바벨" },
  { value: "kettlebell", label: "케틀벨" },
  { value: "smith_machine", label: "스미스머신" },
  { value: "bulgarian_bag", label: "불가리안백" },
  { value: "theraband", label: "세라밴드" },
  { value: "loop_band", label: "루프밴드" },
] as const;

export type PtLogEquipmentValue = (typeof PT_LOG_EQUIPMENT_OPTIONS)[number]["value"];

export const PT_LOG_EQUIPMENT_LABELS: Record<string, string> = Object.fromEntries(
  PT_LOG_EQUIPMENT_OPTIONS.map((option) => [option.value, option.label]),
);

// 통증 척도·운동수행 능력 공통 0~10 척도.
export const PT_LOG_SCALE_OPTIONS = Array.from({ length: 11 }, (_, i) => i);

export interface CoachColorStyle {
  header: string;
  headerText: string;
  accent: string;
}

// 신나아짐 브랜드 톤(골드·세이지·코랄 + 보조 색)에서 파생한 코치 색상 팔레트.
// Tailwind 기본 rainbow 팔레트 대신 브랜드와 어울리는 톤만 순환시킨다.
// 스케줄표와 회원 관리의 고정 회원 시간표가 모두 이 팔레트를 공유해, 같은
// 코치는 어디서든 같은 색으로 보인다.
export const COACH_COLOR_PALETTE: CoachColorStyle[] = [
  { header: "bg-gold/15", headerText: "text-gold-deep", accent: "border-l-gold" },
  { header: "bg-sage/20", headerText: "text-[#3f6357]", accent: "border-l-sage" },
  { header: "bg-coral/12", headerText: "text-[#a84a2c]", accent: "border-l-coral" },
  { header: "bg-[#e6ecec]", headerText: "text-[#3d5a5c]", accent: "border-l-[#8fadaf]" },
  { header: "bg-[#f1e3e0]", headerText: "text-[#8a5347]", accent: "border-l-[#c98f83]" },
  { header: "bg-[#f3e9d2]", headerText: "text-[#8a6a1f]", accent: "border-l-[#cdae6a]" },
];

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
