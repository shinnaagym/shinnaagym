import { query } from "./db";
import type { IntakeQuestionnaireRow } from "./db";

export interface UpsertIntakeQuestionnaireInput {
  memberId: number;
  stanceLeg: string;
  legCross: string;
  sleepPosition: string;
  frequentMovement: string;
  sleepAmount: string;
  sleepQuality: string;
  stressLevel: string;
  drinking: boolean;
  smoking: boolean;
  otherNotes: string;
  painOnsetPeriod: string;
  painOnsetType: string;
  painMoi: string;
  painProgressNote: string;
  painNrsBest: number | null;
  painNrsWorst: number | null;
  painNrsCurrent: number | null;
  painPersistence: string;
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

/** 회원당 한 건만 존재하는 초진 문진표 — 작성/수정 모두 upsert로 처리한다. */
export async function upsertIntakeQuestionnaire(
  input: UpsertIntakeQuestionnaireInput,
): Promise<IntakeQuestionnaireRow> {
  const result = await query<IntakeQuestionnaireRow>(
    `INSERT INTO intake_questionnaires (
       member_id, stance_leg, leg_cross, sleep_position, frequent_movement,
       sleep_amount, sleep_quality, stress_level, drinking, smoking, other_notes,
       pain_onset_period, pain_onset_type, pain_moi, pain_progress_note,
       pain_nrs_best, pain_nrs_worst, pain_nrs_current, pain_persistence,
       pain_cycle_situation, pain_cycle_morning, pain_cycle_noon, pain_cycle_evening, pain_cycle_night,
       pain_characteristics, pain_characteristics_other,
       improve_factors, worsen_factors, perceived_cause, post_pain_action,
       past_same_pain_history, past_treatment, major_complaint, minor_complaint, updated_at
     ) VALUES (
       $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
       $21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34, now()
     )
     ON CONFLICT (member_id) DO UPDATE SET
       stance_leg = EXCLUDED.stance_leg,
       leg_cross = EXCLUDED.leg_cross,
       sleep_position = EXCLUDED.sleep_position,
       frequent_movement = EXCLUDED.frequent_movement,
       sleep_amount = EXCLUDED.sleep_amount,
       sleep_quality = EXCLUDED.sleep_quality,
       stress_level = EXCLUDED.stress_level,
       drinking = EXCLUDED.drinking,
       smoking = EXCLUDED.smoking,
       other_notes = EXCLUDED.other_notes,
       pain_onset_period = EXCLUDED.pain_onset_period,
       pain_onset_type = EXCLUDED.pain_onset_type,
       pain_moi = EXCLUDED.pain_moi,
       pain_progress_note = EXCLUDED.pain_progress_note,
       pain_nrs_best = EXCLUDED.pain_nrs_best,
       pain_nrs_worst = EXCLUDED.pain_nrs_worst,
       pain_nrs_current = EXCLUDED.pain_nrs_current,
       pain_persistence = EXCLUDED.pain_persistence,
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
      input.stanceLeg,
      input.legCross,
      input.sleepPosition,
      input.frequentMovement,
      input.sleepAmount,
      input.sleepQuality,
      input.stressLevel,
      input.drinking,
      input.smoking,
      input.otherNotes,
      input.painOnsetPeriod,
      input.painOnsetType,
      input.painMoi,
      input.painProgressNote,
      input.painNrsBest,
      input.painNrsWorst,
      input.painNrsCurrent,
      input.painPersistence,
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
