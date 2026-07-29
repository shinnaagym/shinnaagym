import { query } from "./db";
import type { AssessmentMovements, AssessmentRow, ExercisePerformanceEntry, PainTriggerEntry } from "./db";

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
  exercisePerformance?: ExercisePerformanceEntry[];
  odiAnswers?: Record<string, number>;
  ndiAnswers?: Record<string, number>;
  quickdashAnswers?: Record<string, number>;
  koos12Answers?: Record<string, number>;
  faamAdlAnswers?: Record<string, number>;
  faamSportsAnswers?: Record<string, number>;
  nprsRest?: number | null;
  nprsActivity?: number | null;
  functionalTestPainFree?: Record<string, boolean>;
  hopTestLsi?: number | null;
  cmjLsi?: number | null;
  hamstringLsi?: number | null;
  asymptomaticLoadingWeeks?: number | null;
  startbackAnswers?: Record<string, number>;
}

export async function createAssessment(input: CreateAssessmentInput): Promise<AssessmentRow> {
  const result = await query<AssessmentRow>(
    `INSERT INTO assessments (
       member_id, evaluator_name, evaluated_at, movements,
       core_note, squat_note, overhead_squat_note, pushup_note, hip_hinge_note,
       pain_triggers, exercise_performance,
       odi_answers, ndi_answers, quickdash_answers, koos12_answers,
       faam_adl_answers, faam_sports_answers, nprs_rest, nprs_activity,
       functional_test_pain_free, hop_test_lsi, cmj_lsi, hamstring_lsi,
       asymptomatic_loading_weeks, startback_answers
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25)
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
      JSON.stringify(input.exercisePerformance ?? []),
      JSON.stringify(input.odiAnswers ?? {}),
      JSON.stringify(input.ndiAnswers ?? {}),
      JSON.stringify(input.quickdashAnswers ?? {}),
      JSON.stringify(input.koos12Answers ?? {}),
      JSON.stringify(input.faamAdlAnswers ?? {}),
      JSON.stringify(input.faamSportsAnswers ?? {}),
      input.nprsRest ?? null,
      input.nprsActivity ?? null,
      JSON.stringify(input.functionalTestPainFree ?? {}),
      input.hopTestLsi ?? null,
      input.cmjLsi ?? null,
      input.hamstringLsi ?? null,
      input.asymptomaticLoadingWeeks ?? null,
      JSON.stringify(input.startbackAnswers ?? {}),
    ],
  );
  return result.rows[0];
}

export interface UpdateAssessmentInput {
  evaluatorName?: string;
  evaluatedAt?: string;
  movements: AssessmentMovements;
  coreNote?: string;
  squatNote?: string;
  overheadSquatNote?: string;
  pushupNote?: string;
  hipHingeNote?: string;
  painTriggers?: PainTriggerEntry[];
  exercisePerformance?: ExercisePerformanceEntry[];
  odiAnswers?: Record<string, number>;
  ndiAnswers?: Record<string, number>;
  quickdashAnswers?: Record<string, number>;
  koos12Answers?: Record<string, number>;
  faamAdlAnswers?: Record<string, number>;
  faamSportsAnswers?: Record<string, number>;
  nprsRest?: number | null;
  nprsActivity?: number | null;
  functionalTestPainFree?: Record<string, boolean>;
  hopTestLsi?: number | null;
  cmjLsi?: number | null;
  hamstringLsi?: number | null;
  asymptomaticLoadingWeeks?: number | null;
  startbackAnswers?: Record<string, number>;
}

export async function updateAssessment(
  id: number,
  input: UpdateAssessmentInput,
): Promise<AssessmentRow | null> {
  const result = await query<AssessmentRow>(
    `UPDATE assessments SET
       evaluator_name = $2, evaluated_at = $3, movements = $4,
       core_note = $5, squat_note = $6, overhead_squat_note = $7,
       pushup_note = $8, hip_hinge_note = $9, pain_triggers = $10,
       exercise_performance = $11,
       odi_answers = $12, ndi_answers = $13, quickdash_answers = $14, koos12_answers = $15,
       faam_adl_answers = $16, faam_sports_answers = $17, nprs_rest = $18, nprs_activity = $19,
       functional_test_pain_free = $20, hop_test_lsi = $21, cmj_lsi = $22, hamstring_lsi = $23,
       asymptomatic_loading_weeks = $24, startback_answers = $25
     WHERE id = $1
     RETURNING *`,
    [
      id,
      input.evaluatorName ?? "",
      input.evaluatedAt ?? "",
      JSON.stringify(input.movements ?? {}),
      input.coreNote ?? "",
      input.squatNote ?? "",
      input.overheadSquatNote ?? "",
      input.pushupNote ?? "",
      input.hipHingeNote ?? "",
      JSON.stringify(input.painTriggers ?? []),
      JSON.stringify(input.exercisePerformance ?? []),
      JSON.stringify(input.odiAnswers ?? {}),
      JSON.stringify(input.ndiAnswers ?? {}),
      JSON.stringify(input.quickdashAnswers ?? {}),
      JSON.stringify(input.koos12Answers ?? {}),
      JSON.stringify(input.faamAdlAnswers ?? {}),
      JSON.stringify(input.faamSportsAnswers ?? {}),
      input.nprsRest ?? null,
      input.nprsActivity ?? null,
      JSON.stringify(input.functionalTestPainFree ?? {}),
      input.hopTestLsi ?? null,
      input.cmjLsi ?? null,
      input.hamstringLsi ?? null,
      input.asymptomaticLoadingWeeks ?? null,
      JSON.stringify(input.startbackAnswers ?? {}),
    ],
  );
  return result.rows[0] ?? null;
}

export async function deleteAssessment(id: number): Promise<void> {
  await query(`DELETE FROM assessments WHERE id = $1`, [id]);
}

/**
 * 회원별 평가 작성 건수 + 가장 최근 작성 시각 — 상단 탭 목록의 작성 여부/건수
 * 표시와, 최근 작성 순 정렬(최신 작성자가 맨 위) 둘 다에 쓰인다.
 */
export async function listAssessmentCountsByMember(): Promise<
  Map<number, { count: number; latestAt: string }>
> {
  const result = await query<{ member_id: number; count: string; latest_at: string }>(
    `SELECT member_id, COUNT(*) AS count, MAX(created_at) AS latest_at
     FROM assessments GROUP BY member_id`,
  );
  return new Map(
    result.rows.map((r) => [r.member_id, { count: Number(r.count), latestAt: r.latest_at }]),
  );
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
