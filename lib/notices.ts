import { query, type NoticeCategory, type NoticeRow } from "./db";

export async function listNotices(): Promise<NoticeRow[]> {
  const { rows } = await query<NoticeRow>(
    `SELECT * FROM notices ORDER BY created_at DESC`,
  );
  return rows;
}

export async function createNotice(
  category: NoticeCategory,
  title: string,
  content: string,
): Promise<NoticeRow> {
  const { rows } = await query<NoticeRow>(
    `INSERT INTO notices (category, title, content) VALUES ($1, $2, $3) RETURNING *`,
    [category, title, content],
  );
  return rows[0];
}

export async function updateNotice(
  id: number,
  title: string,
  content: string,
): Promise<NoticeRow | null> {
  const { rows } = await query<NoticeRow>(
    `UPDATE notices SET title = $2, content = $3, updated_at = now() WHERE id = $1 RETURNING *`,
    [id, title, content],
  );
  return rows[0] ?? null;
}

export async function deleteNotice(id: number): Promise<boolean> {
  const { rowCount } = await query(`DELETE FROM notices WHERE id = $1`, [id]);
  return (rowCount ?? 0) > 0;
}
