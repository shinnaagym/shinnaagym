import { query } from "./db";
import type { ReserveTransactionRow, ReserveTransactionSource } from "./db";
import { RESERVE_TYPE_OPTIONS, type ReserveType } from "./constants";
import { getPaymentTotalsForMonth, listExpensesByMonth } from "./expenses";
import { listPayrollRecords } from "./payroll";
import type { PayrollResult } from "./payroll/calculate";

const VAT_RATE = 0.1; // 부가가치세: 매출의 10%
const INCOME_TAX_RESERVE_RATE = 0.15; // 종합소득세 예비비: 월 순이익의 15%
const SEVERANCE_RATE = 0.0833; // 퇴직금 예비비: 정직원 급여의 8.33%(1/12 근사치)
const REFUND_DEFENSE_RATE = 0.1; // 환불 방어금: 잔여 세션 가치의 10%
const DEPRECIATION_RATE = 0.05; // 감가상각비: 매출의 5%

function round(n: number): number {
  return Math.round(n);
}

/** 저수지 계산에는 항상 이 7종 전부를 다루고, 데이터가 없는 타입도 0으로
    채워서 반환한다 — 화면에서 "이 저수지는 왜 안 보이지?" 같은 혼란을 막는다. */
function zeroedReserveMap(): Record<ReserveType, number> {
  return Object.fromEntries(RESERVE_TYPE_OPTIONS.map((o) => [o.value, 0])) as Record<
    ReserveType,
    number
  >;
}

/** 저수지별 "총 누적 잔액" = 그 저수지에 쌓인 적립(deposit) 합계 - 차감
    (withdrawal) 합계. 별도 잔액 컬럼 없이 항상 거래 내역에서 계산해, 잔액이
    실제 입출금 기록과 어긋날 수 없게 한다. */
export async function getReserveBalances(): Promise<Record<ReserveType, number>> {
  const { rows } = await query<{ reserve_type: string; transaction_type: string; total: string }>(
    `SELECT reserve_type, transaction_type, COALESCE(SUM(amount), 0) AS total
     FROM reserve_transactions
     GROUP BY reserve_type, transaction_type`,
  );
  const balances = zeroedReserveMap();
  for (const r of rows) {
    if (!(r.reserve_type in balances)) continue;
    const signedAmount = r.transaction_type === "withdrawal" ? -Number(r.total) : Number(r.total);
    balances[r.reserve_type as ReserveType] += signedAmount;
  }
  return balances;
}

/** 저수지별 "당월 적립액" = year_month가 해당 월인 적립(deposit) 합계
    (차감은 포함하지 않는다 — 이번 달에 얼마가 쌓여야 하는지를 보여주는
    값이라, 과거 저수지에서 납부로 빠진 돈과는 별개다). */
export async function getMonthlyDeposits(yearMonth: string): Promise<Record<ReserveType, number>> {
  const { rows } = await query<{ reserve_type: string; total: string }>(
    `SELECT reserve_type, COALESCE(SUM(amount), 0) AS total
     FROM reserve_transactions
     WHERE transaction_type = 'deposit' AND year_month = $1
     GROUP BY reserve_type`,
    [yearMonth],
  );
  const deposits = zeroedReserveMap();
  for (const r of rows) {
    if (!(r.reserve_type in deposits)) continue;
    deposits[r.reserve_type as ReserveType] = Number(r.total);
  }
  return deposits;
}

export async function listReserveTransactions(
  reserveType?: ReserveType,
  limit = 30,
): Promise<ReserveTransactionRow[]> {
  const { rows } = await query<ReserveTransactionRow>(
    reserveType
      ? `SELECT * FROM reserve_transactions WHERE reserve_type = $1 ORDER BY created_at DESC LIMIT $2`
      : `SELECT * FROM reserve_transactions ORDER BY created_at DESC LIMIT $1`,
    reserveType ? [reserveType, limit] : [limit],
  );
  return rows;
}

/** 대표가 세금을 납부하거나 비용을 지출했을 때, 해당 저수지의 누적 잔액에서
    차감(withdrawal)한다. 잔액이 부족해도 막지는 않는다 — 실제로 먼저 지출하고
    나중에 채워 넣는 경우도 있어, 잔액 검증은 화면에서 참고 정보로만 보여준다. */
export async function addReserveWithdrawal(
  reserveType: ReserveType,
  amount: number,
  yearMonth: string,
  memo: string,
): Promise<ReserveTransactionRow> {
  const { rows } = await query<ReserveTransactionRow>(
    `INSERT INTO reserve_transactions (reserve_type, transaction_type, amount, year_month, memo, source)
     VALUES ($1, 'withdrawal', $2, $3, $4, 'manual')
     RETURNING *`,
    [reserveType, amount, yearMonth, memo],
  );
  return rows[0];
}

/** 잘못 기록한 적립·차감 내역을 바로잡는다(금액·메모만 고칠 수 있고,
    저수지 종류·구분은 바꿀 수 없다 — 종류를 바꿔야 한다면 삭제 후 새로
    기록해야 함을 화면에서 안내한다). 자동 정산(source='monthly_settlement')
    행도 수정할 수 있지만, "이번 달 정산"을 다시 누르면 그 값은 재계산되어
    덮어써진다. */
export async function updateReserveTransaction(
  id: number,
  amount: number,
  memo: string,
): Promise<ReserveTransactionRow | null> {
  const { rows } = await query<ReserveTransactionRow>(
    `UPDATE reserve_transactions SET amount = $2, memo = $3 WHERE id = $1 RETURNING *`,
    [id, amount, memo],
  );
  return rows[0] ?? null;
}

/** 저수지 적립을 수동으로 추가한다(자동 정산 대상이 아닌 임시 적립 등). */
export async function addReserveDeposit(
  reserveType: ReserveType,
  amount: number,
  yearMonth: string,
  memo: string,
  source: ReserveTransactionSource = "manual",
): Promise<ReserveTransactionRow> {
  const { rows } = await query<ReserveTransactionRow>(
    `INSERT INTO reserve_transactions (reserve_type, transaction_type, amount, year_month, memo, source)
     VALUES ($1, 'deposit', $2, $3, $4, $5)
     RETURNING *`,
    [reserveType, amount, yearMonth, memo, source],
  );
  return rows[0];
}

/** 활성 회원 전체의 "잔여 세션 가치" 합계 — 환불 방어금 계산에 쓴다.
    회원별로 지금까지 구매한 세션의 평균 단가(구매 총액 / 구매 세션수)에
    잔여 세션수(구매 세션수 - 지난 진행 세션수, 취소 제외)를 곱해 더한다. */
export async function getRemainingSessionValue(): Promise<number> {
  const { rows } = await query<{ remaining_value: string | null }>(
    `WITH member_packages AS (
       SELECT member_id, SUM(total_sessions) AS total_sessions, SUM(price) AS total_price
       FROM packages
       GROUP BY member_id
     ),
     member_done AS (
       SELECT member_id, COUNT(*) AS done_count
       FROM class_sessions
       WHERE entry_type = 'session' AND status <> 'cancelled'
         AND session_date <= to_char(now() AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD')
       GROUP BY member_id
     )
     SELECT COALESCE(SUM(
       GREATEST(mp.total_sessions - COALESCE(md.done_count, 0), 0) *
       (CASE WHEN mp.total_sessions > 0 THEN mp.total_price::numeric / mp.total_sessions ELSE 0 END)
     ), 0) AS remaining_value
     FROM member_packages mp
     JOIN members m ON m.id = mp.member_id
     LEFT JOIN member_done md ON md.member_id = mp.member_id
     WHERE m.status = 'active'`,
  );
  return Math.round(Number(rows[0]?.remaining_value ?? 0));
}

export interface MonthlySettlementResult {
  yearMonth: string;
  revenue: number;
  expenseTotal: number;
  netProfit: number;
  regularPayrollGross: number;
  withholdingTotal: number;
  socialInsuranceTotal: number;
  remainingSessionValue: number;
  deposits: Record<ReserveType, number>;
}

/** "이번 달 정산" — 그 달의 매출·지출·급여·잔여 세션 가치를 바탕으로 7개
    저수지의 당월 적립액을 계산해 저장한다. source='monthly_settlement'인
    기존 행을 먼저 지우고 다시 넣기 때문에(멱등) 그 달 데이터가 나중에
    수정돼도(지출 추가 등) 버튼을 다시 눌러 재계산할 수 있다 — 대표가 수동으로
    기록한 적립/차감(source='manual')은 건드리지 않는다. */
export async function runMonthlySettlement(yearMonth: string): Promise<MonthlySettlementResult> {
  const [paymentTotals, expenses, payrollRecords, remainingSessionValue] = await Promise.all([
    getPaymentTotalsForMonth(yearMonth),
    listExpensesByMonth(yearMonth),
    listPayrollRecords({ yearMonth }),
    getRemainingSessionValue(),
  ]);

  const revenue = paymentTotals.card + paymentTotals.transfer;
  const expenseTotal = expenses.reduce((sum, e) => sum + e.amount * e.quantity, 0);
  const netProfit = revenue - expenseTotal;

  let regularPayrollGross = 0;
  let withholdingTotal = 0;
  let socialInsuranceTotal = 0;
  for (const record of payrollRecords) {
    const result = record.result as PayrollResult;
    if (record.employment_type === "regular") {
      regularPayrollGross += result.grossPay;
    }
    withholdingTotal += result.deductions.freelancerWithholding;
    socialInsuranceTotal +=
      result.deductions.nationalPension +
      result.deductions.healthInsurance +
      result.deductions.longTermCare +
      result.deductions.employmentInsurance;
  }

  const deposits: Record<ReserveType, number> = {
    vat: round(revenue * VAT_RATE),
    income_tax: round(Math.max(0, netProfit) * INCOME_TAX_RESERVE_RATE),
    severance: round(regularPayrollGross * SEVERANCE_RATE),
    withholding_tax: round(withholdingTotal),
    social_insurance: round(socialInsuranceTotal),
    refund_defense: round(remainingSessionValue * REFUND_DEFENSE_RATE),
    depreciation: round(revenue * DEPRECIATION_RATE),
  };

  await query(
    `DELETE FROM reserve_transactions WHERE year_month = $1 AND source = 'monthly_settlement'`,
    [yearMonth],
  );
  for (const option of RESERVE_TYPE_OPTIONS) {
    const amount = deposits[option.value];
    if (amount > 0) {
      await addReserveDeposit(option.value, amount, yearMonth, `${yearMonth} 자동 정산`, "monthly_settlement");
    }
  }

  return {
    yearMonth,
    revenue,
    expenseTotal,
    netProfit,
    regularPayrollGross,
    withholdingTotal,
    socialInsuranceTotal,
    remainingSessionValue,
    deposits,
  };
}
