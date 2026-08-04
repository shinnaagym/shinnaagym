import { query } from "./db";
import type { ScheduleMemoRow } from "./db";

/** 날짜와 무관한 공용 스케줄 메모장 — 최근 작성 순으로 누적된다. */
export async function listScheduleMemos(): Promise<ScheduleMemoRow[]> {
  const { rows } = await query<ScheduleMemoRow>(
    `SELECT * FROM schedule_memos ORDER BY created_at DESC`,
  );
  return rows;
}

export async function createScheduleMemo(content: string): Promise<ScheduleMemoRow> {
  const { rows } = await query<ScheduleMemoRow>(
    `INSERT INTO schedule_memos (content) VALUES ($1) RETURNING *`,
    [content],
  );
  return rows[0];
}

export async function updateScheduleMemo(id: number, content: string): Promise<ScheduleMemoRow | null> {
  const { rows } = await query<ScheduleMemoRow>(
    `UPDATE schedule_memos SET content = $2 WHERE id = $1 RETURNING *`,
    [id, content],
  );
  return rows[0] ?? null;
}

export async function deleteScheduleMemo(id: number): Promise<boolean> {
  const { rowCount } = await query(`DELETE FROM schedule_memos WHERE id = $1`, [id]);
  return (rowCount ?? 0) > 0;
}
