import { query } from "./db";
import type { PayrollRecordRow } from "./db";
import type { PayrollResult, ReferralEntry } from "./payroll/calculate";

export type { ReferralEntry, ReferralPaymentMethod } from "./payroll/calculate";

export interface CoachMonthSessionCounts {
  sessionCount1on1: number;
  sessionCount2on1: number;
}

/** 코치 한 명의 특정 정산월(1:1/2:1) 진행 수업 횟수. 노쇼도 포함(취소만 제외). */
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
     GROUP BY pt_type`,
    [coachId, yearMonth],
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
  employmentType: "regular" | "freelancer";
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
