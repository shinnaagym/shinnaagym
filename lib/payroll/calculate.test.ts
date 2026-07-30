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
