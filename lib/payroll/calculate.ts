// 급여 계산 순수 함수 모음. DB나 Next.js에 의존하지 않아 서버(API 라우트)와
// 클라이언트(실시간 미리보기) 양쪽에서 그대로 import해 쓸 수 있고, node --test로
// 단위 테스트하기 쉽다.
import {
  DEFAULT_INSURANCE_RATES,
  FREELANCER_WITHHOLDING_RATE,
  REFERRAL_INCENTIVE_RATE,
  REGULAR_BASE_SALARY,
  REGULAR_MANDATORY_SESSIONS,
  REGULAR_MEAL_ALLOWANCE,
  REGULAR_TEAM_LEAD_ALLOWANCE,
  TENURE_BUCKET_LABEL,
  VAT_RATE,
  isRegularPayScale,
  rate1on1For,
  rate2on1For,
  type EmploymentType,
  type InsuranceRates,
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

export type ReferralPaymentMethod = "card" | "transfer";

/** 소개 결제 내역 한 줄(내용 메모 + 금액 + 결제 수단). */
export interface ReferralEntry {
  note: string;
  amount: number;
  paymentMethod: ReferralPaymentMethod;
}

/**
 * 소개 결제 내역 여러 건을 공급가액(부가세 제외) 기준 합계로 환산한다.
 * 카드결제는 결제 금액에 부가세가 포함돼 있다고 보고 부가세(10%)를 제외하고,
 * 계좌이체는 입력한 금액 자체가 이미 부가세를 제외한 금액이라 그대로 더한다.
 */
export function computeReferralSupplyAmount(entries: ReferralEntry[]): number {
  return entries.reduce((sum, entry) => {
    const amount = Math.max(0, entry.amount);
    return sum + (entry.paymentMethod === "card" ? amount / (1 + VAT_RATE) : amount);
  }, 0);
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
  isTeamLead: boolean; // 정직원 여부 체크박스. team_lead 유형은 이 값과 무관하게 항상 팀장수당 적용.
  sessionCount1on1: number;
  sessionCount2on1: number;
  /**
   * 이번 정산월에 진행한 1:1 수업의 실제 날짜(YYYY-MM-DD) 목록. 길이가
   * sessionCount1on1과 정확히 같을 때만 "세션 날짜 단위 정밀 계산"을 쓴다
   * (입사 기념일이 정산월 중간에 있으면, 기념일 이후 초과 수업만 인상된
   * 단가를 적용). 길이가 다르거나(예: 관리자가 횟수만 손으로 고쳐 입력)
   * 아예 지정하지 않으면 기존처럼 정산월 말일 기준 근속 구간 하나로
   * 전체 초과 수업료를 계산한다. 2:1 수업은 근속에 따른 단가 차이가
   * 없어(REGULAR_RATE_2ON1/FREELANCER_RATE_2ON1이 고정값) 날짜 목록이
   * 필요 없다.
   */
  sessionDates1on1?: string[];
  /** 소개 결제 내역을 computeReferralSupplyAmount()로 환산한 공급가액 합계. */
  referralSupplyAmount: number;
  allocationOrder?: AllocationOrder;
  /**
   * 근속 시뮬레이션(같은 조건으로 근속 구간만 바꿔 비교)용 오버라이드.
   * 지정하면 hiredAt/yearMonth로 계산한 실제 근속 구간 대신 이 값을 단가
   * 조회에 사용한다. 퇴직금은 실제 입사일 기반 계산이 필요하므로 시뮬레이션
   * 모드(오버라이드 지정 시)에서는 계산하지 않고 null을 반환한다.
   */
  tenureBucketOverride?: TenureBucket;
  /** 지정하지 않으면 config.ts의 DEFAULT_INSURANCE_RATES(기본값)를 쓴다. */
  insuranceRates?: InsuranceRates;
  /**
   * 대표가 직접 신고한 4대보험 산정 기준 보수월액(원). null/undefined/0
   * 이하면 당월 급여 기준(taxableAmount = 총지급액 - 식대)으로 계산한다.
   * 값이 있으면 그 금액을 그대로 4대보험 산정 기준으로 쓴다(국민연금은
   * 여전히 상한액을 적용).
   */
  declaredMonthlyCompensation?: number | null;
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
  /** 이 계산에 실제로 쓰인 4대보험 요율/상한액(입력에 없으면 기본값). 화면에
      요율을 표시할 때와 저장된 이력을 나중에 다시 볼 때 실제 적용값을
      보여주기 위해 결과에 함께 담아둔다. */
  insuranceRatesUsed: InsuranceRates;
  /** 4대보험(국민연금/건강보험/고용보험) 계산에 실제로 쓰인 보수월액. */
  insuranceBaseAmount: number;
  /** insuranceBaseAmount의 출처. "declared"면 신고한 보수월액을 그대로 쓴
      것이고, "current-month"면 당월 급여(taxableAmount)로 계산한 참고값이다. */
  insuranceBaseSource: "declared" | "current-month";
}

function round(n: number): number {
  return Math.round(n);
}

/**
 * 1:1 초과 수업료를, "의무수업은 이번 달 먼저 진행한 수업부터 채워지고
 * 그 이후(가장 최근) 진행분이 초과분"이라는 가정 아래 세션 날짜 단위로
 * 계산한다. excessCount가 소수(진행 비율 안분 등으로 1:1/2:1이 섞인
 * 경우)여도, 가장 오래된 초과 세션 하나에만 비례 가중치를 줘 정확히
 * 처리한다. 날짜 목록이 없거나 excessCount와 개수가 안 맞으면(관리자가
 * 횟수만 수동으로 고쳐 입력한 경우 등) 호출자가 판단해 이 함수를 호출하지
 * 않고 기존 방식(정산월 말일 기준 근속 구간 하나)으로 계산해야 한다.
 */
function lessonFee1on1ByDate(
  sessionDates: string[],
  excessCount: number,
  employmentType: EmploymentType,
  hiredAt: string,
): number {
  if (excessCount <= 0) return 0;
  // 최근 날짜부터 내림차순 정렬해, 뒤(최근)에서부터 초과 횟수만큼 채운다.
  const sortedDesc = [...sessionDates].sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));
  let remaining = excessCount;
  let total = 0;
  for (const date of sortedDesc) {
    if (remaining <= 0) break;
    const weight = Math.min(1, remaining);
    const bucket = tenureBucket(hiredAt, date);
    total += weight * rate1on1For(employmentType, bucket);
    remaining -= weight;
  }
  return total;
}

export function calculatePayroll(input: PayrollInput): PayrollResult {
  const {
    employmentType,
    hiredAt,
    yearMonth,
    referralSupplyAmount,
    allocationOrder = "proportional",
  } = input;
  const sessionCount1on1 = Math.max(0, input.sessionCount1on1);
  const sessionCount2on1 = Math.max(0, input.sessionCount2on1);
  const rates = input.insuranceRates ?? DEFAULT_INSURANCE_RATES;

  const referenceDate = monthEndDateKey(yearMonth);
  const tenure = input.tenureBucketOverride ?? tenureBucket(hiredAt, referenceDate);

  // 대표는 이 시스템으로 급여를 지급하지 않는 분류용 값이라, 입력값과 무관하게
  // 모든 금액을 0으로 고정한다.
  if (employmentType === "owner") {
    return {
      employmentType,
      tenureBucket: tenure,
      tenureLabel: describeTenureBucket(tenure),
      totalSessions: sessionCount1on1 + sessionCount2on1,
      mandatorySessions: 0,
      excess1on1: 0,
      excess2on1: 0,
      excessTotal: 0,
      rate1on1: 0,
      rate2on1: 0,
      baseSalary: 0,
      mealAllowance: 0,
      lessonFee1on1: 0,
      lessonFee2on1: 0,
      lessonFeeTotal: 0,
      teamLeadAllowance: 0,
      referralIncentive: 0,
      grossPay: 0,
      taxableAmount: 0,
      deductions: {
        nationalPension: 0,
        healthInsurance: 0,
        longTermCare: 0,
        employmentInsurance: 0,
        freelancerWithholding: 0,
        totalDeduction: 0,
      },
      netPay: 0,
      severanceEstimate: null,
      insuranceRatesUsed: rates,
      insuranceBaseAmount: 0,
      insuranceBaseSource: "current-month",
    };
  }

  // team_lead(팀장)는 체크박스 없이 팀장수당이 항상 자동 적용된다.
  const isTeamLead = employmentType === "team_lead" || (employmentType === "regular" && input.isTeamLead);

  const mandatorySessions = isRegularPayScale(employmentType) ? REGULAR_MANDATORY_SESSIONS : 0;
  const { excess1on1, excess2on1, excessTotal } = allocateExcessSessions(
    sessionCount1on1,
    sessionCount2on1,
    mandatorySessions,
    allocationOrder,
  );

  const rate1on1 = rate1on1For(employmentType, tenure);
  const rate2on1 = rate2on1For(employmentType);
  // 시뮬레이션(tenureBucketOverride 지정) 모드는 하나의 근속 구간을 가정한
  // 비교용이라 세션 날짜 정밀 계산을 쓰지 않는다. 그 외에는 실제 수업 날짜
  // 목록이 있고 그 개수가 sessionCount1on1과 정확히 일치할 때만 정밀 계산을
  // 쓰고, 아니면 기존처럼 정산월 말일 기준 근속 구간 하나로 계산한다(2:1은
  // 근속과 무관한 고정 단가라 항상 기존 방식 그대로).
  const canUsePreciseDates =
    !input.tenureBucketOverride &&
    input.sessionDates1on1 !== undefined &&
    input.sessionDates1on1.length === sessionCount1on1;
  const lessonFee1on1 = round(
    canUsePreciseDates
      ? lessonFee1on1ByDate(input.sessionDates1on1!, excess1on1, employmentType, hiredAt)
      : excess1on1 * rate1on1,
  );
  const lessonFee2on1 = round(excess2on1 * rate2on1);
  const lessonFeeTotal = lessonFee1on1 + lessonFee2on1;

  const baseSalary = isRegularPayScale(employmentType) ? REGULAR_BASE_SALARY : 0;
  const mealAllowance = isRegularPayScale(employmentType) ? REGULAR_MEAL_ALLOWANCE : 0;
  const teamLeadAllowance = isTeamLead ? REGULAR_TEAM_LEAD_ALLOWANCE : 0;
  const referralIncentive = round(Math.max(0, referralSupplyAmount) * REFERRAL_INCENTIVE_RATE);

  const grossPay =
    baseSalary + mealAllowance + lessonFeeTotal + teamLeadAllowance + referralIncentive;

  let deductions: PayrollDeductions;
  let taxableAmount: number;
  let insuranceBaseAmount: number;
  let insuranceBaseSource: "declared" | "current-month";
  if (isRegularPayScale(employmentType)) {
    taxableAmount = Math.max(0, grossPay - mealAllowance);
    // 신고한 보수월액이 있으면 그 금액을 4대보험 산정 기준으로 쓰고, 없으면
    // 당월 급여(taxableAmount)로 계산한 참고값을 쓴다.
    const declared = input.declaredMonthlyCompensation;
    if (typeof declared === "number" && declared > 0) {
      insuranceBaseAmount = declared;
      insuranceBaseSource = "declared";
    } else {
      insuranceBaseAmount = taxableAmount;
      insuranceBaseSource = "current-month";
    }
    // 국민연금만 기준소득월액 상한액을 적용한다(건강보험·고용보험은 상한 없음).
    const pensionBase = Math.min(insuranceBaseAmount, rates.nationalPensionCap);
    const nationalPension = round(pensionBase * rates.nationalPensionRate);
    const healthInsurance = round(insuranceBaseAmount * rates.healthInsuranceRate);
    const longTermCare = round(healthInsurance * rates.longTermCareRateOfHealthInsurance);
    const employmentInsurance = round(insuranceBaseAmount * rates.employmentInsuranceRate);
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
    insuranceBaseAmount = 0;
    insuranceBaseSource = "current-month";
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
    isRegularPayScale(employmentType) && tenure !== "under1" && !input.tenureBucketOverride
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
    insuranceRatesUsed: rates,
    insuranceBaseAmount,
    insuranceBaseSource,
  };
}
