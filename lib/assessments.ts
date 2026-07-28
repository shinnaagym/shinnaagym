import { query } from "./db";
import type { AssessmentMovements, AssessmentRow, PainTriggerEntry } from "./db";

export interface CreateAssessmentInput {
  memberId: number;
  evaluatorName?: string;
  evaluatedAt?: string;
  movements: AssessmentMovements;
  coreNote?: string;
  squatNote?: string;
  overheadSquatNote?: string;
  pushupNote?: string;
  hipHingeNote?: string;
  painTriggers?: PainTriggerEntry[];
}

export async function createAssessment(input: CreateAssessmentInput): Promise<AssessmentRow> {
  const result = await query<AssessmentRow>(
    `INSERT INTO assessments (
       member_id, evaluator_name, evaluated_at, movements,
       core_note, squat_note, overhead_squat_note, pushup_note, hip_hinge_note,
       pain_triggers
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [
      input.memberId,
      input.evaluatorName ?? "",
      input.evaluatedAt ?? "",
      JSON.stringify(input.movements ?? {}),
      input.coreNote ?? "",
      input.squatNote ?? "",
      input.overheadSquatNote ?? "",
      input.pushupNote ?? "",
      input.hipHingeNote ?? "",
      JSON.stringify(input.painTriggers ?? []),
    ],
  );
  return result.rows[0];
}

/** 회원의 평가 이력을 최신순으로 반환한다(요약 목록용 — movements는 그대로 포함). */
export async function listAssessmentsByMember(memberId: number): Promise<AssessmentRow[]> {
  const result = await query<AssessmentRow>(
    `SELECT * FROM assessments WHERE member_id = $1 ORDER BY created_at DESC`,
    [memberId],
  );
  return result.rows;
}

export async function getAssessmentById(id: number): Promise<AssessmentRow | null> {
  const result = await query<AssessmentRow>(`SELECT * FROM assessments WHERE id = $1`, [id]);
  return result.rows[0] ?? null;
}

export async function getLatestAssessmentByMember(memberId: number): Promise<AssessmentRow | null> {
  const result = await query<AssessmentRow>(
    `SELECT * FROM assessments WHERE member_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [memberId],
  );
  return result.rows[0] ?? null;
}

/**
 * 통증 유발 동작 목록을 반환한다. pain_triggers 배열이 도입되기 전에 저장된
 * 평가는 레거시 단일 필드(pain_trigger_note/pain_scale)만 있으므로, 그 경우
 * 한 건짜리 배열로 변환해 돌려준다.
 */
export function getPainTriggerEntries(assessment: AssessmentRow): PainTriggerEntry[] {
  if (assessment.pain_triggers.length > 0) return assessment.pain_triggers;
  if (assessment.pain_trigger_note) {
    return [{ note: assessment.pain_trigger_note, painScale: assessment.pain_scale }];
  }
  return [];
}
