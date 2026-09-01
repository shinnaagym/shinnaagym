import { query } from "./db";
import type { EmploymentType, InsuranceSettingsRow, PayrollRecordRow } from "./db";
import type { PayrollResult, ReferralEntry } from "./payroll/calculate";
import { DEFAULT_INSURANCE_RATES, type InsuranceRates } from "./payroll/config";
import { koreaTodayKey } from "./date";

export type { ReferralEntry, ReferralPaymentMethod } from "./payroll/calculate";
export type { InsuranceRates } from "./payroll/config";

export interface CoachMonthSessionCounts {
  sessionCount1on1: number;
  sessionCount2on1: number;
}

/** 코치 한 명의 특정 정산월(1:1/2:1) 진행 수업 횟수. 노쇼도 포함(취소만 제외).
    아직 지나지 않은(오늘 이후) 예약은 진행한 수업이 아니므로 제외한다 —
    이번 달 정산을 월 중간에 계산해도 미래 예약분까지 급여에 잡히지 않게 한다. */
export async function getCoachSessionCountsForMonth(
  coachId: number,
  yearMonth: string,
): Promise<CoachMonthSessionCounts> {
  const result = await query<{ pt_type: "1:1" | "2:1"; count: string }>(
    `SELECT pt_type, COUNT(*) as count
     FROM class_sessions
     WHERE coach_id = $1
       AND entry_type = 'session'
       AND status <> 'cancelled'
       AND LEFT(session_date, 7) = $2
       AND session_date <= $3
     GROUP BY pt_type`,
    [coachId, yearMonth, koreaTodayKey()],
  );
  let sessionCount1on1 = 0;
  let sessionCount2on1 = 0;
  for (const row of result.rows) {
    if (row.pt_type === "1:1") sessionCount1on1 = Number(row.count);
    else if (row.pt_type === "2:1") sessionCount2on1 = Number(row.count);
  }
  return { sessionCount1on1, sessionCount2on1 };
}

export interface SavePayrollRecordInput {
  coachId: number | null;
  employeeName: string;
  yearMonth: string;
  employmentType: EmploymentType;
  hiredAt: string;
  isTeamLead: boolean;
  sessionCount1on1: number;
  sessionCount2on1: number;
  referralPaymentAmount: number;
  referralEntries: ReferralEntry[];
  result: PayrollResult;
}

export async function savePayrollRecord(
  input: SavePayrollRecordInput,
): Promise<PayrollRecordRow> {
  const result = await query<PayrollRecordRow>(
    `INSERT INTO payroll_records
       (coach_id, employee_name, year_month, employment_type, hired_at, is_team_lead,
        session_count_1on1, session_count_2on1, referral_payment_amount, referral_entries, result)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING *`,
    [
      input.coachId,
      input.employeeName,
      input.yearMonth,
      input.employmentType,
      input.hiredAt,
      input.isTeamLead,
      input.sessionCount1on1,
      input.sessionCount2on1,
      input.referralPaymentAmount,
      JSON.stringify(input.referralEntries),
      JSON.stringify(input.result),
    ],
  );
  return result.rows[0];
}

export interface PayrollRecordFilter {
  yearMonth?: string;
  coachId?: number;
}

export async function listPayrollRecords(
  filter: PayrollRecordFilter = {},
): Promise<PayrollRecordRow[]> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  if (filter.yearMonth) {
    params.push(filter.yearMonth);
    conditions.push(`year_month = $${params.length}`);
  }
  if (filter.coachId !== undefined) {
    params.push(filter.coachId);
    conditions.push(`coach_id = $${params.length}`);
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const result = await query<PayrollRecordRow>(
    `SELECT * FROM payroll_records ${where} ORDER BY created_at DESC LIMIT 200`,
    params,
  );
  return result.rows;
}

export async function deletePayrollRecord(id: number): Promise<void> {
  await query(`DELETE FROM payroll_records WHERE id = $1`, [id]);
}

/** 저장된 4대보험 요율 설정을 읽는다. 저장된 값이 없으면(대표가 아직 한
    번도 고치지 않았으면) config.ts의 기본값을 그대로 돌려준다. */
export async function getInsuranceRates(): Promise<InsuranceRates> {
  const result = await query<InsuranceSettingsRow>(
    `SELECT * FROM insurance_settings WHERE id = 1`,
  );
  const row = result.rows[0];
  if (!row) return DEFAULT_INSURANCE_RATES;
  return {
    nationalPensionRate: row.national_pension_rate,
    nationalPensionCap: row.national_pension_cap,
    healthInsuranceRate: row.health_insurance_rate,
    longTermCareRateOfHealthInsurance: row.long_term_care_rate,
    employmentInsuranceRate: row.employment_insurance_rate,
  };
}

export async function saveInsuranceRates(rates: InsuranceRates): Promise<InsuranceRates> {
  await query(
    `INSERT INTO insurance_settings
       (id, national_pension_rate, national_pension_cap, health_insurance_rate,
        long_term_care_rate, employment_insurance_rate, updated_at)
     VALUES (1, $1, $2, $3, $4, $5, now())
     ON CONFLICT (id) DO UPDATE SET
       national_pension_rate = EXCLUDED.national_pension_rate,
       national_pension_cap = EXCLUDED.national_pension_cap,
       health_insurance_rate = EXCLUDED.health_insurance_rate,
       long_term_care_rate = EXCLUDED.long_term_care_rate,
       employment_insurance_rate = EXCLUDED.employment_insurance_rate,
       updated_at = now()`,
    [
      rates.nationalPensionRate,
      rates.nationalPensionCap,
      rates.healthInsuranceRate,
      rates.longTermCareRateOfHealthInsurance,
      rates.employmentInsuranceRate,
    ],
  );
  return rates;
}
