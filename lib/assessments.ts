import { query } from "./db";
import type {
  AssessmentMovements,
  AssessmentRow,
  CustomFunctionalTestEntry,
  ExercisePerformanceEntry,
  PainTriggerEntry,
} from "./db";
import { movementLabelWithRegion } from "./assessment-movements";

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
  balanceNote?: string;
  ybtNote?: string;
  customFunctionalTests?: CustomFunctionalTestEntry[];
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
       balance_note, ybt_note, custom_functional_tests,
       pain_triggers, exercise_performance,
       odi_answers, ndi_answers, quickdash_answers, koos12_answers,
       faam_adl_answers, faam_sports_answers, nprs_rest, nprs_activity,
       functional_test_pain_free, hop_test_lsi, cmj_lsi, hamstring_lsi,
       asymptomatic_loading_weeks, startback_answers
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28)
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
      input.balanceNote ?? "",
      input.ybtNote ?? "",
      JSON.stringify(input.customFunctionalTests ?? []),
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
  balanceNote?: string;
  ybtNote?: string;
  customFunctionalTests?: CustomFunctionalTestEntry[];
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
       pushup_note = $8, hip_hinge_note = $9, balance_note = $10, ybt_note = $11,
       custom_functional_tests = $12,
       pain_triggers = $13,
       exercise_performance = $14,
       odi_answers = $15, ndi_answers = $16, quickdash_answers = $17, koos12_answers = $18,
       faam_adl_answers = $19, faam_sports_answers = $20, nprs_rest = $21, nprs_activity = $22,
       functional_test_pain_free = $23, hop_test_lsi = $24, cmj_lsi = $25, hamstring_lsi = $26,
       asymptomatic_loading_weeks = $27, startback_answers = $28
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
      input.balanceNote ?? "",
      input.ybtNote ?? "",
      JSON.stringify(input.customFunctionalTests ?? []),
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

/** 회원 삭제(소프트 삭제) 시 이 회원의 평가지를 모두 지운다. */
export async function deleteAssessmentsByMember(memberId: number): Promise<void> {
  await query(`DELETE FROM assessments WHERE member_id = $1`, [memberId]);
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
  // pg 드라이버가 TIMESTAMPTZ 컬럼을 Date 인스턴스로 파싱해서 돌려주므로(타입 선언과
  // 달리 실제로는 string이 아닐 수 있음), 클라이언트에서 문자열 메서드(localeCompare
  // 등)로 정렬해도 안전하도록 여기서 ISO 문자열로 명시적으로 변환해둔다.
  return new Map(
    result.rows.map((r) => [
      r.member_id,
      { count: Number(r.count), latestAt: new Date(r.latest_at).toISOString() },
    ]),
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

function dateKeyOfAssessment(a: AssessmentRow): string {
  if (a.evaluated_at) return a.evaluated_at;
  return new Date(a.created_at).toISOString().slice(0, 10);
}

export interface PainPointTarget {
  assessment: AssessmentRow;
  /** pain_triggers 배열이 비어 있고 레거시 단일 필드(pain_trigger_note/pain_scale)로만
      저장된 행인지 — 이 경우 삭제/수정 시 pain_triggers 배열로 옮겨 써야 한다(updateAssessment가
      레거시 필드는 건드리지 않으므로, 그대로 두면 pain_triggers가 레거시 값을 가리게 된다). */
  usesLegacySingleField: boolean;
}

/**
 * 통증 척도 그래프(AssessmentPainChart)의 점 하나(날짜 + 시리즈)가 실제로 어느 평가
 * 행에서 왔는지 찾는다. 같은 날짜에 평가가 여러 건이면 그래프와 똑같이(groupByDate와
 * 동일한 규칙) 가장 나중에 작성된(created_at이 가장 늦은) 기록의 값이 화면에 보이므로,
 * 그 값을 가진 행을 뒤에서부터 찾아 반환한다.
 */
export async function findAssessmentForPainPoint(
  memberId: number,
  dateKey: string,
  seriesKey: string,
): Promise<PainPointTarget | null> {
  const all = await listAssessmentsByMember(memberId);
  const sameDate = all
    .filter((a) => dateKeyOfAssessment(a) === dateKey)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  for (let i = sameDate.length - 1; i >= 0; i--) {
    const a = sameDate[i];
    if (seriesKey.startsWith("note:")) {
      const note = seriesKey.slice("note:".length);
      if (a.pain_triggers.some((e) => e.note === note)) {
        return { assessment: a, usesLegacySingleField: false };
      }
      if (a.pain_triggers.length === 0 && a.pain_trigger_note === note) {
        return { assessment: a, usesLegacySingleField: true };
      }
    } else if (seriesKey.startsWith("movement:")) {
      const rest = seriesKey.slice("movement:".length);
      const lastColon = rest.lastIndexOf(":");
      const movementId = rest.slice(0, lastColon);
      const romType = rest.slice(lastColon + 1);
      const entry = a.movements[movementId];
      const val = romType === "passive" ? entry?.painPassive : entry?.painActive;
      if (val) return { assessment: a, usesLegacySingleField: false };
    }
  }
  return null;
}

function toUpdateInput(a: AssessmentRow): UpdateAssessmentInput {
  return {
    evaluatorName: a.evaluator_name,
    evaluatedAt: a.evaluated_at,
    movements: a.movements,
    coreNote: a.core_note,
    squatNote: a.squat_note,
    overheadSquatNote: a.overhead_squat_note,
    pushupNote: a.pushup_note,
    hipHingeNote: a.hip_hinge_note,
    balanceNote: a.balance_note,
    ybtNote: a.ybt_note,
    customFunctionalTests: a.custom_functional_tests,
    painTriggers: a.pain_triggers,
    exercisePerformance: a.exercise_performance,
    odiAnswers: a.odi_answers,
    ndiAnswers: a.ndi_answers,
    quickdashAnswers: a.quickdash_answers,
    koos12Answers: a.koos12_answers,
    faamAdlAnswers: a.faam_adl_answers,
    faamSportsAnswers: a.faam_sports_answers,
    nprsRest: a.nprs_rest,
    nprsActivity: a.nprs_activity,
    functionalTestPainFree: a.functional_test_pain_free,
    hopTestLsi: a.hop_test_lsi,
    cmjLsi: a.cmj_lsi,
    hamstringLsi: a.hamstring_lsi,
    asymptomaticLoadingWeeks: a.asymptomatic_loading_weeks,
    startbackAnswers: a.startback_answers,
  };
}

/**
 * 통증 척도 그래프의 점 하나를 수정(painScale 지정)하거나 삭제(painScale=null)한다.
 * 대상 행의 movements 또는 pain_triggers 중 이 점이 속한 필드 하나만 바꾸고, 나머지
 * 필드는 그대로 유지한다.
 */
export async function updatePainPoint(
  target: PainPointTarget,
  seriesKey: string,
  painScale: number | null,
): Promise<AssessmentRow | null> {
  const a = target.assessment;
  const input = toUpdateInput(a);

  if (seriesKey.startsWith("note:")) {
    const note = seriesKey.slice("note:".length);
    input.painTriggers = target.usesLegacySingleField
      ? painScale == null
        ? []
        : [{ note, painScale }]
      : painScale == null
        ? a.pain_triggers.filter((e) => e.note !== note)
        : a.pain_triggers.map((e) => (e.note === note ? { ...e, painScale } : e));
  } else {
    const rest = seriesKey.slice("movement:".length);
    const lastColon = rest.lastIndexOf(":");
    const movementId = rest.slice(0, lastColon);
    const romType = rest.slice(lastColon + 1);
    const existingEntry = a.movements[movementId] ?? {
      romPassive: "",
      romActive: "",
      strength: "",
      compensation: "",
      painPassive: "",
      painActive: "",
    };
    const valueStr = painScale == null ? "" : String(painScale);
    input.movements = {
      ...a.movements,
      [movementId]: {
        ...existingEntry,
        painPassive: romType === "passive" ? valueStr : existingEntry.painPassive,
        painActive: romType === "active" ? valueStr : existingEntry.painActive,
      },
    };
  }

  return updateAssessment(a.id, input);
}

/**
 * "통증 유발 동작 기록"(자유 텍스트)의 자동완성 목록. 그동안 자유 텍스트로
 * 적은 통증 유발 동작 문구뿐 아니라, 체형 평가(movements)에서 통증 점수가
 * 기록된 동작의 라벨(예: "(요추) 측면 글라이딩(우측) · 능동")도 함께
 * 포함한다 — 통증 척도 그래프(AssessmentPainChart)에 선으로 나타나는
 * 동작은 전부 다음 기록 때 과거 문구로 바로 고를 수 있어야 하기 때문이다
 * (이전엔 자유 텍스트 문구만 들어가 있어, 체형 평가에서만 기록한 동작은
 * 과거 문구 목록에 전혀 안 보이는 누락이 있었다). 최근에 작성한 평가부터
 * 훑으므로(assessments가 created_at DESC로 정렬돼 들어온다는 전제),
 * 결과도 최근 문구가 먼저 온다.
 */
export function pastPainTriggerNotes(assessments: AssessmentRow[]): string[] {
  const seen = new Set<string>();
  const notes: string[] = [];
  function add(label: string) {
    if (!label || seen.has(label)) return;
    seen.add(label);
    notes.push(label);
  }
  for (const a of assessments) {
    for (const entry of getPainTriggerEntries(a)) {
      add(entry.note);
    }
    for (const [movementId, entry] of Object.entries(a.movements)) {
      if (entry.painPassive) add(`${movementLabelWithRegion(movementId)} · 수동`);
      if (entry.painActive) add(`${movementLabelWithRegion(movementId)} · 능동`);
    }
  }
  return notes;
}
