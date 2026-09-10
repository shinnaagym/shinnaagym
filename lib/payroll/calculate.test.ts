// 순수 계산 로직 테스트. 별도 테스트 러너 의존성을 추가하지 않기 위해 Node
// 내장 테스트 러너(node --test)와 assert 모듈만 사용한다.
// 실행: node --experimental-strip-types --test lib/payroll/calculate.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import {
  allocateExcessSessions,
  calculatePayroll,
  computeReferralSupplyAmount,
  tenureBucket,
} from "./calculate.ts";
import {
  DEFAULT_INSURANCE_RATES,
  REGULAR_MANDATORY_SESSIONS,
  REGULAR_RATE_1ON1,
  REGULAR_RATE_2ON1,
  FREELANCER_RATE_1ON1,
  FREELANCER_RATE_2ON1,
  REGULAR_BASE_SALARY,
  REGULAR_MEAL_ALLOWANCE,
  REGULAR_TEAM_LEAD_ALLOWANCE,
} from "./config.ts";

test("의무수업(60회) 미만이면 수업료 0원", () => {
  const alloc = allocateExcessSessions(30, 20, REGULAR_MANDATORY_SESSIONS);
  assert.equal(alloc.excessTotal, 0);
  assert.equal(alloc.excess1on1, 0);
  assert.equal(alloc.excess2on1, 0);

  const result = calculatePayroll({
    employmentType: "regular",
    hiredAt: "2024-01-01",
    yearMonth: "2026-06",
    isTeamLead: false,
    sessionCount1on1: 30,
    sessionCount2on1: 20,
    referralSupplyAmount: 0,
  });
  assert.equal(result.lessonFeeTotal, 0);
  assert.equal(result.grossPay, REGULAR_BASE_SALARY + REGULAR_MEAL_ALLOWANCE);
});

test("정확히 60회면 수업료 0원(경계값)", () => {
  const alloc = allocateExcessSessions(40, 20, REGULAR_MANDATORY_SESSIONS);
  assert.equal(alloc.excessTotal, 0);

  const result = calculatePayroll({
    employmentType: "regular",
    hiredAt: "2024-01-01",
    yearMonth: "2026-06",
    isTeamLead: false,
    sessionCount1on1: 40,
    sessionCount2on1: 20,
    referralSupplyAmount: 0,
  });
  assert.equal(result.lessonFeeTotal, 0);
});

test("60회 초과분에만 단가 적용(1:1만 진행한 단순 케이스)", () => {
  // 1:1만 70회 진행 -> 초과 10회, 전부 1:1 초과분.
  const result = calculatePayroll({
    employmentType: "regular",
    hiredAt: "2020-01-01", // 2년 이상 근속
    yearMonth: "2026-06",
    isTeamLead: false,
    sessionCount1on1: 70,
    sessionCount2on1: 0,
    referralSupplyAmount: 0,
  });
  assert.equal(result.excess1on1, 10);
  assert.equal(result.excess2on1, 0);
  assert.equal(result.tenureBucket, "over2");
  assert.equal(result.lessonFee1on1, 10 * REGULAR_RATE_1ON1.over2);
  assert.equal(result.lessonFee2on1, 0);
});

test("혼합 안분: 1:1 50회 + 2:1 30회, 초과 20회를 진행 비율대로 배분", () => {
  const alloc = allocateExcessSessions(50, 30, REGULAR_MANDATORY_SESSIONS, "proportional");
  assert.equal(alloc.excessTotal, 20);
  assert.equal(alloc.excess1on1, 12.5); // 20 * (50/80)
  assert.equal(alloc.excess2on1, 7.5); // 20 * (30/80)

  const result = calculatePayroll({
    employmentType: "regular",
    hiredAt: "2020-01-01",
    yearMonth: "2026-06",
    isTeamLead: false,
    sessionCount1on1: 50,
    sessionCount2on1: 30,
    referralSupplyAmount: 0,
  });
  const expectedFee1on1 = Math.round(12.5 * REGULAR_RATE_1ON1.over2);
  const expectedFee2on1 = Math.round(7.5 * REGULAR_RATE_2ON1);
  assert.equal(result.lessonFee1on1, expectedFee1on1);
  assert.equal(result.lessonFee2on1, expectedFee2on1);
  assert.equal(result.lessonFeeTotal, expectedFee1on1 + expectedFee2on1);
});

test("안분 옵션: 1on1-first는 의무수업을 1:1부터 소진", () => {
  // 1:1 50 + 2:1 30 = 80, 초과 20. 1:1부터 60회 채우면 1:1은 50<60이라 전부
  // 의무수업으로 소진되고 남은 10회를 2:1에서 소진 -> 2:1 초과 = 30-10=20, 1:1 초과 = 0.
  const alloc = allocateExcessSessions(50, 30, REGULAR_MANDATORY_SESSIONS, "1on1-first");
  assert.equal(alloc.excess1on1, 0);
  assert.equal(alloc.excess2on1, 20);
  assert.equal(alloc.excessTotal, 20);
});

test("안분 옵션: 2on1-first는 의무수업을 2:1부터 소진", () => {
  // 2:1 30회로 60회 다 못채워 30회는 전부 의무수업, 남은 30회는 1:1에서 소진
  // -> 1:1 초과 = 50-30=20, 2:1 초과 = 0.
  const alloc = allocateExcessSessions(50, 30, REGULAR_MANDATORY_SESSIONS, "2on1-first");
  assert.equal(alloc.excess1on1, 20);
  assert.equal(alloc.excess2on1, 0);
  assert.equal(alloc.excessTotal, 20);
});

test("프리랜서는 의무수업이 없어 진행한 전 수업이 수업료 대상", () => {
  const result = calculatePayroll({
    employmentType: "freelancer",
    hiredAt: "2025-01-01", // 1년 이상 2년 미만
    yearMonth: "2026-06",
    isTeamLead: false,
    sessionCount1on1: 10,
    sessionCount2on1: 5,
    referralSupplyAmount: 1_000_000,
  });
  assert.equal(result.excess1on1, 10);
  assert.equal(result.excess2on1, 5);
  assert.equal(result.baseSalary, 0);
  assert.equal(result.mealAllowance, 0);
  assert.equal(result.lessonFee1on1, 10 * FREELANCER_RATE_1ON1["1to2"]);
  assert.equal(result.lessonFee2on1, 5 * FREELANCER_RATE_2ON1);
  // calculatePayroll은 이미 공급가액으로 환산된 값을 그대로 5% 계산에 쓴다
  // (결제 수단별 부가세 처리는 computeReferralSupplyAmount가 미리 담당).
  assert.equal(result.referralIncentive, 50_000);
  // 프리랜서는 3.3% 원천징수만 있고 4대보험은 없음.
  assert.equal(result.deductions.nationalPension, 0);
  assert.equal(
    result.deductions.freelancerWithholding,
    Math.round(result.grossPay * 0.033),
  );
  assert.equal(result.netPay, result.grossPay - result.deductions.freelancerWithholding);
});

test("소개 인센티브 공급가액: 카드결제는 부가세(10%) 제외", () => {
  const supplyAmount = computeReferralSupplyAmount([
    { note: "김철수 소개", amount: 1_100_000, paymentMethod: "card" },
  ]);
  // 1,100,000 / 1.1 = 1,000,000(공급가액). 부동소수점 오차 감안해 반올림 비교.
  assert.equal(Math.round(supplyAmount), 1_000_000);
});

test("소개 인센티브 공급가액: 계좌이체는 입력 금액을 그대로(부가세 이미 제외)", () => {
  const supplyAmount = computeReferralSupplyAmount([
    { note: "이영희 소개", amount: 1_000_000, paymentMethod: "transfer" },
  ]);
  assert.equal(supplyAmount, 1_000_000);
});

test("소개 인센티브 공급가액: 카드·계좌이체 혼합 합산", () => {
  const supplyAmount = computeReferralSupplyAmount([
    { note: "카드결제", amount: 1_100_000, paymentMethod: "card" }, // -> 1,000,000
    { note: "계좌이체", amount: 500_000, paymentMethod: "transfer" }, // -> 500,000
  ]);
  assert.equal(Math.round(supplyAmount), 1_500_000);
});

test("근속 경계일: 입사 1주년 당일은 '1년 이상 2년 미만'", () => {
  assert.equal(tenureBucket("2025-06-30", "2026-06-29"), "under1");
  assert.equal(tenureBucket("2025-06-30", "2026-06-30"), "1to2");
  assert.equal(tenureBucket("2025-06-30", "2026-07-01"), "1to2");
});

test("근속 경계일: 입사 2주년 당일부터 '2년 이상'", () => {
  assert.equal(tenureBucket("2024-06-30", "2026-06-29"), "1to2");
  assert.equal(tenureBucket("2024-06-30", "2026-06-30"), "over2");
});

test("팀장수당은 정직원에게만, 고정 20만원 추가 지급", () => {
  const teamLead = calculatePayroll({
    employmentType: "regular",
    hiredAt: "2020-01-01",
    yearMonth: "2026-06",
    isTeamLead: true,
    sessionCount1on1: 0,
    sessionCount2on1: 0,
    referralSupplyAmount: 0,
  });
  assert.equal(teamLead.teamLeadAllowance, REGULAR_TEAM_LEAD_ALLOWANCE);

  const freelancerTeamLead = calculatePayroll({
    employmentType: "freelancer",
    hiredAt: "2020-01-01",
    yearMonth: "2026-06",
    isTeamLead: true,
    sessionCount1on1: 0,
    sessionCount2on1: 0,
    referralSupplyAmount: 0,
  });
  assert.equal(freelancerTeamLead.teamLeadAllowance, 0);
});

test("근속 1년 미만은 퇴직금 예상액이 없음(null)", () => {
  const result = calculatePayroll({
    employmentType: "regular",
    hiredAt: "2026-01-01",
    yearMonth: "2026-06",
    isTeamLead: false,
    sessionCount1on1: 0,
    sessionCount2on1: 0,
    referralSupplyAmount: 0,
  });
  assert.equal(result.severanceEstimate, null);
});

test("근속 1년 이상이면 퇴직금 예상액이 계산됨", () => {
  const result = calculatePayroll({
    employmentType: "regular",
    hiredAt: "2024-01-01",
    yearMonth: "2026-06",
    isTeamLead: false,
    sessionCount1on1: 0,
    sessionCount2on1: 0,
    referralSupplyAmount: 0,
  });
  assert.notEqual(result.severanceEstimate, null);
  assert.ok((result.severanceEstimate ?? 0) > 0);
});

test("대표(owner)는 수업/소개 실적과 무관하게 급여가 항상 0원", () => {
  const result = calculatePayroll({
    employmentType: "owner",
    hiredAt: "2020-01-01",
    yearMonth: "2026-06",
    isTeamLead: false,
    sessionCount1on1: 70,
    sessionCount2on1: 30,
    referralSupplyAmount: 1_000_000,
  });
  assert.equal(result.grossPay, 0);
  assert.equal(result.netPay, 0);
  assert.equal(result.baseSalary, 0);
  assert.equal(result.lessonFeeTotal, 0);
  assert.equal(result.referralIncentive, 0);
  assert.equal(result.teamLeadAllowance, 0);
  assert.equal(result.severanceEstimate, null);
});

test("팀장(team_lead) 유형은 정직원과 동일한 급여 규칙을 쓰고, 체크박스 없이 팀장수당이 자동 적용됨", () => {
  const teamLeadType = calculatePayroll({
    employmentType: "team_lead",
    hiredAt: "2020-01-01",
    yearMonth: "2026-06",
    isTeamLead: false, // 체크박스가 꺼져 있어도 자동 적용되는지 확인
    sessionCount1on1: 70,
    sessionCount2on1: 0,
    referralSupplyAmount: 0,
  });
  // team_lead 유형은 체크박스 입력값과 무관하게 항상 팀장수당이 붙으므로,
  // "체크박스를 켠 정직원"과 완전히 동일한 결과가 나와야 한다.
  const regularWithCheckbox = calculatePayroll({
    employmentType: "regular",
    hiredAt: "2020-01-01",
    yearMonth: "2026-06",
    isTeamLead: true,
    sessionCount1on1: 70,
    sessionCount2on1: 0,
    referralSupplyAmount: 0,
  });
  assert.equal(teamLeadType.teamLeadAllowance, REGULAR_TEAM_LEAD_ALLOWANCE);
  assert.deepEqual(teamLeadType, { ...regularWithCheckbox, employmentType: "team_lead" });
});

test("국민연금은 4.75%, 건강/고용보험과 함께 기본값(config.ts)이 그대로 적용됨", () => {
  const result = calculatePayroll({
    employmentType: "regular",
    hiredAt: "2020-01-01",
    yearMonth: "2026-06",
    isTeamLead: false,
    sessionCount1on1: 0,
    sessionCount2on1: 0,
    referralSupplyAmount: 0,
  });
  // 보수월액 = 총지급액 - 식대(비과세) = 기본급만 있는 케이스.
  const taxableAmount = REGULAR_BASE_SALARY;
  assert.equal(result.insuranceRatesUsed, DEFAULT_INSURANCE_RATES);
  assert.equal(result.deductions.nationalPension, Math.round(taxableAmount * 0.0475));
  assert.equal(result.deductions.healthInsurance, Math.round(taxableAmount * 0.03545));
  assert.equal(
    result.deductions.longTermCare,
    Math.round(result.deductions.healthInsurance * 0.1295),
  );
  assert.equal(result.deductions.employmentInsurance, Math.round(taxableAmount * 0.009));
});

test("국민연금 상한액을 넘으면 초과분에 보험료가 붙지 않음(건강·고용보험은 상한 없음)", () => {
  // 보수월액이 상한액(300만원)을 넘도록 소개 인센티브를 크게 잡는다. 두 케이스
  // 모두 상한액을 넘지만 초과 폭이 다르게(150만원 vs 500만원 인센티브) 잡아,
  // 국민연금은 그대로인데 건강·고용보험은 더 커지는지 확인한다.
  const insuranceRates = {
    ...DEFAULT_INSURANCE_RATES,
    nationalPensionCap: 3_000_000,
  };
  const atCap = calculatePayroll({
    employmentType: "regular",
    hiredAt: "2020-01-01",
    yearMonth: "2026-06",
    isTeamLead: false,
    sessionCount1on1: 0,
    sessionCount2on1: 0,
    referralSupplyAmount: 30_000_000, // 인센티브 150만원 -> 보수월액 330만원
    insuranceRates,
  });
  const overCap = calculatePayroll({
    employmentType: "regular",
    hiredAt: "2020-01-01",
    yearMonth: "2026-06",
    isTeamLead: false,
    sessionCount1on1: 0,
    sessionCount2on1: 0,
    referralSupplyAmount: 100_000_000, // 인센티브 500만원 -> 보수월액 680만원
    insuranceRates,
  });
  assert.ok(atCap.taxableAmount > insuranceRates.nationalPensionCap);
  assert.ok(overCap.taxableAmount > insuranceRates.nationalPensionCap);
  // 상한액을 넘겨도 국민연금은 상한액 × 요율에서 더 늘지 않는다.
  assert.equal(overCap.deductions.nationalPension, atCap.deductions.nationalPension);
  assert.equal(
    overCap.deductions.nationalPension,
    Math.round(insuranceRates.nationalPensionCap * insuranceRates.nationalPensionRate),
  );
  // 건강보험·고용보험은 상한이 없어 보수월액이 늘어난 만큼 함께 늘어난다.
  assert.ok(overCap.deductions.healthInsurance > atCap.deductions.healthInsurance);
  assert.ok(overCap.deductions.employmentInsurance > atCap.deductions.employmentInsurance);
});

test("insuranceRates를 지정하면 그 값이 그대로 계산·결과에 반영됨", () => {
  const customRates = {
    nationalPensionRate: 0.05,
    nationalPensionCap: 5_000_000,
    healthInsuranceRate: 0.04,
    longTermCareRateOfHealthInsurance: 0.13,
    employmentInsuranceRate: 0.01,
  };
  const result = calculatePayroll({
    employmentType: "regular",
    hiredAt: "2020-01-01",
    yearMonth: "2026-06",
    isTeamLead: false,
    sessionCount1on1: 0,
    sessionCount2on1: 0,
    referralSupplyAmount: 0,
    insuranceRates: customRates,
  });
  assert.deepEqual(result.insuranceRatesUsed, customRates);
  const taxableAmount = REGULAR_BASE_SALARY;
  assert.equal(result.deductions.nationalPension, Math.round(taxableAmount * customRates.nationalPensionRate));
  assert.equal(result.deductions.healthInsurance, Math.round(taxableAmount * customRates.healthInsuranceRate));
});

test("declaredMonthlyCompensation이 없으면 당월 급여 기준(current-month)으로 4대보험을 계산함", () => {
  const result = calculatePayroll({
    employmentType: "regular",
    hiredAt: "2020-01-01",
    yearMonth: "2026-06",
    isTeamLead: false,
    sessionCount1on1: 0,
    sessionCount2on1: 0,
    referralSupplyAmount: 0,
  });
  assert.equal(result.insuranceBaseSource, "current-month");
  assert.equal(result.insuranceBaseAmount, result.taxableAmount);
  assert.equal(result.taxableAmount, REGULAR_BASE_SALARY);
  assert.equal(
    result.deductions.nationalPension,
    Math.round(REGULAR_BASE_SALARY * DEFAULT_INSURANCE_RATES.nationalPensionRate),
  );
});

test("declaredMonthlyCompensation을 지정하면 그 금액을 4대보험 산정 기준으로 그대로 씀(당월 급여와 무관)", () => {
  const declared = 3_500_000;
  const result = calculatePayroll({
    employmentType: "regular",
    hiredAt: "2020-01-01",
    yearMonth: "2026-06",
    isTeamLead: false,
    sessionCount1on1: 70, // 수업료가 붙어 당월 급여(taxableAmount)는 declared와 달라짐
    sessionCount2on1: 0,
    referralSupplyAmount: 0,
    declaredMonthlyCompensation: declared,
  });
  assert.equal(result.insuranceBaseSource, "declared");
  assert.equal(result.insuranceBaseAmount, declared);
  assert.notEqual(result.taxableAmount, declared); // 당월 급여 자체(표시용)는 그대로 별도로 계산됨
  assert.equal(
    result.deductions.nationalPension,
    Math.round(Math.min(declared, DEFAULT_INSURANCE_RATES.nationalPensionCap) * DEFAULT_INSURANCE_RATES.nationalPensionRate),
  );
  assert.equal(
    result.deductions.healthInsurance,
    Math.round(declared * DEFAULT_INSURANCE_RATES.healthInsuranceRate),
  );
});

test("declaredMonthlyCompensation이 0 이하이거나 없으면(null) 신고값을 무시하고 당월 급여 기준으로 돌아감", () => {
  const zero = calculatePayroll({
    employmentType: "regular",
    hiredAt: "2020-01-01",
    yearMonth: "2026-06",
    isTeamLead: false,
    sessionCount1on1: 0,
    sessionCount2on1: 0,
    referralSupplyAmount: 0,
    declaredMonthlyCompensation: 0,
  });
  const nullValue = calculatePayroll({
    employmentType: "regular",
    hiredAt: "2020-01-01",
    yearMonth: "2026-06",
    isTeamLead: false,
    sessionCount1on1: 0,
    sessionCount2on1: 0,
    referralSupplyAmount: 0,
    declaredMonthlyCompensation: null,
  });
  assert.equal(zero.insuranceBaseSource, "current-month");
  assert.equal(nullValue.insuranceBaseSource, "current-month");
});

test("sessionDates1on1을 주면 입사 기념일 이후 초과 수업만 인상된 단가로 계산됨(세션 날짜 정밀 계산)", () => {
  // 입사 2026-10-12 -> 1주년 2027-10-12. 60회는 의무수업(기존 방식과 동일하게
  // 무료), 초과 10회는 전부 기념일 이후(2027-10-12~10-21) 날짜라 전부 32,000원.
  const beforeDates = Array(60).fill("2027-09-15");
  const afterDates = ["2027-10-12", "2027-10-13", "2027-10-14", "2027-10-15", "2027-10-16",
    "2027-10-17", "2027-10-18", "2027-10-19", "2027-10-20", "2027-10-21"];
  const sessionDates1on1 = [...beforeDates, ...afterDates];
  assert.equal(sessionDates1on1.length, 70);

  const result = calculatePayroll({
    employmentType: "regular",
    hiredAt: "2026-10-12",
    yearMonth: "2027-10",
    isTeamLead: false,
    sessionCount1on1: 70,
    sessionCount2on1: 0,
    referralSupplyAmount: 0,
    sessionDates1on1,
  });

  // 정산월 말일(2027-10-31) 기준으로는 이미 "1년 이상 2년 미만"이라 기존
  // 방식(월 전체 한 단가)으로 계산해도 결과가 같아 보일 수 있으니, 굳이
  // 다른(더 낮은) 단가를 가정한 아래 케이스와 비교해 실제로 날짜별로 계산이
  // 갈리는지까지 확인한다.
  assert.equal(result.excessTotal, 10);
  assert.equal(result.lessonFee1on1, 10 * REGULAR_RATE_1ON1["1to2"]);
});

test("세션 날짜 정밀 계산: 초과 수업 중 일부만 기념일을 지났으면 그만큼만 인상된 단가 적용", () => {
  // 60회는 의무수업, 나머지 10회가 초과. 그중 가장 최근 5회(기념일 이후)만
  // 32,000원, 그보다 이른(기념일 이전) 5회는 그대로 30,000원이어야 한다 —
  // "의무수업은 이번 달 먼저 진행한 순서대로 채워지고, 가장 최근 진행분이
  // 초과분"이라는 가정.
  const mandatoryDates = Array(60).fill("2027-09-15");
  const beforeAnniversaryExcess = Array(5).fill("2027-10-11"); // 기념일(10-12) 이전
  const afterAnniversaryExcess = Array(5).fill("2027-10-15"); // 기념일 이후
  const sessionDates1on1 = [...mandatoryDates, ...beforeAnniversaryExcess, ...afterAnniversaryExcess];
  assert.equal(sessionDates1on1.length, 70);

  const result = calculatePayroll({
    employmentType: "regular",
    hiredAt: "2026-10-12",
    yearMonth: "2027-10",
    isTeamLead: false,
    sessionCount1on1: 70,
    sessionCount2on1: 0,
    referralSupplyAmount: 0,
    sessionDates1on1,
  });

  const expected = 5 * REGULAR_RATE_1ON1["1to2"] + 5 * REGULAR_RATE_1ON1["under1"];
  assert.equal(result.excessTotal, 10);
  assert.equal(result.lessonFee1on1, expected);
  // 정산월 말일 기준 한 단가로만 계산하는 기존 방식(월말 근속 "1to2")과는
  // 다른 결과여야 정밀 계산이 실제로 작동한 것이다.
  assert.notEqual(result.lessonFee1on1, 10 * REGULAR_RATE_1ON1["1to2"]);
});

test("세션 날짜 정밀 계산: 1:1/2:1이 섞여 초과 횟수가 소수(비례 안분)여도 경계 세션에만 가중치를 나눠 정확히 계산", () => {
  // 1:1 50회 + 2:1 20회 = 70회, 의무수업 60회 제외 초과 10회를 비례 안분하면
  // excess1on1 = 10 * 50/70 = 50/7 ≈ 7.142857...(정수 아님).
  // 1:1 세션 날짜: 최근 7회는 기념일 이후(32,000원), 그 다음(8번째로 최근)
  // 1회부터는 기념일 이전(30,000원) — 경계에 걸린 8번째 세션만 1/7만큼만
  // 인상된 단가가 아닌 이전 단가로 반영돼야 한다.
  const afterAnniversary7 = Array(7).fill("2027-10-15");
  const beforeAnniversary43 = Array(43).fill("2027-09-15");
  const sessionDates1on1 = [...beforeAnniversary43, ...afterAnniversary7];
  assert.equal(sessionDates1on1.length, 50);

  const result = calculatePayroll({
    employmentType: "regular",
    hiredAt: "2026-10-12",
    yearMonth: "2027-10",
    isTeamLead: false,
    sessionCount1on1: 50,
    sessionCount2on1: 20,
    referralSupplyAmount: 0,
    allocationOrder: "proportional",
    sessionDates1on1,
  });

  const excess1on1 = (10 * 50) / 70;
  const fullWeightAfter = 7;
  const partialWeightBefore = excess1on1 - fullWeightAfter;
  const expected = Math.round(
    fullWeightAfter * REGULAR_RATE_1ON1["1to2"] + partialWeightBefore * REGULAR_RATE_1ON1["under1"],
  );
  assert.equal(result.lessonFee1on1, expected);
});

test("세션 날짜 정밀 계산: 날짜 목록 길이가 sessionCount1on1과 다르면(수동 보정) 기존 방식으로 돌아감", () => {
  const result = calculatePayroll({
    employmentType: "regular",
    hiredAt: "2026-10-12",
    yearMonth: "2027-10",
    isTeamLead: false,
    sessionCount1on1: 70, // 관리자가 손으로 70으로 고쳤다고 가정
    sessionCount2on1: 0,
    referralSupplyAmount: 0,
    sessionDates1on1: ["2027-09-15"], // 자동 로드된 옛 날짜 목록(길이 불일치)
  });
  // 정산월 말일(2027-10-31) 기준 근속은 "1to2"이므로, 기존 방식대로 초과
  // 10회 전부 32,000원으로 계산돼야 한다(날짜 목록은 무시됨).
  assert.equal(result.lessonFee1on1, 10 * REGULAR_RATE_1ON1["1to2"]);
});

test("세션 날짜 정밀 계산: 근속 시뮬레이션(tenureBucketOverride)에서는 항상 무시되고 지정한 구간 하나로 계산됨", () => {
  const afterAnniversary10 = Array(10).fill("2027-10-15");
  const mandatory60 = Array(60).fill("2027-09-15");
  const result = calculatePayroll({
    employmentType: "regular",
    hiredAt: "2026-10-12",
    yearMonth: "2027-10",
    isTeamLead: false,
    sessionCount1on1: 70,
    sessionCount2on1: 0,
    referralSupplyAmount: 0,
    sessionDates1on1: [...mandatory60, ...afterAnniversary10],
    tenureBucketOverride: "under1",
  });
  // 오버라이드로 "1년 미만"을 강제했으니, 날짜상 전부 기념일 이후라도
  // 30,000원 하나로 계산돼야 한다.
  assert.equal(result.lessonFee1on1, 10 * REGULAR_RATE_1ON1["under1"]);
});
