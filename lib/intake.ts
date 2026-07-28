import { query } from "./db";
import type { IntakeQuestionnaireRow, PainMovementEntry } from "./db";

export interface UpsertIntakeQuestionnaireInput {
  memberId: number;
  intakeName: string;
  age: number | null;
  phone: string;
  visitChannel: string;
  visitChannelReferrerName: string;
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

/** 초진 문진표가 이미 작성된 회원 id 집합 — 상단 탭 목록의 작성 여부 표시용. */
export async function listIntakeMemberIds(): Promise<Set<number>> {
  const result = await query<{ member_id: number }>(
    `SELECT member_id FROM intake_questionnaires`,
  );
  return new Set(result.rows.map((r) => r.member_id));
}

/**
 * 해당 월(YYYY-MM)에 처음 문진표를 작성한(=상담하러 온) 회원들의 방문 경로별
 * 인원수. 대시보드의 월별 방문 경로 통계용.
 */
export async function getVisitChannelCountsForMonth(
  yearMonth: string,
): Promise<Record<string, number>> {
  const result = await query<{ visit_channel: string; count: string }>(
    `SELECT visit_channel, COUNT(*) as count FROM intake_questionnaires
     WHERE to_char(created_at, 'YYYY-MM') = $1
     GROUP BY visit_channel`,
    [yearMonth],
  );
  const counts: Record<string, number> = {};
  for (const row of result.rows) {
    counts[row.visit_channel] = Number(row.count);
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
       exercise_purposes, exercise_purpose_other,
       stance_leg, leg_cross, sleep_position, frequent_movement,
       sleep_hours, sleep_quality, stress_level, drinking, smoking, other_notes,
       pain_onset_period, pain_onset_type, pain_moi, pain_movements,
       pain_cycle_situation, pain_cycle_morning, pain_cycle_noon, pain_cycle_evening, pain_cycle_night,
       pain_characteristics, pain_characteristics_other,
       improve_factors, worsen_factors, perceived_cause, post_pain_action,
       past_same_pain_history, past_treatment, major_complaint, minor_complaint, updated_at
     ) VALUES (
       $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
       $21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37, now()
     )
     ON CONFLICT (member_id) DO UPDATE SET
       intake_name = EXCLUDED.intake_name,
       age = EXCLUDED.age,
       phone = EXCLUDED.phone,
       visit_channel = EXCLUDED.visit_channel,
       visit_channel_referrer_name = EXCLUDED.visit_channel_referrer_name,
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
       updated_at = now()
     RETURNING *`,
    [
      input.memberId,
      input.intakeName,
      input.age,
      input.phone,
      input.visitChannel,
      input.visitChannelReferrerName,
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
    ],
  );
  return result.rows[0];
}
