import { query } from "./db";
import type { SettingsMemoRow } from "./db";

/** 설정 페이지 전용 메모장 — 스케줄표 메모장과 별개의 목록, 최근 작성 순으로 누적된다. */
export async function listSettingsMemos(): Promise<SettingsMemoRow[]> {
  const { rows } = await query<SettingsMemoRow>(
    `SELECT * FROM settings_memos ORDER BY created_at DESC`,
  );
  return rows;
}

export async function createSettingsMemo(content: string): Promise<SettingsMemoRow> {
  const { rows } = await query<SettingsMemoRow>(
    `INSERT INTO settings_memos (content) VALUES ($1) RETURNING *`,
    [content],
  );
  return rows[0];
}

export async function deleteSettingsMemo(id: number): Promise<boolean> {
  const { rowCount } = await query(`DELETE FROM settings_memos WHERE id = $1`, [id]);
  return (rowCount ?? 0) > 0;
}
