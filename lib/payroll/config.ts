// 급여 계산에 쓰이는 모든 단가·요율 상수. 단가나 요율이 바뀌면 이 파일만
// 수정하면 되도록, lib/payroll/calculate.ts는 이 파일의 값만 참조하고
// 숫자를 직접 하드코딩하지 않는다.

// team_lead(팀장)는 급여 계산상 정직원과 완전히 동일하게 취급하고(분류 표기만
// 다름) 팀장수당을 체크박스 없이 자동 적용한다. owner(대표)는 이 시스템으로
// 급여를 지급하지 않는 분류용 값으로, 계산 결과는 항상 0으로 고정한다.
export type EmploymentType = "regular" | "freelancer" | "team_lead" | "owner";

/** 정직원과 동일한 급여 규칙(기본급/식대/의무수업/4대보험/퇴직금)을 쓰는 유형인지. */
export function isRegularPayScale(employmentType: EmploymentType): boolean {
  return employmentType === "regular" || employmentType === "team_lead";
}

export type TenureBucket = "under1" | "1to2" | "over2";

export const TENURE_BUCKET_LABEL: Record<TenureBucket, string> = {
  under1: "1년 미만",
  "1to2": "1년 이상 2년 미만",
  over2: "2년 이상",
};

// ── 정직원 ──────────────────────────────────────────────
export const REGULAR_BASE_SALARY = 1_800_000;
export const REGULAR_MEAL_ALLOWANCE = 200_000; // 비과세
export const REGULAR_MANDATORY_SESSIONS = 60; // 의무수업 횟수(기본급에 포함)

export const REGULAR_RATE_1ON1: Record<TenureBucket, number> = {
  under1: 30_000,
  "1to2": 32_000,
  over2: 34_000,
};
// 2:1 수업은 근속에 따른 단가 인상이 없음(고정 단가).
export const REGULAR_RATE_2ON1 = 40_000;

// 팀장수당: 정직원 팀장에게 급여에 고정 금액을 별도로 추가 지급.
export const REGULAR_TEAM_LEAD_ALLOWANCE = 200_000;

// ── 프리랜서 ─────────────────────────────────────────────
// 기본급·식대·의무수업 없음: 진행한 수업 전체가 수업료 대상.
export const FREELANCER_RATE_1ON1: Record<TenureBucket, number> = {
  under1: 32_000,
  "1to2": 33_000,
  over2: 35_000,
};
export const FREELANCER_RATE_2ON1 = 42_000;

// ── 공통 ────────────────────────────────────────────────
// 소개 인센티브: 결제 금액(부가세 포함)에서 부가세(10%)를 뺀 공급가액의 5%.
export const VAT_RATE = 0.1;
export const REFERRAL_INCENTIVE_RATE = 0.05;

// ── 4대보험 요율 (2026년 기준) ───────────────────────────
// 아래 값들은 관리자 페이지(급여 계산 > 요율 설정)에 저장된 값이 없을 때
// 쓰는 기본값이다. 실제 계산에 쓰는 값은 DB에 저장된 설정을 우선하고,
// 저장된 값이 없으면 이 기본값으로 자동 대체된다(lib/payroll.ts의
// getInsuranceRates 참고). 코드에서 요율을 직접 하드코딩해 쓰는 곳이
// 이 파일 하나뿐이도록 유지한다.

// 국민연금: 9.5%, 근로자 부담은 절반인 4.75%
export const NATIONAL_PENSION_RATE = 0.0475;
// 국민연금 기준소득월액 상한액(2026.7~2027.6 적용분). 보수월액이 이 금액을
// 넘으면 초과분에는 보험료가 붙지 않는다 — min(보수월액, 상한액) × 요율로
// 계산한다. 매년 7월에 상·하한액이 바뀌므로, 바뀌면 이 값(또는 관리자
// 페이지의 저장된 설정값)만 갱신하면 된다.
export const NATIONAL_PENSION_CAP = 6_590_000;
// 건강보험: 3.545% (근로자 부담분, 상한 없음)
export const HEALTH_INSURANCE_RATE = 0.03545;
// 장기요양보험료 = 건강보험료 × 12.95% (상한 없음)
export const LONG_TERM_CARE_RATE_OF_HEALTH_INSURANCE = 0.1295;
// 고용보험: 0.9% (근로자 부담분, 상한 없음)
export const EMPLOYMENT_INSURANCE_RATE = 0.009;

/** 관리자 페이지(급여 계산 > 요율 설정)에서 수정 가능한 4대보험 요율/상한액 값 묶음. */
export interface InsuranceRates {
  nationalPensionRate: number;
  nationalPensionCap: number;
  healthInsuranceRate: number;
  longTermCareRateOfHealthInsurance: number;
  employmentInsuranceRate: number;
}

/** DB에 저장된 설정이 없을 때 쓰는 기본 요율(위 상수 값과 항상 같다). */
export const DEFAULT_INSURANCE_RATES: InsuranceRates = {
  nationalPensionRate: NATIONAL_PENSION_RATE,
  nationalPensionCap: NATIONAL_PENSION_CAP,
  healthInsuranceRate: HEALTH_INSURANCE_RATE,
  longTermCareRateOfHealthInsurance: LONG_TERM_CARE_RATE_OF_HEALTH_INSURANCE,
  employmentInsuranceRate: EMPLOYMENT_INSURANCE_RATE,
};

// ── 프리랜서 원천징수 ────────────────────────────────────
// 소득세 3% + 지방소득세 0.3% = 3.3%
export const FREELANCER_WITHHOLDING_RATE = 0.033;

export function rate1on1For(employmentType: EmploymentType, tenure: TenureBucket): number {
  return isRegularPayScale(employmentType)
    ? REGULAR_RATE_1ON1[tenure]
    : FREELANCER_RATE_1ON1[tenure];
}

export function rate2on1For(employmentType: EmploymentType): number {
  return isRegularPayScale(employmentType) ? REGULAR_RATE_2ON1 : FREELANCER_RATE_2ON1;
}
