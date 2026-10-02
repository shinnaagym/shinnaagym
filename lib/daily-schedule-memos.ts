import { query } from "./db";

/** 날짜별 스케줄 메모 — 주간 스케줄표에서 그 요일(날짜) 칸 바로 아래에 쓰는
    짧은 메모 한 줄이다. 날짜마다 하나씩만 있고, 다시 저장하면 덮어쓴다. */
export async function getDailyScheduleMemos(dateKeys: string[]): Promise<Record<string, string>> {
  if (dateKeys.length === 0) return {};
  const { rows } = await query<{ date: string; content: string }>(
    `SELECT date, content FROM daily_schedule_memos WHERE date = ANY($1)`,
    [dateKeys],
  );
  return Object.fromEntries(rows.map((r) => [r.date, r.content]));
}

export async function setDailyScheduleMemo(date: string, content: string): Promise<void> {
  if (content.trim() === "") {
    await query(`DELETE FROM daily_schedule_memos WHERE date = $1`, [date]);
    return;
  }
  await query(
    `INSERT INTO daily_schedule_memos (date, content, updated_at)
     VALUES ($1, $2, now())
     ON CONFLICT (date) DO UPDATE SET content = EXCLUDED.content, updated_at = now()`,
    [date, content],
  );
}
