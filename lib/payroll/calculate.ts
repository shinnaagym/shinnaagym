// 급여 계산 순수 함수 모음. DB나 Next.js에 의존하지 않아 서버(API 라우트)와
// 클라이언트(실시간 미리보기) 양쪽에서 그대로 import해 쓸 수 있고, node --test로
// 단위 테스트하기 쉽다.
import {
  EMPLOYMENT_INSURANCE_RATE,
  FREELANCER_WITHHOLDING_RATE,
  HEALTH_INSURANCE_RATE,
  LONG_TERM_CARE_RATE_OF_HEALTH_INSURANCE,
  NATIONAL_PENSION_RATE,
  REFERRAL_INCENTIVE_RATE,
  REGULAR_BASE_SALARY,
  REGULAR_MANDATORY_SESSIONS,
  REGULAR_MEAL_ALLOWANCE,
  REGULAR_TEAM_LEAD_ALLOWANCE,
  TENURE_BUCKET_LABEL,
  rate1on1For,
  rate2on1For,
  type EmploymentType,
  type TenureBucket,
} from "./config.ts";

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

// lib/date.ts의 isValidDateKey와 동일한 검증이지만, 이 하위 모듈(lib/payroll)을
// 외부 lib 파일 의존 없이 node --test로 직접 실행 가능하게 로컬로 둔다.
function isValidDateKeyLocal(key: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return false;
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** YYYY-MM-DD 키에 연 단위를 더한다(같은 달/일 유지). */
function addYearsToDateKey(key: string, years: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(Date.UTC(y + years, m - 1, d));
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

/** 'YYYY-MM' 정산월의 말일을 'YYYY-MM-DD' 키로 반환한다. */
export function monthEndDateKey(yearMonth: string): string {
  const [y, m] = yearMonth.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m, 0)); // month(1-indexed값을 0-indexed 다음달로 사용) day 0 = 이번 달 말일
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

/** 두 YYYY-MM-DD 키 사이의 일수 차이(from → to, 음수 가능). */
function daysBetween(fromKey: string, toKey: string): number {
  const [fy, fm, fd] = fromKey.split("-").map(Number);
  const [ty, tm, td] = toKey.split("-").map(Number);
  const from = Date.UTC(fy, fm - 1, fd);
  const to = Date.UTC(ty, tm - 1, td);
  return Math.round((to - from) / (24 * 60 * 60 * 1000));
}

/**
 * 입사일과 정산 기준일(보통 정산월 말일)을 비교해 근속 구간을 판정한다.
 * 입사 1주년/2주년 당일부터 다음 구간으로 취급한다(경계일 포함, ">= 1년"은 상향 구간).
 */
export function tenureBucket(hiredAt: string, referenceDate: string): TenureBucket {
  if (!hiredAt || !isValidDateKeyLocal(hiredAt)) return "under1";
  const oneYearAnniversary = addYearsToDateKey(hiredAt, 1);
  const twoYearAnniversary = addYearsToDateKey(hiredAt, 2);
  if (referenceDate < oneYearAnniversary) return "under1";
  if (referenceDate < twoYearAnniversary) return "1to2";
  return "over2";
}

export function describeTenureBucket(bucket: TenureBucket): string {
  return TENURE_BUCKET_LABEL[bucket];
}

export type AllocationOrder = "proportional" | "1on1-first" | "2on1-first";

export interface SessionAllocation {
  excess1on1: number;
  excess2on1: number;
  excessTotal: number;
}

/**
 * 총 진행 횟수 중 의무수업(mandatorySessions)을 초과한 분량을, 1:1/2:1 수업에
 * 어떻게 나눠 배분할지 결정한다. 기본은 진행 비율 안분("proportional")이고,
 * "1on1-first"/"2on1-first"는 의무수업 소진 순서를 한쪽 수업 형태로 고정한다
 * (이 config에서는 2:1 단가가 항상 1:1보다 높으므로, "낮은 단가부터 차감"은
 * "1on1-first", "높은 단가부터 차감"은 "2on1-first"에 대응한다).
 * 회차는 소수점을 유지한 채로 반환하고(반올림은 최종 금액 계산 시점에만 적용),
 * 세션 수가 음수로 들어오는 경우는 호출자가 막아야 한다(여기서는 검증하지 않음).
 */
export function allocateExcessSessions(
  sessionCount1on1: number,
  sessionCount2on1: number,
  mandatorySessions: number,
  order: AllocationOrder = "proportional",
): SessionAllocation {
  const total = sessionCount1on1 + sessionCount2on1;
  const excessTotal = Math.max(0, total - mandatorySessions);

  if (excessTotal === 0) {
    return { excess1on1: 0, excess2on1: 0, excessTotal: 0 };
  }

  if (order === "proportional") {
    if (total === 0) return { excess1on1: 0, excess2on1: 0, excessTotal: 0 };
    return {
      excess1on1: (excessTotal * sessionCount1on1) / total,
      excess2on1: (excessTotal * sessionCount2on1) / total,
      excessTotal,
    };
  }

  const [firstCount, secondCount, firstIsPt] =
    order === "1on1-first"
      ? [sessionCount1on1, sessionCount2on1, true]
      : [sessionCount2on1, sessionCount1on1, false];

  const consumedFromFirst = Math.min(mandatorySessions, firstCount);
  const remainingMandatory = mandatorySessions - consumedFromFirst;
  const consumedFromSecond = Math.min(remainingMandatory, secondCount);

  const excessFirst = firstCount - consumedFromFirst;
  const excessSecond = secondCount - consumedFromSecond;

  return firstIsPt
    ? { excess1on1: excessFirst, excess2on1: excessSecond, excessTotal }
    : { excess1on1: excessSecond, excess2on1: excessFirst, excessTotal };
}

export interface PayrollInput {
  employmentType: EmploymentType;
  hiredAt: string; // YYYY-MM-DD
  yearMonth: string; // YYYY-MM (정산 기준월)
  isTeamLead: boolean; // 정직원만 의미 있음
  sessionCount1on1: number;
  sessionCount2on1: number;
  referralPaymentAmount: number;
  allocationOrder?: AllocationOrder;
  /**
   * 근속 시뮬레이션(같은 조건으로 근속 구간만 바꿔 비교)용 오버라이드.
   * 지정하면 hiredAt/yearMonth로 계산한 실제 근속 구간 대신 이 값을 단가
   * 조회에 사용한다. 퇴직금은 실제 입사일 기반 계산이 필요하므로 시뮬레이션
   * 모드(오버라이드 지정 시)에서는 계산하지 않고 null을 반환한다.
   */
  tenureBucketOverride?: TenureBucket;
}

export interface PayrollDeductions {
  nationalPension: number;
  healthInsurance: number;
  longTermCare: number;
  employmentInsurance: number;
  freelancerWithholding: number;
  totalDeduction: number;
}

export interface PayrollResult {
  employmentType: EmploymentType;
  tenureBucket: TenureBucket;
  tenureLabel: string;
  totalSessions: number;
  mandatorySessions: number;
  excess1on1: number;
  excess2on1: number;
  excessTotal: number;
  rate1on1: number;
  rate2on1: number;
  baseSalary: number;
  mealAllowance: number;
  lessonFee1on1: number;
  lessonFee2on1: number;
  lessonFeeTotal: number;
  teamLeadAllowance: number;
  referralIncentive: number;
  grossPay: number;
  taxableAmount: number;
  deductions: PayrollDeductions;
  netPay: number;
  /** 근속 1년 미만이거나 시뮬레이션(tenureBucketOverride 지정) 모드면 null. */
  severanceEstimate: number | null;
}

function round(n: number): number {
  return Math.round(n);
}

export function calculatePayroll(input: PayrollInput): PayrollResult {
  const {
    employmentType,
    hiredAt,
    yearMonth,
    referralPaymentAmount,
    allocationOrder = "proportional",
  } = input;
  const sessionCount1on1 = Math.max(0, input.sessionCount1on1);
  const sessionCount2on1 = Math.max(0, input.sessionCount2on1);
  const isTeamLead = employmentType === "regular" && input.isTeamLead;

  const referenceDate = monthEndDateKey(yearMonth);
  const tenure = input.tenureBucketOverride ?? tenureBucket(hiredAt, referenceDate);

  const mandatorySessions = employmentType === "regular" ? REGULAR_MANDATORY_SESSIONS : 0;
  const { excess1on1, excess2on1, excessTotal } = allocateExcessSessions(
    sessionCount1on1,
    sessionCount2on1,
    mandatorySessions,
    allocationOrder,
  );

  const rate1on1 = rate1on1For(employmentType, tenure);
  const rate2on1 = rate2on1For(employmentType);
  const lessonFee1on1 = round(excess1on1 * rate1on1);
  const lessonFee2on1 = round(excess2on1 * rate2on1);
  const lessonFeeTotal = lessonFee1on1 + lessonFee2on1;

  const baseSalary = employmentType === "regular" ? REGULAR_BASE_SALARY : 0;
  const mealAllowance = employmentType === "regular" ? REGULAR_MEAL_ALLOWANCE : 0;
  const teamLeadAllowance = isTeamLead ? REGULAR_TEAM_LEAD_ALLOWANCE : 0;
  const referralIncentive = round(referralPaymentAmount * REFERRAL_INCENTIVE_RATE);

  const grossPay =
    baseSalary + mealAllowance + lessonFeeTotal + teamLeadAllowance + referralIncentive;

  let deductions: PayrollDeductions;
  let taxableAmount: number;
  if (employmentType === "regular") {
    taxableAmount = Math.max(0, grossPay - mealAllowance);
    const nationalPension = round(taxableAmount * NATIONAL_PENSION_RATE);
    const healthInsurance = round(taxableAmount * HEALTH_INSURANCE_RATE);
    const longTermCare = round(healthInsurance * LONG_TERM_CARE_RATE_OF_HEALTH_INSURANCE);
    const employmentInsurance = round(taxableAmount * EMPLOYMENT_INSURANCE_RATE);
    deductions = {
      nationalPension,
      healthInsurance,
      longTermCare,
      employmentInsurance,
      freelancerWithholding: 0,
      totalDeduction: nationalPension + healthInsurance + longTermCare + employmentInsurance,
    };
  } else {
    taxableAmount = grossPay;
    const freelancerWithholding = round(grossPay * FREELANCER_WITHHOLDING_RATE);
    deductions = {
      nationalPension: 0,
      healthInsurance: 0,
      longTermCare: 0,
      employmentInsurance: 0,
      freelancerWithholding,
      totalDeduction: freelancerWithholding,
    };
  }

  const netPay = grossPay - deductions.totalDeduction;

  const severanceEstimate =
    employmentType === "regular" && tenure !== "under1" && !input.tenureBucketOverride
      ? round((grossPay * (daysBetween(hiredAt, referenceDate) / 365)) / 12)
      : null;

  return {
    employmentType,
    tenureBucket: tenure,
    tenureLabel: describeTenureBucket(tenure),
    totalSessions: sessionCount1on1 + sessionCount2on1,
    mandatorySessions,
    excess1on1,
    excess2on1,
    excessTotal,
    rate1on1,
    rate2on1,
    baseSalary,
    mealAllowance,
    lessonFee1on1,
    lessonFee2on1,
    lessonFeeTotal,
    teamLeadAllowance,
    referralIncentive,
    grossPay,
    taxableAmount,
    deductions,
    netPay,
    severanceEstimate,
  };
}
