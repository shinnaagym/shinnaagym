export const BUSINESS_START_HOUR = 9;
// exclusive — last bookable slot starts at BUSINESS_END_HOUR - 1
export const BUSINESS_END_HOUR = 22;
export const BOOKING_WINDOW_DAYS = 90;
// 오픈일 전에는 사전예약을 받지 않는다 — 이 날짜 이전은 달력에서 선택할 수 없다.
export const BOOKING_START_DATE = "2026-09-15";

// 취업규칙 제6조(단축근무 및 휴무) 기준 휴가 종류. 당직 캘린더에서 코치별
// 휴가를 기록할 때 이 중 하나를 고른다. limitPeriod/limitUnit/limitAmount와
// noticeDays는 서버 검증(lib/schedule.ts checkLeaveRequest)에서 실제로 쓰는
// 값이고, limitLabel/noticeLabel/payLabel은 화면 표시용 문구다 — 숫자가
// 바뀌면 반드시 둘 다 같이 고쳐야 한다.
export const LEAVE_TYPE_OPTIONS = [
  {
    value: "shortened",
    label: "단축근무",
    limitPeriod: "month",
    limitUnit: "hours",
    limitAmount: 8,
    limitLabel: "월 8시간",
    noticeDays: 3,
    noticeLabel: "3일 전",
    payLabel: "유급",
  },
  {
    value: "day_off",
    label: "휴무",
    limitPeriod: "month",
    limitUnit: "days",
    limitAmount: 2,
    limitLabel: "월 2일 이내",
    noticeDays: 14,
    noticeLabel: "2주 전",
    payLabel: "유급",
  },
  {
    value: "extended",
    label: "연속 휴가",
    limitPeriod: "year",
    limitUnit: "days",
    limitAmount: 5,
    limitLabel: "3일 이상, 연 5일 이내",
    noticeDays: 30,
    noticeLabel: "1개월 전",
    payLabel: "유급",
  },
  {
    value: "sick",
    label: "병가",
    limitPeriod: "year",
    limitUnit: "days",
    limitAmount: 3,
    limitLabel: "연 3일",
    noticeDays: 0,
    noticeLabel: "당일 가능",
    payLabel: "유급",
  },
  {
    value: "birthday",
    label: "생일휴가",
    limitPeriod: "year",
    limitUnit: "days",
    limitAmount: 1,
    limitLabel: "연 1일",
    noticeDays: 14,
    noticeLabel: "2주 전",
    payLabel: "유급",
  },
] as const;

export type LeaveTypeValue = (typeof LEAVE_TYPE_OPTIONS)[number]["value"];

export const LEAVE_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  LEAVE_TYPE_OPTIONS.map((option) => [option.value, option.label]),
);

// 단축근무(leave_type: "shortened")를 고르면 추가로 출근을 늦출지/퇴근을
// 당길지와 몇 시간인지를 함께 지정한다. 근무조(오전조 9~17시 등) 기준으로
// 앞뒤 최대 2시간까지만 줄일 수 있다.
export const SHORTENED_LEAVE_DIRECTION_OPTIONS = [
  { value: "late_start", label: "출근 지연" },
  { value: "early_leave", label: "조기 퇴근" },
] as const;

export type ShortenedLeaveDirection = (typeof SHORTENED_LEAVE_DIRECTION_OPTIONS)[number]["value"];

export const SHORTENED_LEAVE_DIRECTION_LABELS: Record<string, string> = Object.fromEntries(
  SHORTENED_LEAVE_DIRECTION_OPTIONS.map((option) => [option.value, option.label]),
);

export const SHORTENED_LEAVE_MAX_HOURS = 2;
export const SHORTENED_LEAVE_HOUR_OPTIONS = Array.from(
  { length: SHORTENED_LEAVE_MAX_HOURS },
  (_, i) => i + 1,
); // [1, 2]

// 저수지(세금·예비비) 관리 대시보드에서 다루는 항목들. rateDescription은
// 화면에 그대로 표시하는 안내 문구일 뿐, 실제 계산식은 lib/reserves.ts
// runMonthlySettlement에 있다.
export const RESERVE_TYPE_OPTIONS = [
  { value: "vat", label: "부가가치세", rateDescription: "매출의 10%" },
  { value: "income_tax", label: "종합소득세 예비비", rateDescription: "월 순이익의 15%" },
  { value: "severance", label: "퇴직금 예비비", rateDescription: "정직원 급여의 8.33%" },
  { value: "withholding_tax", label: "원천세", rateDescription: "당월 발생액" },
  { value: "social_insurance", label: "4대보험", rateDescription: "당월 발생액" },
  { value: "refund_defense", label: "환불 방어금", rateDescription: "잔여 세션 가치의 10%" },
  { value: "depreciation", label: "감가상각비", rateDescription: "매출의 5%" },
] as const;

export type ReserveType = (typeof RESERVE_TYPE_OPTIONS)[number]["value"];

export const RESERVE_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  RESERVE_TYPE_OPTIONS.map((option) => [option.value, option.label]),
);

export const PURPOSE_OPTIONS = [
  { value: "rehab", label: "재활" },
  { value: "posture", label: "체형교정" },
  { value: "diet", label: "다이어트" },
  { value: "strength", label: "근력 증진" },
  { value: "growth", label: "키성장" },
  { value: "prenatal_postnatal", label: "산전산후" },
  { value: "other", label: "기타" },
] as const;

export type PurposeValue = (typeof PURPOSE_OPTIONS)[number]["value"];

export const PURPOSE_LABELS: Record<string, string> = Object.fromEntries(
  PURPOSE_OPTIONS.map((option) => [option.value, option.label]),
);

// PT 일지에서 운동마다 고르는 운동도구. select로 만들면 아이폰/아이패드에서
// 탭할 때 자동으로 휠(다이얼) 형태로 뜬다.
export const PT_LOG_EQUIPMENT_OPTIONS = [
  { value: "bodyweight", label: "맨몸" },
  { value: "machine", label: "기구" },
  { value: "dumbbell", label: "덤벨" },
  { value: "barbell", label: "바벨" },
  { value: "kettlebell", label: "케틀벨" },
  { value: "cable", label: "케이블" },
  { value: "small_equipment", label: "소도구" },
  { value: "hex_bar", label: "헥스바" },
  { value: "aqua_bag", label: "아쿠아백" },
  { value: "smith_machine", label: "스미스머신" },
  { value: "bulgarian_bag", label: "불가리안백" },
  { value: "circuit", label: "서킷 트레이닝" },
  { value: "other", label: "기타" },
] as const;

export type PtLogEquipmentValue = (typeof PT_LOG_EQUIPMENT_OPTIONS)[number]["value"];

// 세라밴드·루프밴드는 선택지에서 뺐지만, 예전에 그 도구로 저장된 PT 일지
// 기록은 여전히 남아있으므로 라벨 표시만은 계속 되게 해준다.
const LEGACY_PT_LOG_EQUIPMENT_LABELS: Record<string, string> = {
  theraband: "세라밴드",
  loop_band: "루프밴드",
};

export const PT_LOG_EQUIPMENT_LABELS: Record<string, string> = {
  ...LEGACY_PT_LOG_EQUIPMENT_LABELS,
  ...Object.fromEntries(PT_LOG_EQUIPMENT_OPTIONS.map((option) => [option.value, option.label])),
};

// 도구로 "서킷 트레이닝"을 고르면 운동 이름 칸 대신 이 네 가지 형식 중 하나를
// 고르는 다이얼(select)이 뜬다. description은 다이얼 선택지에서만 label 옆에
// 괄호로 덧붙여 보여주고, PT 일지 목록처럼 공간이 좁은 곳에는 label(짧은 이름)만 쓴다.
export const PT_LOG_CIRCUIT_TYPE_OPTIONS = [
  { value: "amrap", label: "AMRAP", description: "최대한 많은 라운드" },
  { value: "timecap", label: "TIMECAP", description: "주어진 시간까지" },
  { value: "for_time", label: "For Time", description: "주어진 운동 다 걸리는 시간" },
  { value: "emom", label: "EMOM", description: "1분마다 반복" },
] as const;

export type PtLogCircuitType = (typeof PT_LOG_CIRCUIT_TYPE_OPTIONS)[number]["value"];

export const PT_LOG_CIRCUIT_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  PT_LOG_CIRCUIT_TYPE_OPTIONS.map((option) => [option.value, option.label]),
);

// 형식마다 시간·라운드 칸의 의미가 달라서(AMRAP은 제한시간 안에 완료한 라운드,
// TIMECAP·For Time은 목표 라운드, EMOM은 라운드 개념이 없음) 라벨과 라운드 칸
// 노출 여부를 여기서 갈라준다.
export const PT_LOG_CIRCUIT_FIELD_CONFIG: Record<
  string,
  { minutesLabel: string; showRounds: boolean; roundsLabel: string }
> = {
  amrap: { minutesLabel: "제한 시간(분)", showRounds: true, roundsLabel: "완료한 라운드" },
  timecap: { minutesLabel: "제한 시간(분)", showRounds: true, roundsLabel: "목표 라운드" },
  for_time: { minutesLabel: "걸린 시간(분)", showRounds: true, roundsLabel: "목표 라운드" },
  emom: { minutesLabel: "총 시간(분)", showRounds: false, roundsLabel: "" },
};

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
