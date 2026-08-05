import { query } from "./db";
import { monthKeyRange } from "./date";
import type { IntakeQuestionnaireRow, PainMovementEntry } from "./db";

export interface UpsertIntakeQuestionnaireInput {
  memberId: number;
  intakeName: string;
  age: number | null;
  phone: string;
  visitChannel: string;
  visitChannelReferrerName: string;
  visitChannelOther: string;
  exercisePurposes: string[];
  exercisePurposeOther: string;
  stanceLeg: string;
  legCross: string;
  sleepPosition: string;
  frequentMovement: string;
  sleepHours: number | null;
  sleepQuality: string;
  stressLevel: string;
  drinking: boolean;
  smoking: boolean;
  otherNotes: string;
  painOnsetPeriod: string;
  painOnsetType: string;
  painMoi: string;
  bodyDiagramFront: string;
  bodyDiagramBack: string;
  bodyDiagramLeft: string;
  bodyDiagramRight: string;
  bodyDiagramFeet: string;
  bodyDiagramHands: string;
  painMovements: PainMovementEntry[];
  painCycleSituation: string;
  painCycleMorning: string;
  painCycleNoon: string;
  painCycleEvening: string;
  painCycleNight: string;
  painCharacteristics: string[];
  painCharacteristicsOther: string;
  improveFactors: string;
  worsenFactors: string;
  perceivedCause: string;
  postPainAction: string;
  pastSamePainHistory: string;
  pastTreatment: string;
  majorComplaint: string;
  minorComplaint: string;
  odiAnswers: Record<string, number>;
  ndiAnswers: Record<string, number>;
  quickdashAnswers: Record<string, number>;
  koos12Answers: Record<string, number>;
  faamAdlAnswers: Record<string, number>;
  faamSportsAnswers: Record<string, number>;
  startbackAnswers: Record<string, number>;
}

export async function getIntakeQuestionnaireByMember(
  memberId: number,
): Promise<IntakeQuestionnaireRow | null> {
  const result = await query<IntakeQuestionnaireRow>(
    `SELECT * FROM intake_questionnaires WHERE member_id = $1`,
    [memberId],
  );
  return result.rows[0] ?? null;
}

export async function deleteIntakeQuestionnaire(memberId: number): Promise<void> {
  await query(`DELETE FROM intake_questionnaires WHERE member_id = $1`, [memberId]);
}

/**
 * 초진 문진표가 이미 작성된 회원별 작성 시각 — 상단 탭 목록의 작성 여부 표시와,
 * 최근 작성 순 정렬(최신 작성자가 맨 위) 둘 다에 쓰인다.
 */
export async function listIntakeMemberTimestamps(): Promise<Map<number, string>> {
  const result = await query<{ member_id: number; created_at: string }>(
    `SELECT member_id, created_at FROM intake_questionnaires`,
  );
  // pg 드라이버가 TIMESTAMPTZ 컬럼을 Date 인스턴스로 파싱해서 돌려주므로(타입 선언과
  // 달리 실제로는 string이 아닐 수 있음), 클라이언트에서 문자열 메서드(localeCompare
  // 등)로 정렬해도 안전하도록 여기서 ISO 문자열로 명시적으로 변환해둔다.
  return new Map(
    result.rows.map((r) => [r.member_id, new Date(r.created_at).toISOString()]),
  );
}

/**
 * 해당 월(YYYY-MM)에 처음 문진표를 작성한(=상담하러 온) 회원들의 방문 경로별
 * 인원수. 대시보드의 월별 방문 경로 통계용. 방문 경로가 "기타"이면서 자유
 * 입력 텍스트가 있으면, 그 텍스트 자체를 키로 묶어 새 카테고리처럼 집계한다
 * (예: 기타에 "엘베"라고 적으면 "엘베"라는 항목으로 카운트됨).
 */
export async function getVisitChannelCountsForMonth(
  yearMonth: string,
): Promise<Record<string, number>> {
  const [monthStart, monthEnd] = monthKeyRange(yearMonth);
  const result = await query<{ channel_key: string; count: string }>(
    `SELECT
       CASE
         WHEN visit_channel = 'other' AND trim(visit_channel_other) <> '' THEN trim(visit_channel_other)
         ELSE visit_channel
       END AS channel_key,
       COUNT(*) as count
     FROM intake_questionnaires
     WHERE created_at >= $1 AND created_at < $2
     GROUP BY channel_key`,
    [monthStart, monthEnd],
  );
  const counts: Record<string, number> = {};
  for (const row of result.rows) {
    counts[row.channel_key] = Number(row.count);
  }
  return counts;
}

/** 회원당 한 건만 존재하는 초진 문진표 — 작성/수정 모두 upsert로 처리한다. */
export async function upsertIntakeQuestionnaire(
  input: UpsertIntakeQuestionnaireInput,
): Promise<IntakeQuestionnaireRow> {
  const result = await query<IntakeQuestionnaireRow>(
    `INSERT INTO intake_questionnaires (
       member_id, intake_name, age, phone, visit_channel, visit_channel_referrer_name,
       visit_channel_other,
       exercise_purposes, exercise_purpose_other,
       stance_leg, leg_cross, sleep_position, frequent_movement,
       sleep_hours, sleep_quality, stress_level, drinking, smoking, other_notes,
       pain_onset_period, pain_onset_type, pain_moi, pain_movements,
       pain_cycle_situation, pain_cycle_morning, pain_cycle_noon, pain_cycle_evening, pain_cycle_night,
       pain_characteristics, pain_characteristics_other,
       improve_factors, worsen_factors, perceived_cause, post_pain_action,
       past_same_pain_history, past_treatment, major_complaint, minor_complaint,
       odi_answers, ndi_answers, quickdash_answers, koos12_answers, faam_adl_answers,
       faam_sports_answers, startback_answers,
       body_diagram_front, body_diagram_back, body_diagram_left, body_diagram_right,
       body_diagram_feet, body_diagram_hands, updated_at
     ) VALUES (
       $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
       $21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37,$38,
       $39,$40,$41,$42,$43,$44,$45,$46,$47,$48,$49,$50,$51, now()
     )
     ON CONFLICT (member_id) DO UPDATE SET
       intake_name = EXCLUDED.intake_name,
       age = EXCLUDED.age,
       phone = EXCLUDED.phone,
       visit_channel = EXCLUDED.visit_channel,
       visit_channel_referrer_name = EXCLUDED.visit_channel_referrer_name,
       visit_channel_other = EXCLUDED.visit_channel_other,
       exercise_purposes = EXCLUDED.exercise_purposes,
       exercise_purpose_other = EXCLUDED.exercise_purpose_other,
       stance_leg = EXCLUDED.stance_leg,
       leg_cross = EXCLUDED.leg_cross,
       sleep_position = EXCLUDED.sleep_position,
       frequent_movement = EXCLUDED.frequent_movement,
       sleep_hours = EXCLUDED.sleep_hours,
       sleep_quality = EXCLUDED.sleep_quality,
       stress_level = EXCLUDED.stress_level,
       drinking = EXCLUDED.drinking,
       smoking = EXCLUDED.smoking,
       other_notes = EXCLUDED.other_notes,
       pain_onset_period = EXCLUDED.pain_onset_period,
       pain_onset_type = EXCLUDED.pain_onset_type,
       pain_moi = EXCLUDED.pain_moi,
       pain_movements = EXCLUDED.pain_movements,
       pain_cycle_situation = EXCLUDED.pain_cycle_situation,
       pain_cycle_morning = EXCLUDED.pain_cycle_morning,
       pain_cycle_noon = EXCLUDED.pain_cycle_noon,
       pain_cycle_evening = EXCLUDED.pain_cycle_evening,
       pain_cycle_night = EXCLUDED.pain_cycle_night,
       pain_characteristics = EXCLUDED.pain_characteristics,
       pain_characteristics_other = EXCLUDED.pain_characteristics_other,
       improve_factors = EXCLUDED.improve_factors,
       worsen_factors = EXCLUDED.worsen_factors,
       perceived_cause = EXCLUDED.perceived_cause,
       post_pain_action = EXCLUDED.post_pain_action,
       past_same_pain_history = EXCLUDED.past_same_pain_history,
       past_treatment = EXCLUDED.past_treatment,
       major_complaint = EXCLUDED.major_complaint,
       minor_complaint = EXCLUDED.minor_complaint,
       odi_answers = EXCLUDED.odi_answers,
       ndi_answers = EXCLUDED.ndi_answers,
       quickdash_answers = EXCLUDED.quickdash_answers,
       koos12_answers = EXCLUDED.koos12_answers,
       faam_adl_answers = EXCLUDED.faam_adl_answers,
       faam_sports_answers = EXCLUDED.faam_sports_answers,
       startback_answers = EXCLUDED.startback_answers,
       body_diagram_front = EXCLUDED.body_diagram_front,
       body_diagram_back = EXCLUDED.body_diagram_back,
       body_diagram_left = EXCLUDED.body_diagram_left,
       body_diagram_right = EXCLUDED.body_diagram_right,
       body_diagram_feet = EXCLUDED.body_diagram_feet,
       body_diagram_hands = EXCLUDED.body_diagram_hands,
       updated_at = now()
     RETURNING *`,
    [
      input.memberId,
      input.intakeName,
      input.age,
      input.phone,
      input.visitChannel,
      input.visitChannelReferrerName,
      input.visitChannelOther,
      input.exercisePurposes,
      input.exercisePurposeOther,
      input.stanceLeg,
      input.legCross,
      input.sleepPosition,
      input.frequentMovement,
      input.sleepHours,
      input.sleepQuality,
      input.stressLevel,
      input.drinking,
      input.smoking,
      input.otherNotes,
      input.painOnsetPeriod,
      input.painOnsetType,
      input.painMoi,
      JSON.stringify(input.painMovements),
      input.painCycleSituation,
      input.painCycleMorning,
      input.painCycleNoon,
      input.painCycleEvening,
      input.painCycleNight,
      JSON.stringify(input.painCharacteristics),
      input.painCharacteristicsOther,
      input.improveFactors,
      input.worsenFactors,
      input.perceivedCause,
      input.postPainAction,
      input.pastSamePainHistory,
      input.pastTreatment,
      input.majorComplaint,
      input.minorComplaint,
      JSON.stringify(input.odiAnswers),
      JSON.stringify(input.ndiAnswers),
      JSON.stringify(input.quickdashAnswers),
      JSON.stringify(input.koos12Answers),
      JSON.stringify(input.faamAdlAnswers),
      JSON.stringify(input.faamSportsAnswers),
      JSON.stringify(input.startbackAnswers),
      input.bodyDiagramFront,
      input.bodyDiagramBack,
      input.bodyDiagramLeft,
      input.bodyDiagramRight,
      input.bodyDiagramFeet,
      input.bodyDiagramHands,
    ],
  );
  return result.rows[0];
}
