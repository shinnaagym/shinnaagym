import { query } from "./db";
import type { PtLogExercise, PtLogRow } from "./db";

export interface InbodyInput {
  weight?: number | null;
  skeletalMuscleMass?: number | null;
  bodyFatMass?: number | null;
  bodyFatPercentage?: number | null;
}

export interface CreatePtLogInput {
  memberId: number;
  logDate: string;
  memo?: string;
  painScale?: number | null;
  performanceScale?: number | null;
  exercises?: PtLogExercise[];
  inbody?: InbodyInput;
}

export async function createPtLog(input: CreatePtLogInput): Promise<PtLogRow> {
  const result = await query<PtLogRow>(
    `INSERT INTO pt_logs (
       member_id, log_date, memo, pain_scale, performance_scale, exercises,
       inbody_weight, inbody_skeletal_muscle_mass, inbody_body_fat_mass, inbody_body_fat_percentage
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [
      input.memberId,
      input.logDate,
      input.memo ?? "",
      input.painScale ?? null,
      input.performanceScale ?? null,
      JSON.stringify(input.exercises ?? []),
      input.inbody?.weight ?? null,
      input.inbody?.skeletalMuscleMass ?? null,
      input.inbody?.bodyFatMass ?? null,
      input.inbody?.bodyFatPercentage ?? null,
    ],
  );
  return result.rows[0];
}

/** 회원의 PT 일지를 최신 날짜순으로 반환한다. */
export async function listPtLogsByMember(memberId: number): Promise<PtLogRow[]> {
  const result = await query<PtLogRow>(
    `SELECT * FROM pt_logs WHERE member_id = $1 ORDER BY log_date DESC, created_at DESC`,
    [memberId],
  );
  return result.rows;
}

export async function getPtLogById(id: number): Promise<PtLogRow | null> {
  const result = await query<PtLogRow>(`SELECT * FROM pt_logs WHERE id = $1`, [id]);
  return result.rows[0] ?? null;
}

export interface UpdatePtLogInput {
  logDate: string;
  memo?: string;
  exercises?: PtLogExercise[];
  inbody?: InbodyInput;
}

export async function updatePtLog(id: number, input: UpdatePtLogInput): Promise<PtLogRow> {
  const result = await query<PtLogRow>(
    `UPDATE pt_logs SET
       log_date = $2, memo = $3, exercises = $4,
       inbody_weight = $5, inbody_skeletal_muscle_mass = $6,
       inbody_body_fat_mass = $7, inbody_body_fat_percentage = $8
     WHERE id = $1
     RETURNING *`,
    [
      id,
      input.logDate,
      input.memo ?? "",
      JSON.stringify(input.exercises ?? []),
      input.inbody?.weight ?? null,
      input.inbody?.skeletalMuscleMass ?? null,
      input.inbody?.bodyFatMass ?? null,
      input.inbody?.bodyFatPercentage ?? null,
    ],
  );
  return result.rows[0];
}

export async function deletePtLog(id: number): Promise<void> {
  await query(`DELETE FROM pt_logs WHERE id = $1`, [id]);
}

/** 회원 삭제(소프트 삭제) 시 이 회원의 PT 일지를 모두 지운다. */
export async function deletePtLogsByMember(memberId: number): Promise<void> {
  await query(`DELETE FROM pt_logs WHERE member_id = $1`, [memberId]);
}
