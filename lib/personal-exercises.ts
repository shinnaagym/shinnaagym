import { query } from "./db";
import type { PersonalExerciseRow, PtLogExercise } from "./db";

export interface CreatePersonalExerciseInput {
  memberId: number;
  logDate: string;
  memo?: string;
  exercises?: PtLogExercise[];
}

export async function createPersonalExercise(
  input: CreatePersonalExerciseInput,
): Promise<PersonalExerciseRow> {
  const result = await query<PersonalExerciseRow>(
    `INSERT INTO personal_exercises (member_id, log_date, memo, exercises)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [input.memberId, input.logDate, input.memo ?? "", JSON.stringify(input.exercises ?? [])],
  );
  return result.rows[0];
}

/** 회원의 개인 운동 기록을 최신 날짜순으로 반환한다. */
export async function listPersonalExercisesByMember(
  memberId: number,
): Promise<PersonalExerciseRow[]> {
  const result = await query<PersonalExerciseRow>(
    `SELECT * FROM personal_exercises WHERE member_id = $1 ORDER BY log_date DESC, created_at DESC`,
    [memberId],
  );
  return result.rows;
}

export async function getPersonalExerciseById(id: number): Promise<PersonalExerciseRow | null> {
  const result = await query<PersonalExerciseRow>(
    `SELECT * FROM personal_exercises WHERE id = $1`,
    [id],
  );
  return result.rows[0] ?? null;
}

export interface UpdatePersonalExerciseInput {
  logDate: string;
  memo?: string;
  exercises?: PtLogExercise[];
}

export async function updatePersonalExercise(
  id: number,
  input: UpdatePersonalExerciseInput,
): Promise<PersonalExerciseRow> {
  const result = await query<PersonalExerciseRow>(
    `UPDATE personal_exercises SET log_date = $2, memo = $3, exercises = $4
     WHERE id = $1
     RETURNING *`,
    [id, input.logDate, input.memo ?? "", JSON.stringify(input.exercises ?? [])],
  );
  return result.rows[0];
}

export async function deletePersonalExercise(id: number): Promise<void> {
  await query(`DELETE FROM personal_exercises WHERE id = $1`, [id]);
}
