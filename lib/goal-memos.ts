import { query } from "./db";
import type { GoalMemoRow } from "./db";

/** 회원별 "목표" 메모장 — 최근 작성 순으로 누적된다. 관리자만 쓰고 고치고
    지울 수 있고, 회원 페이지에는 읽기 전용으로 보여준다. */
export async function listGoalMemosByMember(memberId: number): Promise<GoalMemoRow[]> {
  const { rows } = await query<GoalMemoRow>(
    `SELECT * FROM goal_memos WHERE member_id = $1 ORDER BY created_at DESC`,
    [memberId],
  );
  return rows;
}

export async function createGoalMemo(memberId: number, content: string): Promise<GoalMemoRow> {
  const { rows } = await query<GoalMemoRow>(
    `INSERT INTO goal_memos (member_id, content) VALUES ($1, $2) RETURNING *`,
    [memberId, content],
  );
  return rows[0];
}

export async function updateGoalMemo(id: number, content: string): Promise<GoalMemoRow | null> {
  const { rows } = await query<GoalMemoRow>(
    `UPDATE goal_memos SET content = $2 WHERE id = $1 RETURNING *`,
    [id, content],
  );
  return rows[0] ?? null;
}

export async function deleteGoalMemo(id: number): Promise<boolean> {
  const { rowCount } = await query(`DELETE FROM goal_memos WHERE id = $1`, [id]);
  return (rowCount ?? 0) > 0;
}

/** 회원 소프트 삭제 시, 다른 개인 기록(평가지·PT 일지 등)과 같은 방식으로
    같이 정리한다 — 실행취소를 위해 지운 행을 그대로 돌려준다. */
export async function deleteGoalMemosByMember(memberId: number): Promise<GoalMemoRow[]> {
  const { rows } = await query<GoalMemoRow>(
    `DELETE FROM goal_memos WHERE member_id = $1 RETURNING *`,
    [memberId],
  );
  return rows;
}
